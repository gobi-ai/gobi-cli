import { createHash } from "crypto";
import { existsSync, readFileSync, rmSync, mkdirSync, readdirSync, statSync } from "fs";
import { writeFile } from "fs/promises";
import { join, dirname, extname, resolve as pathResolve } from "path";
import Database from "better-sqlite3";
import { Command } from "commander";
import inquirer from "inquirer";
import ignore from "ignore";
import trash from "trash";
import { WEBDRIVE_BASE_URL } from "../constants.js";
import { getValidToken } from "../auth/manager.js";
import { GobiError } from "../errors.js";
import { getVaultSlug } from "./init.js";
import { isJsonMode, jsonOut } from "./utils.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConflictStrategy = "ask" | "server" | "client" | "skip";

export interface SyncOptions {
  vaultSlug: string;
  dir: string;
  uploadOnly: boolean;
  downloadOnly: boolean;
  conflict: ConflictStrategy;
  dryRun: boolean;
  jsonMode: boolean;
  /** Force full re-scan: ignore cursor and hash cache (equivalent to first-time sync). */
  full?: boolean;
  /** Restrict sync to these file/folder paths (relative to vault root). Empty = no restriction. */
  paths?: string[];
  authToken?: string;    // optional override; used in tests to bypass credential lookup
  webdriveUrl?: string;  // optional override; used in tests to point at a local server
}

export interface SyncState {
  cursor: number | null;
  syncfilesHash: string | null;
  patterns: string[];
  privatePatterns: string[];
  privatefilesHash: string | null;
  hashCache: Record<string, HashEntry>;
}

interface HashEntry {
  hash: string;
  mtime: number;
  size: number;
}

interface LocalFile {
  path: string;
  hash: string;
  mtime: number;
}

interface SyncConflict {
  type: "both_modified";
  serverHash: string;
  clientHash: string;
  serverMtime: number;
  clientMtime: number;
}

interface SyncResponseFile {
  path: string;
  hash: string | null;
  action: "download" | "upload" | "delete_local" | "conflict";
  conflict?: SyncConflict;
}

interface SyncResponse {
  files: SyncResponseFile[];
  cursor: number;
  syncfilesHash: string;
  privatefilesHash?: string;
}

interface SyncResult {
  uploaded: number;
  downloaded: number;
  deletedLocally: number;
  conflicts: number;
  skipped: number;
  errors: number;
  cursor: number;
  errorDetails: Array<{ path: string; action: string; error: string }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SYNC_IGNORE_NAMES = new Set([
  ".gobi",
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
  ".git",
  ".gitignore",
  ".gitattributes",
  ".vscode",
  ".idea",
  ".cursor",
  ".claude",
  "node_modules",
  ".npm",
  ".yarn",
  "__pycache__",
  ".env",
  "venv",
  ".venv",
  ".Spotlight-V100",
  ".Trashes",
  ".fseventsd",
]);

const SYNC_IGNORE_EXTENSIONS = new Set([".pyc", ".tmp", ".temp"]);

// ─── Ignore Patterns ──────────────────────────────────────────────────────────

export function isSyncIgnored(relativePath: string): boolean {
  const parts = relativePath.split("/");
  for (const part of parts) {
    if (SYNC_IGNORE_NAMES.has(part)) return true;
    const ext = extname(part).toLowerCase();
    if (ext && SYNC_IGNORE_EXTENSIONS.has(ext)) return true;
    if (part.startsWith("._")) return true; // macOS resource forks
  }
  return false;
}

// ─── State (SQLite) ───────────────────────────────────────────────────────────

const EMPTY_STATE: SyncState = {
  cursor: null,
  syncfilesHash: null,
  patterns: [],
  privatePatterns: [],
  privatefilesHash: null,
  hashCache: {},
};

function openDb(gobiDir: string): Database.Database {
  const db = new Database(join(gobiDir, "sync.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hash_cache (
      path  TEXT PRIMARY KEY,
      hash  TEXT NOT NULL,
      mtime REAL NOT NULL,
      size  INTEGER NOT NULL
    );
  `);
  return db;
}

export function loadSyncState(gobiDir: string): SyncState {
  // One-time migration from legacy sync_state.json
  const jsonPath = join(gobiDir, "sync_state.json");
  if (existsSync(jsonPath)) {
    try {
      const parsed = JSON.parse(readFileSync(jsonPath, "utf-8")) as Partial<SyncState>;
      const state: SyncState = {
        cursor: parsed.cursor ?? null,
        syncfilesHash: parsed.syncfilesHash ?? null,
        patterns: parsed.patterns ?? [],
        privatePatterns: parsed.privatePatterns ?? [],
        privatefilesHash: parsed.privatefilesHash ?? null,
        hashCache: parsed.hashCache ?? {},
      };
      saveSyncState(gobiDir, state);
      rmSync(jsonPath);
      return state;
    } catch {
      rmSync(jsonPath, { force: true });
      return { ...EMPTY_STATE, hashCache: {} };
    }
  }

  const db = openDb(gobiDir);
  try {
    const meta = db.prepare("SELECT key, value FROM sync_meta").all() as Array<{ key: string; value: string }>;
    const metaMap = Object.fromEntries(meta.map((r) => [r.key, r.value]));

    const rows = db.prepare("SELECT path, hash, mtime, size FROM hash_cache").all() as Array<{
      path: string; hash: string; mtime: number; size: number;
    }>;
    const hashCache: SyncState["hashCache"] = {};
    for (const row of rows) {
      hashCache[row.path] = { hash: row.hash, mtime: row.mtime, size: row.size };
    }

    return {
      cursor: metaMap.cursor ? Number(metaMap.cursor) : EMPTY_STATE.cursor,
      syncfilesHash: metaMap.syncfiles_hash || EMPTY_STATE.syncfilesHash,
      patterns: metaMap.patterns ? (JSON.parse(metaMap.patterns) as string[]) : EMPTY_STATE.patterns,
      privatePatterns: metaMap.private_patterns ? (JSON.parse(metaMap.private_patterns) as string[]) : EMPTY_STATE.privatePatterns,
      privatefilesHash: metaMap.privatefiles_hash || EMPTY_STATE.privatefilesHash,
      hashCache,
    };
  } finally {
    db.close();
  }
}

export function saveSyncState(gobiDir: string, state: SyncState): void {
  const db = openDb(gobiDir);
  try {
    db.transaction(() => {
      const upsert = db.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)");
      upsert.run("cursor", state.cursor !== null ? String(state.cursor) : "");
      upsert.run("syncfiles_hash", state.syncfilesHash ?? "");
      upsert.run("patterns", JSON.stringify(state.patterns));
      upsert.run("private_patterns", JSON.stringify(state.privatePatterns));
      upsert.run("privatefiles_hash", state.privatefilesHash ?? "");

      db.exec("DELETE FROM hash_cache");
      const insert = db.prepare("INSERT INTO hash_cache (path, hash, mtime, size) VALUES (?, ?, ?, ?)");
      for (const [path, entry] of Object.entries(state.hashCache)) {
        insert.run(path, entry.hash, entry.mtime, entry.size);
      }
    })();
  } finally {
    db.close();
  }
}

// ─── Syncfiles ────────────────────────────────────────────────────────────────

export function readSyncfiles(gobiDir: string): { patterns: string[]; contentHash: string } {
  const syncfilesPath = join(gobiDir, "syncfiles");
  if (!existsSync(syncfilesPath)) {
    return { patterns: [], contentHash: "" };
  }
  const content = readFileSync(syncfilesPath, "utf-8");
  const patterns = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  const contentHash = createHash("md5").update(content).digest("hex");
  return { patterns, contentHash };
}

export function readPrivatefiles(gobiDir: string): string[] {
  const path = join(gobiDir, "privatefiles");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

export function buildWhitelistMatcher(patterns: string[]): (path: string) => boolean {
  if (patterns.length === 0) return () => false;
  const ig = ignore().add(patterns);
  return (filePath: string) => ig.ignores(filePath.replace(/\\/g, "/"));
}

export function computeSyncfilesChanges(
  prevPatterns: string[],
  currPatterns: string[],
): { added: string[]; removed: string[] } {
  const prevSet = new Set(prevPatterns);
  const currSet = new Set(currPatterns);
  return {
    added: currPatterns.filter((p) => !prevSet.has(p)),
    removed: prevPatterns.filter((p) => !currSet.has(p)),
  };
}

// ─── Hashing ──────────────────────────────────────────────────────────────────

export function md5Hex(content: Buffer): string {
  return createHash("md5").update(content).digest("hex");
}

function hashFile(
  absPath: string,
  relPath: string,
  cache: SyncState["hashCache"],
): HashEntry {
  const stat = statSync(absPath);
  const cached = cache[relPath];
  if (cached && cached.mtime === stat.mtimeMs && cached.size === stat.size) {
    return cached;
  }
  const content = readFileSync(absPath);
  return { hash: md5Hex(content), mtime: stat.mtimeMs, size: stat.size };
}

// ─── File Walking ─────────────────────────────────────────────────────────────

function walkDir(dir: string, base: string, results: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (isSyncIgnored(relPath)) continue;
    if (entry.isDirectory()) {
      walkDir(join(dir, entry.name), relPath, results);
    } else if (entry.isFile()) {
      results.push(relPath);
    }
  }
}

function walkLocalFiles(
  vaultDir: string,
  cache: SyncState["hashCache"],
  isWhitelisted: (path: string) => boolean,
): LocalFile[] {
  const allRelPaths: string[] = [];
  walkDir(vaultDir, "", allRelPaths);

  const files: LocalFile[] = [];
  for (const relPath of allRelPaths) {
    if (!isWhitelisted(relPath)) continue;
    const absPath = join(vaultDir, relPath);
    try {
      const entry = hashFile(absPath, relPath, cache);
      files.push({ path: relPath, hash: entry.hash, mtime: entry.mtime });
      // Update cache in-place
      cache[relPath] = entry;
    } catch {
      // File may have been removed between walk and hash; skip it
    }
  }
  return files;
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

function fileUrl(baseUrl: string, vaultSlug: string, filePath: string): string {
  const encoded = filePath
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `${baseUrl}/api/v1/vaults/${vaultSlug}/file/${encoded}`;
}

async function webdriveGet(
  baseUrl: string,
  vaultSlug: string,
  filePath: string,
  token: string,
): Promise<Buffer> {
  const res = await fetch(fileUrl(baseUrl, vaultSlug, filePath), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function webdrivePut(
  baseUrl: string,
  vaultSlug: string,
  filePath: string,
  content: Buffer,
  hash: string,
  token: string,
): Promise<number | null> {
  const res = await fetch(fileUrl(baseUrl, vaultSlug, filePath), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "X-Content-MD5": hash,
    },
    body: new Uint8Array(content),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  const cursor = res.headers.get("x-cursor");
  return cursor ? Number(cursor) : null;
}

async function webdriveDelete(
  baseUrl: string,
  vaultSlug: string,
  filePath: string,
  token: string,
): Promise<number | null> {
  const res = await fetch(fileUrl(baseUrl, vaultSlug, filePath), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  const cursor = res.headers.get("x-cursor");
  return cursor ? Number(cursor) : null;
}

async function webdriveSync(
  baseUrl: string,
  vaultSlug: string,
  body: {
    cursor: number | null;
    syncfilesChanges: { added: string[]; removed: string[] };
    clientFiles: LocalFile[];
    uploadOnly?: boolean;
    downloadOnly?: boolean;
  },
  token: string,
): Promise<SyncResponse> {
  const url = `${baseUrl}/api/v1/vaults/${vaultSlug}/sync`;
  process.stderr.write(`[gobi-sync] syncfiles: body=${JSON.stringify(body)}\n`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 409) {
      const err = new GobiError("Sync cursor invalid", "SYNC_CURSOR_INVALID");
      (err as GobiError & { status: number }).status = 409;
      throw err;
    }
    throw new Error(`Sync request failed: HTTP ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as SyncResponse;
}


// ─── Conflict Resolution ──────────────────────────────────────────────────────

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

async function resolveConflict(
  filePath: string,
  strategy: ConflictStrategy,
  conflict: SyncConflict | undefined,
  jsonMode: boolean,
): Promise<"server" | "client" | "skip"> {
  if (strategy === "server") return "server";
  if (strategy === "client") return "client";
  if (strategy === "skip") return "skip";

  // strategy === "ask"
  if (jsonMode) {
    // Can't show interactive prompt in JSON mode
    return "skip";
  }

  const serverTime = conflict ? formatDate(conflict.serverMtime) : "unknown";
  const clientTime = conflict ? formatDate(conflict.clientMtime) : "unknown";

  const { choice } = await inquirer.prompt<{ choice: "server" | "client" | "skip" }>([
    {
      type: "list",
      name: "choice",
      message: `Conflict: ${filePath}\n  Server modified: ${serverTime}\n  Local  modified: ${clientTime}`,
      choices: [
        { name: "Keep server version (overwrite local)", value: "server" },
        { name: "Keep local version (skip download)", value: "client" },
        { name: "Skip (resolve later)", value: "skip" },
      ],
    },
  ]);
  return choice;
}

// ─── Path Filtering ──────────────────────────────────────────────────────────

/**
 * Returns true if filePath is at or under any of the specified paths.
 * An empty paths array matches everything.
 */
function matchesPaths(filePath: string, paths: string[]): boolean {
  if (paths.length === 0) return true;
  const normalized = filePath.replace(/\\/g, "/");
  for (const p of paths) {
    const np = p.replace(/\\/g, "/").replace(/\/+$/, "");
    if (normalized === np || normalized.startsWith(np + "/")) return true;
  }
  return false;
}

// ─── Core Sync ────────────────────────────────────────────────────────────────

async function performSync(
  baseUrl: string,
  vaultSlug: string,
  state: SyncState,
  syncfilesChanges: { added: string[]; removed: string[] },
  privatefilesChanges: { added: string[]; removed: string[] },
  localFiles: LocalFile[],
  opts: SyncOptions,
  token: string,
): Promise<SyncResponse> {
  const body = {
    cursor: state.cursor,
    // dryRun: don't mutate server-side syncfiles/privatefiles
    syncfilesChanges: opts.dryRun ? { added: [], removed: [] } : syncfilesChanges,
    privatefilesChanges: opts.dryRun ? { added: [], removed: [] } : privatefilesChanges,
    clientFiles: localFiles,
    uploadOnly: opts.uploadOnly,
    downloadOnly: opts.downloadOnly,
  };
  return await webdriveSync(baseUrl, vaultSlug, body, token);
}

export async function runSync(opts: SyncOptions): Promise<void> {
  const { vaultSlug, dir: vaultDir, jsonMode } = opts;
  const baseUrl = opts.webdriveUrl ?? WEBDRIVE_BASE_URL;
  const gobiDir = join(vaultDir, ".gobi");
  mkdirSync(gobiDir, { recursive: true });

  const state = loadSyncState(gobiDir);

  // --full: treat this run as a first-time sync (re-check every file against the server)
  if (opts.full) {
    state.cursor = null;
    state.hashCache = {};
    if (!jsonMode) console.log("Full sync: ignoring cursor and hash cache.");
  }

  const token = opts.authToken ?? (await getValidToken());

  // Read syncfiles whitelist
  const syncfilesExistsLocally = existsSync(join(gobiDir, "syncfiles"));
  const { patterns: currPatterns, contentHash: currSyncfilesHash } = readSyncfiles(gobiDir);
  if (currPatterns.length === 0 && !jsonMode) {
    console.warn(
      "Warning: No patterns found in .gobi/syncfiles. Nothing will be synced.\n" +
        "Add gitignore-style patterns to .gobi/syncfiles to select files for sync.",
    );
  }
  const isWhitelisted = buildWhitelistMatcher(currPatterns);

  let baseSyncPatterns = state.patterns;
  if (state.syncfilesHash === null) {
    // Bootstrap: use empty base so local patterns are sent as "added" only.
    // This avoids spuriously removing server-only patterns from other devices.
    // The server returns its current syncfilesHash, which then triggers a download
    // to pull any server patterns the client doesn't have yet.
    baseSyncPatterns = [];
  } else if (!syncfilesExistsLocally) {
    // File deleted after a prior sync. Produce empty diff to avoid removing patterns
    // from server. The download condition below re-fetches the missing file.
    currPatterns.length = 0;
    currPatterns.push(...state.patterns);
    baseSyncPatterns = [...state.patterns];
  }
  const syncfilesChanges = computeSyncfilesChanges(baseSyncPatterns, currPatterns);

  // Compute privatefiles delta
  const privatefilesExistsLocally = existsSync(join(gobiDir, "privatefiles"));
  const currPrivatePatterns = readPrivatefiles(gobiDir);
  let basePrivatePatterns = state.privatePatterns;
  if (state.privatefilesHash === null) {
    // Bootstrap: same as syncfiles — empty base, rely on hash comparison for download.
    basePrivatePatterns = [];
  } else if (!privatefilesExistsLocally) {
    // File deleted after a prior sync. Produce empty diff.
    basePrivatePatterns = [...currPrivatePatterns];
  }
  const privatefilesChanges = computeSyncfilesChanges(basePrivatePatterns, currPrivatePatterns);

  // Walk local files (only whitelisted, non-ignored)
  if (!jsonMode) process.stdout.write("Scanning local files...");
  const localFiles = walkLocalFiles(vaultDir, state.hashCache, isWhitelisted);
  if (!jsonMode) console.log(` ${localFiles.length} file(s) found.`);

  const localPathSet = new Set(localFiles.map((f) => f.path));

  // Detect and send offline deletions
  let maxMutationCursor: number | null = null;
  for (const cachedPath of Object.keys(state.hashCache)) {
    if (!localPathSet.has(cachedPath) && !existsSync(join(vaultDir, cachedPath))) {
      // File was in our cache but no longer on disk — deleted offline.
      // In download-only mode, skip the DELETE: the server's client_deleted_paths
      // mechanism will re-download the file instead (server-side download_only path).
      if (opts.downloadOnly) continue;
      if (!opts.jsonMode) console.log(`  Deleting remote (offline deletion): ${cachedPath}`);
      if (!opts.dryRun) {
        try {
          const cursor = await webdriveDelete(baseUrl, vaultSlug, cachedPath, token);
          if (cursor !== null && (maxMutationCursor === null || cursor > maxMutationCursor)) {
            maxMutationCursor = cursor;
          }
        } catch (err) {
          if (!jsonMode)
            console.error(`  Error deleting remote ${cachedPath}: ${(err as Error).message}`);
        }
        delete state.hashCache[cachedPath];
      }
    }
  }

  // In dry-run mode, include cached-but-locally-deleted files in clientFiles so the
  // server does not propagate the deletion (the whole point of dry-run is no changes).
  const clientFilesForSync: LocalFile[] = opts.dryRun
    ? [
        ...localFiles,
        ...Object.entries(state.hashCache)
          .filter(([p]) => !localPathSet.has(p) && !existsSync(join(vaultDir, p)))
          .map(([path, entry]) => ({ path, hash: entry.hash, mtime: entry.mtime })),
      ]
    : localFiles;

  // POST sync request
  if (!jsonMode) process.stdout.write("Syncing with server...");
  let syncResp: SyncResponse;
  try {
    syncResp = await performSync(baseUrl, vaultSlug, state, syncfilesChanges, privatefilesChanges, clientFilesForSync, opts, token);
  } catch (err) {
    if (err instanceof GobiError && (err as GobiError & { status?: number }).status === 409) {
      // Cursor is stale (server wiped the vault or syncfiles are missing).
      // Reset all state including patterns so the retry re-registers current patterns
      // as "added" — this allows vault resurrection after the server deleted an empty vault.
      if (!jsonMode) console.log("Sync cursor stale, resetting state and retrying...");
      state.cursor = null;
      state.hashCache = {};
      state.patterns = [];  // reset so retry sends currPatterns as syncfilesChanges.added
      state.privatePatterns = [];  // reset so retry sends currPrivatePatterns as privatefilesChanges.added
      const retryChanges = computeSyncfilesChanges([], currPatterns);
      const retryPrivateChanges = computeSyncfilesChanges([], currPrivatePatterns);
      syncResp = await performSync(baseUrl, vaultSlug, state, retryChanges, retryPrivateChanges, clientFilesForSync, opts, token);
    } else {
      throw err;
    }
  }
  if (!jsonMode) console.log(` ${syncResp.files.length} action(s).`);

  // Process actions
  let uploaded = 0,
    downloaded = 0,
    deletedLocally = 0,
    conflicts = 0,
    skipped = 0,
    errors = 0;
  const errorDetails: SyncResult["errorDetails"] = [];
  const conflictWarnings: string[] = [];

  const filterPaths = opts.paths ?? [];

  for (const entry of syncResp.files) {
    // --path: skip actions for files outside the specified scope
    if (!matchesPaths(entry.path, filterPaths)) continue;
    try {
      const absPath = join(vaultDir, entry.path);

      if (entry.action === "upload") {
        if (opts.downloadOnly) continue;
        if (opts.dryRun) {
          if (!jsonMode) console.log(`  [dry-run] would upload: ${entry.path}`);
          uploaded++;
          continue;
        }
        const content = readFileSync(absPath);
        const hash = md5Hex(content);
        const cursor = await webdrivePut(baseUrl, vaultSlug, entry.path, content, hash, token);
        if (cursor !== null && (maxMutationCursor === null || cursor > maxMutationCursor)) {
          maxMutationCursor = cursor;
        }
        state.hashCache[entry.path] = {
          hash,
          mtime: statSync(absPath).mtimeMs,
          size: content.length,
        };
        if (!jsonMode) console.log(`  Uploaded: ${entry.path}`);
        uploaded++;
      } else if (entry.action === "download") {
        if (opts.uploadOnly) continue;
        if (opts.dryRun) {
          if (!jsonMode) console.log(`  [dry-run] would download: ${entry.path}`);
          downloaded++;
          continue;
        }
        const content = await webdriveGet(baseUrl, vaultSlug, entry.path, token);
        mkdirSync(dirname(absPath), { recursive: true });
        await writeFile(absPath, content);
        const hash = md5Hex(content);
        state.hashCache[entry.path] = {
          hash,
          mtime: statSync(absPath).mtimeMs,
          size: content.length,
        };
        if (!jsonMode) console.log(`  Downloaded: ${entry.path}`);
        downloaded++;
      } else if (entry.action === "delete_local") {
        if (opts.uploadOnly) continue;
        if (!existsSync(absPath)) continue;
        if (opts.dryRun) {
          if (!jsonMode) console.log(`  [dry-run] would delete local: ${entry.path}`);
          deletedLocally++;
          continue;
        }
        await trash(absPath);
        delete state.hashCache[entry.path];
        if (!jsonMode) console.log(`  Deleted local (moved to trash): ${entry.path}`);
        deletedLocally++;
      } else if (entry.action === "conflict") {
        conflicts++;
        const choice = await resolveConflict(
          entry.path,
          opts.conflict,
          entry.conflict,
          jsonMode,
        );
        if (choice === "server") {
          if (opts.dryRun) {
            if (!jsonMode) console.log(`  [dry-run] would download (conflict→server): ${entry.path}`);
          } else {
            const content = await webdriveGet(baseUrl, vaultSlug, entry.path, token);
            mkdirSync(dirname(absPath), { recursive: true });
            await writeFile(absPath, content);
            const hash = md5Hex(content);
            state.hashCache[entry.path] = {
              hash,
              mtime: statSync(absPath).mtimeMs,
              size: content.length,
            };
            if (!jsonMode) console.log(`  Conflict resolved (server): ${entry.path}`);
          }
          downloaded++;
        } else if (choice === "client") {
          if (!jsonMode) console.log(`  Conflict resolved (local kept): ${entry.path}`);
        } else {
          skipped++;
          const warning = `Conflict skipped (resolve later): ${entry.path}`;
          conflictWarnings.push(warning);
          if (!jsonMode) console.log(`  ${warning}`);
        }
      }
    } catch (err) {
      errors++;
      const msg = (err as Error).message;
      errorDetails.push({ path: entry.path, action: entry.action, error: msg });
      if (!jsonMode) console.error(`  Error [${entry.action}] ${entry.path}: ${msg}`);
    }
  }

  // Download syncfiles from server if the server's hash changed since last sync
  let effectivePatterns = currPatterns;
  process.stderr.write(`[gobi-sync] syncfiles: state=${state.syncfilesHash ?? "null"} server=${syncResp.syncfilesHash ?? "null"}\n`);
  if (!opts.dryRun && !opts.uploadOnly && syncResp.syncfilesHash && (syncResp.syncfilesHash !== state.syncfilesHash || !syncfilesExistsLocally)) {
    process.stderr.write(`[gobi-sync] syncfiles hash changed — downloading from server\n`);
    try {
      const syncfilesContent = await webdriveGet(baseUrl, vaultSlug, ".gobi/syncfiles", token);
      await writeFile(join(gobiDir, "syncfiles"), syncfilesContent);
      const { patterns: newPatterns } = readSyncfiles(gobiDir);
      effectivePatterns = newPatterns;
      process.stderr.write(`[gobi-sync] syncfiles downloaded OK, patterns=${JSON.stringify(newPatterns)}\n`);
      if (!jsonMode) console.log("  Updated local syncfiles from server.");
    } catch (err) {
      process.stderr.write(`[gobi-sync] syncfiles download FAILED: ${(err as Error).message}\n`);
      if (!jsonMode)
        console.error(
          `Warning: Failed to download syncfiles from server: ${(err as Error).message}`,
        );
    }
  }

  // Download privatefiles from server if the server's hash changed since last sync
  let effectivePrivatePatterns = currPrivatePatterns;
  process.stderr.write(`[gobi-sync] privatefiles: state=${state.privatefilesHash ?? "null"} server=${syncResp.privatefilesHash ?? "null"}\n`);
  if (!opts.dryRun && !opts.uploadOnly && syncResp.privatefilesHash && (syncResp.privatefilesHash !== state.privatefilesHash || !privatefilesExistsLocally)) {
    process.stderr.write(`[gobi-sync] privatefiles hash changed — downloading from server\n`);
    try {
      const privatefilesContent = await webdriveGet(baseUrl, vaultSlug, ".gobi/privatefiles", token);
      await writeFile(join(gobiDir, "privatefiles"), privatefilesContent);
      effectivePrivatePatterns = readPrivatefiles(gobiDir);
      process.stderr.write(`[gobi-sync] privatefiles downloaded OK, patterns=${JSON.stringify(effectivePrivatePatterns)}\n`);
      if (!jsonMode) console.log("  Updated local privatefiles from server.");
    } catch (err) {
      process.stderr.write(`[gobi-sync] privatefiles download FAILED: ${(err as Error).message}\n`);
      if (!jsonMode)
        console.error(
          `Warning: Failed to download privatefiles from server: ${(err as Error).message}`,
        );
    }
  }

  // Persist state (always, even on partial failures)
  const finalCursor = Math.max(
    syncResp.cursor,
    maxMutationCursor !== null ? maxMutationCursor : 0,
  );
  state.cursor = finalCursor;
  state.syncfilesHash = syncResp.syncfilesHash || currSyncfilesHash;
  // If the server returned an empty syncfilesHash the vault was deleted server-side
  // (empty patterns path). Reset patterns so the next sync re-registers them as "added",
  // which lets the 409 retry resurrect the vault.
  state.patterns = syncResp.syncfilesHash === "" ? [] : effectivePatterns;
  state.privatePatterns = effectivePrivatePatterns;
  state.privatefilesHash = syncResp.privatefilesHash || state.privatefilesHash;
  saveSyncState(gobiDir, state);

  // Output summary
  const result: SyncResult = {
    uploaded,
    downloaded,
    deletedLocally,
    conflicts,
    skipped,
    errors,
    cursor: finalCursor,
    errorDetails,
  };

  if (jsonMode) {
    if (conflictWarnings.length > 0 && opts.conflict === "ask") {
      (result as SyncResult & { conflictWarning: string }).conflictWarning =
        "Interactive conflict resolution skipped in JSON mode. Conflicts were skipped.";
    }
    jsonOut(result);
  } else {
    const conflictSuffix = skipped > 0 ? ` (${skipped} skipped)` : "";
    console.log("\nSync complete.");
    console.log(`  Uploaded:      ${uploaded}`);
    console.log(`  Downloaded:    ${downloaded}`);
    console.log(`  Deleted local: ${deletedLocally}`);
    console.log(`  Conflicts:     ${conflicts}${conflictSuffix}`);
    console.log(`  Errors:        ${errors}`);
    if (errors > 0) {
      process.exitCode = 1;
    }
  }
}

// ─── Commander Registration ───────────────────────────────────────────────────

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Sync local vault files with Gobi Webdrive.")
    .option("--upload-only", "Only upload local changes to server")
    .option("--download-only", "Only download server changes to local")
    .option(
      "--conflict <strategy>",
      "Conflict resolution strategy: ask|server|client|skip",
      "ask",
    )
    .option("--dir <path>", "Local vault directory (default: current directory)")
    .option("--dry-run", "Preview changes without making them")
    .option("--full", "Full sync: ignore cursor and hash cache, re-check every file")
    .option(
      "--path <path>",
      "Restrict sync to a specific file or folder (repeatable)",
      (v: string, prev: string[]) => prev.concat(v),
      [] as string[],
    )
    .action(async function (this: Command, opts: {
      uploadOnly?: boolean;
      downloadOnly?: boolean;
      conflict: string;
      dir?: string;
      dryRun?: boolean;
      full?: boolean;
      path?: string[];
    }) {
      if (opts.uploadOnly && opts.downloadOnly) {
        throw new GobiError(
          "--upload-only and --download-only are mutually exclusive.",
          "INVALID_OPTION",
        );
      }
      const validStrategies = ["ask", "server", "client", "skip"];
      if (!validStrategies.includes(opts.conflict)) {
        throw new GobiError(
          `Invalid --conflict value "${opts.conflict}". Use: ask|server|client|skip`,
          "INVALID_OPTION",
        );
      }
      const vaultSlug = getVaultSlug();
      const dir = opts.dir ? pathResolve(opts.dir) : process.cwd();

      await runSync({
        vaultSlug,
        dir,
        uploadOnly: !!opts.uploadOnly,
        downloadOnly: !!opts.downloadOnly,
        conflict: opts.conflict as ConflictStrategy,
        dryRun: !!opts.dryRun,
        full: !!opts.full,
        paths: opts.path ?? [],
        jsonMode: isJsonMode(this),
      });
    });
}
