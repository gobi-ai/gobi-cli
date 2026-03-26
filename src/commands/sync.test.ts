import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  statSync,
} from "fs";
import { join, dirname, resolve } from "path";
import { tmpdir } from "os";
import { spawn } from "child_process";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

import {
  isSyncIgnored,
  buildWhitelistMatcher,
  computeSyncfilesChanges,
  md5Hex,
  loadSyncState,
  saveSyncState,
  readSyncfiles,
  readPrivatefiles,
  runSync,
} from "./sync.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ensures at least 1ms passes so DB timestamps (int ms) are strictly ordered. */
function sleep(ms = 5): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(__dirname, "../../../../gobi-webdrive/scripts/start_test_webdrive.py");

function makeTempVault(syncfilesContent = ""): {
  vaultDir: string;
  gobiDir: string;
  cleanup: () => void;
} {
  const vaultDir = mkdtempSync(join(tmpdir(), "gobi-sync-test-"));
  const gobiDir = join(vaultDir, ".gobi");
  mkdirSync(gobiDir);
  if (syncfilesContent) {
    writeFileSync(join(gobiDir, "syncfiles"), syncfilesContent);
  }
  return {
    vaultDir,
    gobiDir,
    cleanup: () => rmSync(vaultDir, { recursive: true, force: true }),
  };
}

function makeVaultSlug(): string {
  return `test-vault-${createHash("md5").update(String(Date.now() + Math.random())).digest("hex").slice(0, 8)}`;
}

async function startWebdriveServer(): Promise<{ url: string; token: string; kill: () => void }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3.11", [SCRIPT_PATH]);
    let resolved = false;
    let buf = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      if (resolved) return;
      buf += chunk.toString();
      const lines = buf.split("\n").map((l) => l.trim()).filter(Boolean);
      // Wait for both port and token lines
      if (lines.length >= 2) {
        resolved = true;
        const [port, token] = lines;
        resolve({ url: `http://127.0.0.1:${port}`, token, kill: () => proc.kill() });
      }
    });

    proc.stderr.on("data", (d: Buffer) => {
      process.stderr.write("[webdrive] " + d.toString());
    });

    proc.on("error", (err) => {
      if (!resolved) { resolved = true; reject(err); }
    });

    proc.on("exit", (code) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Server process exited with code ${code} before printing port/token`));
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        reject(new Error("Webdrive server startup timed out after 10s"));
      }
    }, 10_000);
  });
}

// Direct HTTP helper for setting up server-side state in integration tests
async function serverPut(
  baseUrl: string,
  vaultSlug: string,
  filePath: string,
  content: string,
  token: string,
): Promise<void> {
  const buf = Buffer.from(content);
  const hash = createHash("md5").update(buf).digest("hex");
  const encoded = filePath
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  const res = await fetch(`${baseUrl}/api/v1/vaults/${vaultSlug}/files/${encoded}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "X-Content-MD5": hash,
    },
    body: new Uint8Array(buf),
  });
  if (!res.ok) throw new Error(`serverPut failed: ${res.status} ${await res.text()}`);
}

async function serverGet(
  baseUrl: string,
  vaultSlug: string,
  filePath: string,
  token: string,
): Promise<string> {
  const encoded = filePath
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  const res = await fetch(`${baseUrl}/api/v1/vaults/${vaultSlug}/files/${encoded}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`serverGet failed: ${res.status}`);
  return res.text();
}

async function serverDelete(
  baseUrl: string,
  vaultSlug: string,
  filePath: string,
  token: string,
): Promise<void> {
  const encoded = filePath
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  const res = await fetch(`${baseUrl}/api/v1/vaults/${vaultSlug}/files/${encoded}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404)
    throw new Error(`serverDelete failed: ${res.status}`);
}

async function serverPostPrivatefiles(
  baseUrl: string,
  vaultSlug: string,
  patterns: string[],
  token: string,
): Promise<{ privatefilesHash: string; patterns: string[] }> {
  const res = await fetch(`${baseUrl}/api/v1/vaults/${vaultSlug}/privatefiles`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ patterns }),
  });
  if (!res.ok) throw new Error(`serverPostPrivatefiles failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ privatefilesHash: string; patterns: string[] }>;
}

// ─── A. Pure function tests (no I/O) ──────────────────────────────────────────

describe("isSyncIgnored", () => {
  it("ignores .gobi directory", () => {
    assert.ok(isSyncIgnored(".gobi/sync_state.json"));
  });
  it("ignores nested node_modules", () => {
    assert.ok(isSyncIgnored("src/node_modules/lodash/index.js"));
  });
  it("ignores .DS_Store at root", () => {
    assert.ok(isSyncIgnored(".DS_Store"));
  });
  it("ignores .DS_Store nested", () => {
    assert.ok(isSyncIgnored("notes/.DS_Store"));
  });
  it("ignores .pyc extension", () => {
    assert.ok(isSyncIgnored("app/__pycache__/mod.cpython-311.pyc"));
  });
  it("ignores .pyc at root level", () => {
    assert.ok(isSyncIgnored("script.pyc"));
  });
  it("ignores macOS resource forks (._)", () => {
    assert.ok(isSyncIgnored("._notes"));
  });
  it("ignores .git directory", () => {
    assert.ok(isSyncIgnored(".git/HEAD"));
  });
  it("ignores venv directory", () => {
    assert.ok(isSyncIgnored("venv/lib/python3.11/site-packages/flask/__init__.py"));
  });
  it("does NOT ignore regular markdown files", () => {
    assert.ok(!isSyncIgnored("notes/daily.md"));
  });
  it("does NOT ignore README.md", () => {
    assert.ok(!isSyncIgnored("README.md"));
  });
  it("does NOT ignore nested regular files", () => {
    assert.ok(!isSyncIgnored("projects/gobi/src/main.ts"));
  });
});

describe("buildWhitelistMatcher", () => {
  it("empty patterns → always false", () => {
    const m = buildWhitelistMatcher([]);
    assert.ok(!m("notes/daily.md"));
    assert.ok(!m("README.md"));
  });

  it("/notes/ pattern matches files under notes/", () => {
    const m = buildWhitelistMatcher(["/notes/"]);
    assert.ok(m("notes/daily.md"));
    assert.ok(m("notes/sub/file.md"));
  });

  it("/notes/ pattern does NOT match docs/", () => {
    const m = buildWhitelistMatcher(["/notes/"]);
    assert.ok(!m("docs/readme.md"));
  });

  it("multiple patterns: either match includes the file", () => {
    const m = buildWhitelistMatcher(["/notes/", "/docs/"]);
    assert.ok(m("notes/daily.md"));
    assert.ok(m("docs/readme.md"));
    assert.ok(!m("projects/x.md"));
  });

  it("/docs/*.md matches direct children only", () => {
    const m = buildWhitelistMatcher(["/docs/*.md"]);
    assert.ok(m("docs/readme.md"));
    // double-star would be needed for deep match; single * stops at /
    assert.ok(!m("docs/sub/readme.md"));
  });
});

describe("computeSyncfilesChanges", () => {
  it("both empty → no changes", () => {
    const r = computeSyncfilesChanges([], []);
    assert.deepEqual(r, { added: [], removed: [] });
  });

  it("new pattern → shows in added", () => {
    const r = computeSyncfilesChanges([], ["/notes/"]);
    assert.deepEqual(r, { added: ["/notes/"], removed: [] });
  });

  it("removed pattern → shows in removed", () => {
    const r = computeSyncfilesChanges(["/notes/"], []);
    assert.deepEqual(r, { added: [], removed: ["/notes/"] });
  });

  it("mixed changes", () => {
    const r = computeSyncfilesChanges(["/notes/", "/old/"], ["/notes/", "/new/"]);
    assert.deepEqual(r.added, ["/new/"]);
    assert.deepEqual(r.removed, ["/old/"]);
  });

  it("unchanged patterns → both empty", () => {
    const r = computeSyncfilesChanges(["/notes/"], ["/notes/"]);
    assert.deepEqual(r, { added: [], removed: [] });
  });
});

describe("md5Hex", () => {
  it("deterministic: same content → same hash", () => {
    const buf = Buffer.from("hello world");
    assert.equal(md5Hex(buf), md5Hex(buf));
    assert.equal(md5Hex(buf), md5Hex(Buffer.from("hello world")));
  });

  it("different content → different hash", () => {
    assert.notEqual(md5Hex(Buffer.from("a")), md5Hex(Buffer.from("b")));
  });

  it("empty buffer → known MD5", () => {
    assert.equal(md5Hex(Buffer.alloc(0)), "d41d8cd98f00b204e9800998ecf8427e");
  });

  it("returns 32-char lowercase hex", () => {
    const h = md5Hex(Buffer.from("test"));
    assert.equal(h.length, 32);
    assert.match(h, /^[0-9a-f]{32}$/);
  });
});

// ─── B. State I/O tests ───────────────────────────────────────────────────────

describe("loadSyncState / saveSyncState", () => {
  it("missing file → returns empty default without throwing", () => {
    const { gobiDir, cleanup } = makeTempVault();
    try {
      const state = loadSyncState(gobiDir);
      assert.equal(state.cursor, null);
      assert.deepEqual(state.patterns, []);
      assert.deepEqual(state.hashCache, {});
    } finally {
      cleanup();
    }
  });

  it("legacy sync_state.json migrated to SQLite on first load", () => {
    const { gobiDir, cleanup } = makeTempVault();
    try {
      const legacy = {
        cursor: 999,
        syncfilesHash: "oldhash",
        patterns: ["/notes/"],
        hashCache: { "notes/x.md": { hash: "aabbcc", mtime: 1700000000000, size: 10 } },
      };
      writeFileSync(join(gobiDir, "sync_state.json"), JSON.stringify(legacy));
      const state = loadSyncState(gobiDir);
      assert.equal(state.cursor, 999);
      assert.deepEqual(state.patterns, ["/notes/"]);
      assert.deepEqual(state.hashCache["notes/x.md"].hash, "aabbcc");
      // JSON file should be gone after migration
      assert.ok(!existsSync(join(gobiDir, "sync_state.json")));
      // SQLite DB should now exist
      assert.ok(existsSync(join(gobiDir, "sync.db")));
    } finally {
      cleanup();
    }
  });

  it("roundtrip: save then load returns identical state", () => {
    const { gobiDir, cleanup } = makeTempVault();
    try {
      const original = {
        cursor: 1234567890,
        syncfilesHash: "abc123",
        patterns: ["/notes/", "/docs/"],
        privatePatterns: ["/private/"],
        privatefilesHash: "def456",
        hashCache: {
          "notes/a.md": { hash: "deadbeef", mtime: 1700000000000, size: 42 },
        },
      };
      saveSyncState(gobiDir, original);
      const loaded = loadSyncState(gobiDir);
      assert.deepEqual(loaded, original);
    } finally {
      cleanup();
    }
  });
});

describe("readSyncfiles", () => {
  it("missing syncfiles → empty patterns, empty hash", () => {
    const { gobiDir, cleanup } = makeTempVault();
    try {
      const result = readSyncfiles(gobiDir);
      assert.deepEqual(result.patterns, []);
      assert.equal(result.contentHash, "");
    } finally {
      cleanup();
    }
  });

  it("strips comment lines and blank lines", () => {
    const { gobiDir, cleanup } = makeTempVault(
      "# This is a comment\n\n/notes/\n\n# another comment\n/docs/\n",
    );
    try {
      const result = readSyncfiles(gobiDir);
      assert.deepEqual(result.patterns, ["/notes/", "/docs/"]);
    } finally {
      cleanup();
    }
  });

  it("returns deterministic contentHash", () => {
    const content = "/notes/\n/docs/\n";
    const { gobiDir, cleanup } = makeTempVault(content);
    try {
      const r1 = readSyncfiles(gobiDir);
      const r2 = readSyncfiles(gobiDir);
      assert.equal(r1.contentHash, r2.contentHash);
      assert.ok(r1.contentHash.length === 32); // MD5 hex
    } finally {
      cleanup();
    }
  });

  it("different content → different hash", () => {
    const { gobiDir: d1, cleanup: c1 } = makeTempVault("/notes/\n");
    const { gobiDir: d2, cleanup: c2 } = makeTempVault("/docs/\n");
    try {
      assert.notEqual(readSyncfiles(d1).contentHash, readSyncfiles(d2).contentHash);
    } finally {
      c1();
      c2();
    }
  });
});

describe("readPrivatefiles", () => {
  it("missing privatefiles → empty array", () => {
    const { gobiDir, cleanup } = makeTempVault();
    try {
      assert.deepEqual(readPrivatefiles(gobiDir), []);
    } finally {
      cleanup();
    }
  });

  it("strips comment lines and blank lines", () => {
    const { gobiDir, cleanup } = makeTempVault();
    try {
      writeFileSync(
        join(gobiDir, "privatefiles"),
        "# This is a comment\n\n/secret.md\n\n# another comment\n/private/\n",
      );
      assert.deepEqual(readPrivatefiles(gobiDir), ["/secret.md", "/private/"]);
    } finally {
      cleanup();
    }
  });

  it("returns patterns preserving order", () => {
    const { gobiDir, cleanup } = makeTempVault();
    try {
      writeFileSync(join(gobiDir, "privatefiles"), "/z.md\n/a.md\n/m.md\n");
      assert.deepEqual(readPrivatefiles(gobiDir), ["/z.md", "/a.md", "/m.md"]);
    } finally {
      cleanup();
    }
  });

  it("empty file → empty array", () => {
    const { gobiDir, cleanup } = makeTempVault();
    try {
      writeFileSync(join(gobiDir, "privatefiles"), "");
      assert.deepEqual(readPrivatefiles(gobiDir), []);
    } finally {
      cleanup();
    }
  });
});

// ─── C. Integration tests (real webdrive server) ──────────────────────────────

describe("runSync integration (real webdrive server)", { skip: !!process.env.CI }, () => {
  let serverUrl = "";
  let killServer: () => void;
  let testToken = "";

  before(async () => {
    const server = await startWebdriveServer();
    serverUrl = server.url;
    killServer = server.kill;
    testToken = server.token; // generated by Python so it's guaranteed valid
  });

  after(() => {
    killServer();
  });

  it("upload-only: local file is pushed to server", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "a.md"), "hello from client");

      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: true,
        downloadOnly: false,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      const serverContent = await serverGet(serverUrl, slug, "notes/a.md", testToken);
      assert.equal(serverContent, "hello from client");

      const state = loadSyncState(join(vaultDir, ".gobi"));
      assert.ok(state.cursor !== null, "cursor should be set after sync");
      assert.ok(state.hashCache["notes/a.md"] !== undefined, "hash cache should have the file");
    } finally {
      cleanup();
    }
  });

  it("download-only: server file is written to disk", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      // Seed the server directly
      await serverPut(serverUrl, slug, "notes/b.md", "server content", testToken);

      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: false,
        downloadOnly: true,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      const localContent = readFileSync(join(vaultDir, "notes", "b.md"), "utf-8");
      assert.equal(localContent, "server content");
    } finally {
      cleanup();
    }
  });

  it("two-way sync: client A uploads, client B downloads", async () => {
    const slug = makeVaultSlug();
    const { vaultDir: dirA, cleanup: cleanA } = makeTempVault("/notes/\n");
    const { vaultDir: dirB, cleanup: cleanB } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(dirA, "notes"), { recursive: true });
      writeFileSync(join(dirA, "notes", "shared.md"), "from A");

      // Client A uploads
      await runSync({
        vaultSlug: slug,
        dir: dirA,
        uploadOnly: false,
        downloadOnly: false,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      // Client B downloads
      await runSync({
        vaultSlug: slug,
        dir: dirB,
        uploadOnly: false,
        downloadOnly: false,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      const content = readFileSync(join(dirB, "notes", "shared.md"), "utf-8");
      assert.equal(content, "from A");
    } finally {
      cleanA();
      cleanB();
    }
  });

  it("conflict strategy=server: local file is overwritten", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "conflict.md"), "original");

      // Initial upload to establish cursor
      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: true,
        downloadOnly: false,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      // Ensure server-side mutation timestamp is strictly after the cursor
      await sleep();

      // Server gets a newer version (simulating another device)
      await serverPut(serverUrl, slug, "notes/conflict.md", "server wins", testToken);

      // Local also changes (diverge)
      await sleep();
      writeFileSync(join(vaultDir, "notes", "conflict.md"), "local wins");

      // Sync with conflict=server
      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: false,
        downloadOnly: false,
        conflict: "server",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      const local = readFileSync(join(vaultDir, "notes", "conflict.md"), "utf-8");
      assert.equal(local, "server wins");
    } finally {
      cleanup();
    }
  });

  it("conflict strategy=client: local file is kept", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "conflict.md"), "original");

      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: true,
        downloadOnly: false,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      await sleep();
      await serverPut(serverUrl, slug, "notes/conflict.md", "server version", testToken);
      await sleep();
      writeFileSync(join(vaultDir, "notes", "conflict.md"), "my local version");

      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: false,
        downloadOnly: false,
        conflict: "client",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      const local = readFileSync(join(vaultDir, "notes", "conflict.md"), "utf-8");
      assert.equal(local, "my local version");
    } finally {
      cleanup();
    }
  });

  it("delete_local: trashed file no longer exists at original path", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "to-delete.md"), "bye");
      // A keeper file ensures the vault is non-empty after we delete the target,
      // avoiding the server's "empty vault → delete vault" path which loses syncfiles.
      writeFileSync(join(vaultDir, "notes", "keeper.md"), "stays");

      // Upload both files so server knows about them
      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: true,
        downloadOnly: false,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      // Ensure deletion timestamp is strictly after the sync cursor
      await sleep();

      // Delete only the target on server side (another device deleted it).
      // keeper.md remains so the vault dir is not purged.
      await serverDelete(serverUrl, slug, "notes/to-delete.md", testToken);

      // Sync should delete locally
      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: false,
        downloadOnly: false,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      assert.ok(
        !existsSync(join(vaultDir, "notes", "to-delete.md")),
        "file should no longer exist at original path after delete_local",
      );
    } finally {
      cleanup();
    }
  });

  it("offline deletion: deleted local file is removed from server", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "offline-del.md"), "will be deleted");

      // Upload and record in state
      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: true,
        downloadOnly: false,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      // Simulate offline deletion: remove file from disk
      rmSync(join(vaultDir, "notes", "offline-del.md"));

      // Next sync should detect and DELETE from server
      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: false,
        downloadOnly: false,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      // Server should 404 for this file now
      const res = await fetch(
        `${serverUrl}/api/v1/vaults/${slug}/files/${encodeURIComponent("notes/offline-del.md")}`,
        { headers: { Authorization: `Bearer ${testToken}` } },
      );
      assert.equal(res.status, 404, "file should be gone from server after offline deletion sync");
    } finally {
      cleanup();
    }
  });

  it("cursor persistence: second sync uses incremental cursor", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "a.md"), "content");

      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: true,
        downloadOnly: false,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      const state1 = loadSyncState(join(vaultDir, ".gobi"));
      assert.ok(state1.cursor !== null, "cursor should be set after first sync");

      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: true,
        downloadOnly: false,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      const state2 = loadSyncState(join(vaultDir, ".gobi"));
      assert.ok(state2.cursor !== null);
      // Cursor should be >= first cursor (incremental)
      assert.ok(
        state2.cursor! >= state1.cursor!,
        "second cursor should be >= first cursor",
      );
    } finally {
      cleanup();
    }
  });

  it("dry-run: no files uploaded to server", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "dry.md"), "dry run content");

      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: true,
        downloadOnly: false,
        conflict: "skip",
        dryRun: true,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      const res = await fetch(
        `${serverUrl}/api/v1/vaults/${slug}/files/${encodeURIComponent("notes/dry.md")}`,
        { headers: { Authorization: `Bearer ${testToken}` } },
      );
      assert.equal(res.status, 404, "file should NOT be on server after dry-run");
    } finally {
      cleanup();
    }
  });

  it("upload-only skips download actions", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      // Seed server with a file
      await serverPut(serverUrl, slug, "notes/server-only.md", "server only", testToken);

      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: true,
        downloadOnly: false,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      assert.ok(
        !existsSync(join(vaultDir, "notes", "server-only.md")),
        "file should NOT be downloaded in upload-only mode",
      );
    } finally {
      cleanup();
    }
  });

  it("download-only skips upload actions", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "local-only.md"), "local only");

      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: false,
        downloadOnly: true,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      const res = await fetch(
        `${serverUrl}/api/v1/vaults/${slug}/files/${encodeURIComponent("notes/local-only.md")}`,
        { headers: { Authorization: `Bearer ${testToken}` } },
      );
      assert.equal(res.status, 404, "file should NOT be uploaded in download-only mode");
    } finally {
      cleanup();
    }
  });

  it("empty syncfiles: nothing synced, no errors", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault(""); // empty syncfiles
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "ignored.md"), "ignored");

      await runSync({
        vaultSlug: slug,
        dir: vaultDir,
        uploadOnly: false,
        downloadOnly: false,
        conflict: "skip",
        dryRun: false,
        jsonMode: true,
        authToken: testToken,
        webdriveUrl: serverUrl,
      });

      // File should not be on server
      const res = await fetch(
        `${serverUrl}/api/v1/vaults/${slug}/files/${encodeURIComponent("notes/ignored.md")}`,
        { headers: { Authorization: `Bearer ${testToken}` } },
      );
      assert.equal(res.status, 404, "unwhitelisted file should not be on server");
    } finally {
      cleanup();
    }
  });

  // ─── Helper shared across remaining tests ────────────────────────────────────

  function sync(
    slug: string,
    vaultDir: string,
    opts: Partial<Parameters<typeof runSync>[0]> = {},
  ) {
    return runSync({
      vaultSlug: slug,
      dir: vaultDir,
      uploadOnly: false,
      downloadOnly: false,
      conflict: "skip",
      dryRun: false,
      jsonMode: true,
      authToken: testToken,
      webdriveUrl: serverUrl,
      ...opts,
    });
  }

  async function serverStatus(slug: string, filePath: string): Promise<number> {
    const encoded = filePath.split("/").map(encodeURIComponent).join("/");
    const res = await fetch(`${serverUrl}/api/v1/vaults/${slug}/files/${encoded}`, {
      headers: { Authorization: `Bearer ${testToken}` },
    });
    return res.status;
  }

  // ─── Syncfiles pattern changes ────────────────────────────────────────────────

  it("syncfiles add pattern: existing server files under new pattern are downloaded", async () => {
    const slug = makeVaultSlug();
    // Start with /docs/ only
    const { vaultDir, cleanup } = makeTempVault("/docs/\n");
    try {
      // Seed server with a notes file directly (bypasses pattern scope)
      await serverPut(serverUrl, slug, "notes/added.md", "added later", testToken);

      // First sync with /docs/ — notes not in scope, cursor established
      await sync(slug, vaultDir);

      // Now update local syncfiles to include /notes/
      writeFileSync(join(vaultDir, ".gobi", "syncfiles"), "/docs/\n/notes/\n");

      // Second sync — server sees /notes/ added, returns notes/added.md as DOWNLOAD
      await sync(slug, vaultDir);

      const content = readFileSync(join(vaultDir, "notes", "added.md"), "utf-8");
      assert.equal(content, "added later");
    } finally {
      cleanup();
    }
  });

  it("syncfiles remove pattern: server files under removed pattern are deleted from server", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "a.md"), "will be gone");

      await sync(slug, vaultDir, { uploadOnly: true });
      assert.equal(await serverStatus(slug, "notes/a.md"), 200);

      // Remove /notes/ from syncfiles
      writeFileSync(join(vaultDir, ".gobi", "syncfiles"), "");

      // Sync: server deletes all /notes/ files
      await sync(slug, vaultDir);
      assert.equal(await serverStatus(slug, "notes/a.md"), 404);
    } finally {
      cleanup();
    }
  });

  it("syncfiles: upload-only on client A does not delete server files client A has never seen", async () => {
    const slug = makeVaultSlug();
    // Client B seeds a file on the server in a pattern client A doesn't have locally
    await serverPut(serverUrl, slug, "notes/from-b.md", "client B file", testToken);

    // Client A only has /notes/ pattern but no local files yet
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      // upload-only sync: client A has never seen notes/from-b.md, so it should NOT delete it
      await sync(slug, vaultDir, { uploadOnly: true });

      // Server file seeded by client B must still be there
      assert.equal(await serverStatus(slug, "notes/from-b.md"), 200);
    } finally {
      cleanup();
    }
  });

  // ─── --full mode ─────────────────────────────────────────────────────────────

  it("--full: clears cursor so sync.db cursor is null before sending", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "a.md"), "content");

      await sync(slug, vaultDir, { uploadOnly: true });
      const stateBefore = loadSyncState(join(vaultDir, ".gobi"));
      assert.ok(stateBefore.cursor !== null);

      // --full resets state before sync; cursor in SQLite should update again
      await sync(slug, vaultDir, { full: true, uploadOnly: true });
      const stateAfter = loadSyncState(join(vaultDir, ".gobi"));
      assert.ok(stateAfter.cursor !== null, "cursor re-established after --full");
    } finally {
      cleanup();
    }
  });

  it("--full: re-downloads server file even when local copy exists with same content", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      await serverPut(serverUrl, slug, "notes/full.md", "server content", testToken);

      // First sync downloads the file
      await sync(slug, vaultDir);
      assert.equal(readFileSync(join(vaultDir, "notes", "full.md"), "utf-8"), "server content");

      // Delete local copy and clear hash cache to simulate drift
      rmSync(join(vaultDir, "notes", "full.md"));
      const state = loadSyncState(join(vaultDir, ".gobi"));
      delete state.hashCache["notes/full.md"];
      saveSyncState(join(vaultDir, ".gobi"), state);

      // --full: cursor=null → server sees file exists → DOWNLOAD
      await sync(slug, vaultDir, { full: true });
      assert.ok(existsSync(join(vaultDir, "notes", "full.md")));
    } finally {
      cleanup();
    }
  });

  // ─── --path filter ────────────────────────────────────────────────────────────

  it("--path notes/: only processes notes/ actions, skips docs/ actions", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n/docs/\n");
    try {
      await serverPut(serverUrl, slug, "notes/note.md", "note content", testToken);
      await serverPut(serverUrl, slug, "docs/doc.md", "doc content", testToken);

      await sync(slug, vaultDir, { paths: ["notes/"] });

      assert.ok(existsSync(join(vaultDir, "notes", "note.md")), "notes/ file downloaded");
      assert.ok(!existsSync(join(vaultDir, "docs", "doc.md")), "docs/ file skipped");
    } finally {
      cleanup();
    }
  });

  it("--path exact file: only that file processed, siblings skipped", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      await serverPut(serverUrl, slug, "notes/target.md", "target", testToken);
      await serverPut(serverUrl, slug, "notes/sibling.md", "sibling", testToken);

      await sync(slug, vaultDir, { paths: ["notes/target.md"] });

      assert.ok(existsSync(join(vaultDir, "notes", "target.md")));
      assert.ok(!existsSync(join(vaultDir, "notes", "sibling.md")));
    } finally {
      cleanup();
    }
  });

  it("--path multiple: union of specified paths all processed", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n/docs/\n");
    try {
      await serverPut(serverUrl, slug, "notes/a.md", "note", testToken);
      await serverPut(serverUrl, slug, "docs/b.md", "doc", testToken);

      await sync(slug, vaultDir, { paths: ["notes/", "docs/"] });

      assert.ok(existsSync(join(vaultDir, "notes", "a.md")));
      assert.ok(existsSync(join(vaultDir, "docs", "b.md")));
    } finally {
      cleanup();
    }
  });

  // ─── Multiple files ───────────────────────────────────────────────────────────

  it("multiple files uploaded in one sync", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "one.md"), "one");
      writeFileSync(join(vaultDir, "notes", "two.md"), "two");
      writeFileSync(join(vaultDir, "notes", "three.md"), "three");

      await sync(slug, vaultDir, { uploadOnly: true });

      assert.equal(await serverStatus(slug, "notes/one.md"), 200);
      assert.equal(await serverStatus(slug, "notes/two.md"), 200);
      assert.equal(await serverStatus(slug, "notes/three.md"), 200);
    } finally {
      cleanup();
    }
  });

  it("multiple files downloaded in one sync", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      await serverPut(serverUrl, slug, "notes/one.md", "one", testToken);
      await serverPut(serverUrl, slug, "notes/two.md", "two", testToken);
      await serverPut(serverUrl, slug, "notes/three.md", "three", testToken);

      await sync(slug, vaultDir, { downloadOnly: true });

      assert.equal(readFileSync(join(vaultDir, "notes", "one.md"), "utf-8"), "one");
      assert.equal(readFileSync(join(vaultDir, "notes", "two.md"), "utf-8"), "two");
      assert.equal(readFileSync(join(vaultDir, "notes", "three.md"), "utf-8"), "three");
    } finally {
      cleanup();
    }
  });

  it("mixed: client has A, server has B — both uploaded/downloaded in one sync", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "local.md"), "local");
      await serverPut(serverUrl, slug, "notes/remote.md", "remote", testToken);

      await sync(slug, vaultDir);

      assert.equal(await serverStatus(slug, "notes/local.md"), 200);
      assert.equal(readFileSync(join(vaultDir, "notes", "remote.md"), "utf-8"), "remote");
    } finally {
      cleanup();
    }
  });

  // ─── Hash cache ───────────────────────────────────────────────────────────────

  it("hash cache: unchanged file produces no second upload", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "stable.md"), "stable");

      await sync(slug, vaultDir, { uploadOnly: true });
      const s1 = loadSyncState(join(vaultDir, ".gobi"));

      // Second sync: file unchanged → server should return no action
      await sync(slug, vaultDir, { uploadOnly: true });
      const s2 = loadSyncState(join(vaultDir, ".gobi"));

      // Hash and cursor should be stable
      assert.equal(s1.hashCache["notes/stable.md"]?.hash, s2.hashCache["notes/stable.md"]?.hash);
    } finally {
      cleanup();
    }
  });

  it("hash cache: modified file re-uploaded on second sync", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "evolving.md"), "v1");
      await sync(slug, vaultDir, { uploadOnly: true });

      await sleep();
      writeFileSync(join(vaultDir, "notes", "evolving.md"), "v2");
      await sync(slug, vaultDir, { uploadOnly: true });

      const serverContent = await serverGet(serverUrl, slug, "notes/evolving.md", testToken);
      assert.equal(serverContent, "v2");
    } finally {
      cleanup();
    }
  });

  it("hash cache: entry updated with new hash after content change", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "change.md"), "before");
      await sync(slug, vaultDir, { uploadOnly: true });
      const hashBefore = loadSyncState(join(vaultDir, ".gobi")).hashCache["notes/change.md"]?.hash;

      await sleep();
      writeFileSync(join(vaultDir, "notes", "change.md"), "after");
      await sync(slug, vaultDir, { uploadOnly: true });
      const hashAfter = loadSyncState(join(vaultDir, ".gobi")).hashCache["notes/change.md"]?.hash;

      assert.ok(hashBefore !== hashAfter, "hashCache updated after content change");
    } finally {
      cleanup();
    }
  });

  // ─── Content integrity ────────────────────────────────────────────────────────

  it("binary content roundtrip: bytes preserved exactly", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/assets/\n");
    try {
      mkdirSync(join(vaultDir, "assets"), { recursive: true });
      const binary = Buffer.from(
        Array.from({ length: 256 }, (_, i) => i),
      );
      writeFileSync(join(vaultDir, "assets", "bin.dat"), binary);

      await sync(slug, vaultDir, { uploadOnly: true });

      const { vaultDir: dir2, cleanup: clean2 } = makeTempVault("/assets/\n");
      try {
        await sync(slug, dir2, { downloadOnly: true });
        const downloaded = readFileSync(join(dir2, "assets", "bin.dat"));
        assert.deepEqual(downloaded, binary);
      } finally {
        clean2();
      }
    } finally {
      cleanup();
    }
  });

  it("deeply nested path syncs correctly", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/a/\n");
    try {
      mkdirSync(join(vaultDir, "a", "b", "c", "d"), { recursive: true });
      writeFileSync(join(vaultDir, "a", "b", "c", "d", "deep.md"), "deep");

      await sync(slug, vaultDir, { uploadOnly: true });

      const { vaultDir: dir2, cleanup: clean2 } = makeTempVault("/a/\n");
      try {
        await sync(slug, dir2, { downloadOnly: true });
        assert.equal(
          readFileSync(join(dir2, "a", "b", "c", "d", "deep.md"), "utf-8"),
          "deep",
        );
      } finally {
        clean2();
      }
    } finally {
      cleanup();
    }
  });

  it("filename with spaces syncs correctly", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "my daily note.md"), "spaces");

      await sync(slug, vaultDir, { uploadOnly: true });
      assert.equal(await serverStatus(slug, "notes/my daily note.md"), 200);

      const { vaultDir: dir2, cleanup: clean2 } = makeTempVault("/notes/\n");
      try {
        await sync(slug, dir2, { downloadOnly: true });
        assert.equal(
          readFileSync(join(dir2, "notes", "my daily note.md"), "utf-8"),
          "spaces",
        );
      } finally {
        clean2();
      }
    } finally {
      cleanup();
    }
  });

  // ─── Conflict strategy=skip ───────────────────────────────────────────────────

  it("conflict strategy=skip: file left unchanged locally and on server", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "conflict.md"), "original");
      await sync(slug, vaultDir, { uploadOnly: true });

      await sleep();
      await serverPut(serverUrl, slug, "notes/conflict.md", "server edit", testToken);
      await sleep();
      writeFileSync(join(vaultDir, "notes", "conflict.md"), "local edit");

      await sync(slug, vaultDir, { conflict: "skip" });

      // Local file stays as local edit
      assert.equal(readFileSync(join(vaultDir, "notes", "conflict.md"), "utf-8"), "local edit");
      // Server still has server edit
      assert.equal(await serverGet(serverUrl, slug, "notes/conflict.md", testToken), "server edit");
    } finally {
      cleanup();
    }
  });

  // ─── Two-way sync edge cases ─────────────────────────────────────────────────

  it("two-way: server updates file unchanged on client → client downloads", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "shared.md"), "v1");
      await sync(slug, vaultDir, { uploadOnly: true });

      await sleep();
      await serverPut(serverUrl, slug, "notes/shared.md", "v2 from server", testToken);

      await sync(slug, vaultDir);

      assert.equal(readFileSync(join(vaultDir, "notes", "shared.md"), "utf-8"), "v2 from server");
    } finally {
      cleanup();
    }
  });

  it("two-way: client updates file unchanged on server → uploaded", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "shared.md"), "v1");
      await sync(slug, vaultDir);

      await sleep();
      writeFileSync(join(vaultDir, "notes", "shared.md"), "v2 from client");
      await sync(slug, vaultDir);

      assert.equal(await serverGet(serverUrl, slug, "notes/shared.md", testToken), "v2 from client");
    } finally {
      cleanup();
    }
  });

  it("two-way: three clients — changes propagate through server", async () => {
    const slug = makeVaultSlug();
    const { vaultDir: dirA, cleanup: cleanA } = makeTempVault("/notes/\n");
    const { vaultDir: dirB, cleanup: cleanB } = makeTempVault("/notes/\n");
    const { vaultDir: dirC, cleanup: cleanC } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(dirA, "notes"), { recursive: true });
      writeFileSync(join(dirA, "notes", "relay.md"), "from A");

      await sync(slug, dirA);  // A uploads
      await sync(slug, dirB);  // B downloads from A
      assert.equal(readFileSync(join(dirB, "notes", "relay.md"), "utf-8"), "from A");

      await sleep();
      writeFileSync(join(dirB, "notes", "relay.md"), "from B");
      await sync(slug, dirB);  // B uploads v2

      await sync(slug, dirC);  // C downloads B's version
      assert.equal(readFileSync(join(dirC, "notes", "relay.md"), "utf-8"), "from B");
    } finally {
      cleanA(); cleanB(); cleanC();
    }
  });

  it("two-way: no spurious actions on third sync after full two-way", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "stable.md"), "stable content");

      await sync(slug, vaultDir);
      await sync(slug, vaultDir);

      // Third sync: everything is in sync — no actions expected
      const state1 = loadSyncState(join(vaultDir, ".gobi"));
      await sync(slug, vaultDir);
      const state2 = loadSyncState(join(vaultDir, ".gobi"));

      // Cursor doesn't change if no mutations happened
      assert.equal(state1.cursor, state2.cursor);
    } finally {
      cleanup();
    }
  });

  // ─── Delete scenarios ─────────────────────────────────────────────────────────

  it("delete_local: skipped when uploadOnly=true (file stays on disk)", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "stay.md"), "stay");
      writeFileSync(join(vaultDir, "notes", "keeper.md"), "keeper");

      await sync(slug, vaultDir, { uploadOnly: true });

      await sleep();
      await serverDelete(serverUrl, slug, "notes/stay.md", testToken);

      // upload-only: delete_local action should be ignored
      await sync(slug, vaultDir, { uploadOnly: true });
      assert.ok(existsSync(join(vaultDir, "notes", "stay.md")), "file should still be on disk");
    } finally {
      cleanup();
    }
  });

  it("dry-run: delete_local does NOT trash the file", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "keep-dry.md"), "keep");
      writeFileSync(join(vaultDir, "notes", "keeper.md"), "keeper");

      await sync(slug, vaultDir, { uploadOnly: true });
      await sleep();
      await serverDelete(serverUrl, slug, "notes/keep-dry.md", testToken);

      await sync(slug, vaultDir, { dryRun: true });

      // File should still exist (dry-run doesn't trash)
      assert.ok(existsSync(join(vaultDir, "notes", "keep-dry.md")));
    } finally {
      cleanup();
    }
  });

  it("dry-run: offline deleted file NOT removed from server", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "dry-offline.md"), "will vanish");
      await sync(slug, vaultDir, { uploadOnly: true });

      rmSync(join(vaultDir, "notes", "dry-offline.md"));

      // dry-run: offline deletion detected but DELETE not sent
      await sync(slug, vaultDir, { dryRun: true });

      assert.equal(await serverStatus(slug, "notes/dry-offline.md"), 200, "file still on server after dry-run");
    } finally {
      cleanup();
    }
  });

  // ─── State persistence ────────────────────────────────────────────────────────

  it("state: sync.db created, sync_state.json not created", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "x.md"), "x");
      await sync(slug, vaultDir, { uploadOnly: true });

      assert.ok(existsSync(join(vaultDir, ".gobi", "sync.db")), "sync.db should exist");
      assert.ok(!existsSync(join(vaultDir, ".gobi", "sync_state.json")), "legacy JSON should not exist");
    } finally {
      cleanup();
    }
  });

  it("state: hashCache populated with correct hash after upload", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      const content = "hash me";
      writeFileSync(join(vaultDir, "notes", "hashed.md"), content);
      const expectedHash = md5Hex(Buffer.from(content));

      await sync(slug, vaultDir, { uploadOnly: true });

      const state = loadSyncState(join(vaultDir, ".gobi"));
      assert.equal(state.hashCache["notes/hashed.md"]?.hash, expectedHash);
      assert.ok(state.hashCache["notes/hashed.md"]?.size > 0);
    } finally {
      cleanup();
    }
  });

  it("state: hashCache populated after download", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      const content = "download me";
      await serverPut(serverUrl, slug, "notes/dl.md", content, testToken);
      const expectedHash = md5Hex(Buffer.from(content));

      await sync(slug, vaultDir, { downloadOnly: true });

      const state = loadSyncState(join(vaultDir, ".gobi"));
      assert.equal(state.hashCache["notes/dl.md"]?.hash, expectedHash);
    } finally {
      cleanup();
    }
  });

  it("state: hashCache entry removed after delete_local", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "gone.md"), "gone");
      writeFileSync(join(vaultDir, "notes", "keeper.md"), "keeper");

      await sync(slug, vaultDir, { uploadOnly: true });
      assert.ok(loadSyncState(join(vaultDir, ".gobi")).hashCache["notes/gone.md"]);

      await sleep();
      await serverDelete(serverUrl, slug, "notes/gone.md", testToken);
      await sync(slug, vaultDir);

      assert.ok(!loadSyncState(join(vaultDir, ".gobi")).hashCache["notes/gone.md"],
        "hashCache should not contain deleted file");
    } finally {
      cleanup();
    }
  });

  it("state: patterns persisted to SQLite after sync", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n/docs/\n");
    try {
      await sync(slug, vaultDir);
      const state = loadSyncState(join(vaultDir, ".gobi"));
      assert.ok(state.patterns.includes("/notes/"));
      assert.ok(state.patterns.includes("/docs/"));
    } finally {
      cleanup();
    }
  });

  // ─── Incremental correctness ──────────────────────────────────────────────────

  it("incremental: new server file added after cursor is downloaded on next sync", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "existing.md"), "existing");
      await sync(slug, vaultDir);

      // Server gets a new file after cursor
      await sleep();
      await serverPut(serverUrl, slug, "notes/new-after-cursor.md", "new!", testToken);

      await sync(slug, vaultDir);

      assert.equal(
        readFileSync(join(vaultDir, "notes", "new-after-cursor.md"), "utf-8"),
        "new!",
      );
    } finally {
      cleanup();
    }
  });

  it("incremental: second sync after download does not re-download same file", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      await serverPut(serverUrl, slug, "notes/once.md", "once", testToken);

      await sync(slug, vaultDir, { downloadOnly: true });
      const mtime1 = statSync(join(vaultDir, "notes", "once.md")).mtimeMs;

      await sync(slug, vaultDir, { downloadOnly: true });
      const mtime2 = statSync(join(vaultDir, "notes", "once.md")).mtimeMs;

      // File should not be re-written on second sync (mtime unchanged)
      assert.equal(mtime1, mtime2, "file should not be re-downloaded");
    } finally {
      cleanup();
    }
  });

  // ─── Gap tests ────────────────────────────────────────────────────────────────

  it("download-only: locally deleted cached file is re-downloaded, not sent as delete to server", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "keep.md"), "keep this");

      // Upload so server has the file and client has it in hashCache
      await sync(slug, vaultDir, { uploadOnly: true });

      // Delete local copy (simulating a user clearing disk space, not intending a server delete)
      rmSync(join(vaultDir, "notes", "keep.md"));

      // download-only: should re-download, NOT propagate the deletion to server
      await sync(slug, vaultDir, { downloadOnly: true });

      // File must still exist on server
      assert.equal(await serverStatus(slug, "notes/keep.md"), 200);
      // And must be restored locally
      assert.ok(existsSync(join(vaultDir, "notes", "keep.md")), "file re-downloaded locally");
      assert.equal(readFileSync(join(vaultDir, "notes", "keep.md"), "utf-8"), "keep this");
    } finally {
      cleanup();
    }
  });

  it("offline deletion: 404 from server is tolerated (file already gone)", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "gone.md"), "already deleted on server");

      // Upload to get it into hashCache
      await sync(slug, vaultDir, { uploadOnly: true });

      // Delete from server directly (another client already removed it)
      await serverDelete(serverUrl, slug, "notes/gone.md", testToken);
      // Also delete locally so offline deletion path fires
      rmSync(join(vaultDir, "notes", "gone.md"));

      // Sync must not throw even though server returns 404 for the DELETE
      await assert.doesNotReject(async () => {
        await sync(slug, vaultDir);
      }, "sync should tolerate 404 when deleting a file already gone from server");
    } finally {
      cleanup();
    }
  });

  it("Unicode filename: non-ASCII characters round-trip correctly", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      const filename = "日記.md";
      writeFileSync(join(vaultDir, "notes", filename), "unicode content");

      await sync(slug, vaultDir, { uploadOnly: true });
      assert.equal(await serverStatus(slug, `notes/${filename}`), 200);

      // Download to a fresh vault
      const { vaultDir: vaultDir2, cleanup: cleanup2 } = makeTempVault("/notes/\n");
      try {
        await sync(slug, vaultDir2, { downloadOnly: true });
        assert.ok(existsSync(join(vaultDir2, "notes", filename)), "Unicode file downloaded");
        assert.equal(readFileSync(join(vaultDir2, "notes", filename), "utf-8"), "unicode content");
      } finally {
        cleanup2();
      }
    } finally {
      cleanup();
    }
  });

  it("dry-run: conflict is counted but no file is written or overwritten", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "conflict.md"), "original");

      await sync(slug, vaultDir, { uploadOnly: true });

      await sleep();
      await serverPut(serverUrl, slug, "notes/conflict.md", "server changed", testToken);
      await sleep();
      writeFileSync(join(vaultDir, "notes", "conflict.md"), "local changed");

      // dry-run should not overwrite local file
      await sync(slug, vaultDir, { dryRun: true, conflict: "server" });

      // Local file unchanged
      assert.equal(readFileSync(join(vaultDir, "notes", "conflict.md"), "utf-8"), "local changed");
      // Server file unchanged
      assert.equal(await serverGet(serverUrl, slug, "notes/conflict.md", testToken), "server changed");
    } finally {
      cleanup();
    }
  });

  it("--full + download-only: downloads server files and skips uploading local-only files", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      // Seed server with a file the client has never seen
      await serverPut(serverUrl, slug, "notes/from-server.md", "server content", testToken);

      // Also create a local-only file that would normally be uploaded
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "local-only.md"), "local only");

      // --full + download-only: server file must be downloaded, local file must NOT be uploaded
      await sync(slug, vaultDir, { full: true, downloadOnly: true });

      assert.equal(
        readFileSync(join(vaultDir, "notes", "from-server.md"), "utf-8"),
        "server content",
        "server file downloaded",
      );
      assert.equal(
        await serverStatus(slug, "notes/local-only.md"),
        404,
        "local-only file not uploaded",
      );
    } finally {
      cleanup();
    }
  });

  it("--path + upload-only: only files under the path are uploaded, others skipped", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n/docs/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      mkdirSync(join(vaultDir, "docs"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "a.md"), "note");
      writeFileSync(join(vaultDir, "docs", "b.md"), "doc");

      await sync(slug, vaultDir, { uploadOnly: true, paths: ["notes/"] });

      assert.equal(await serverStatus(slug, "notes/a.md"), 200, "notes/ file uploaded");
      assert.equal(await serverStatus(slug, "docs/b.md"), 404, "docs/ file skipped by --path filter");
    } finally {
      cleanup();
    }
  });

  it("incremental: offline deletion followed by re-upload restores file on server", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, cleanup } = makeTempVault("/notes/\n");
    try {
      mkdirSync(join(vaultDir, "notes"), { recursive: true });
      writeFileSync(join(vaultDir, "notes", "restore.md"), "original");
      await sync(slug, vaultDir);

      // Offline delete — vault becomes empty, server deletes the vault directory
      rmSync(join(vaultDir, "notes", "restore.md"));
      await sync(slug, vaultDir); // sends DELETE to server
      assert.equal(await serverStatus(slug, "notes/restore.md"), 404);

      // Re-create and re-upload: client detects stale cursor (409), resets patterns=[]
      // so the retry re-sends /notes/ as "added" and resurrects the vault.
      writeFileSync(join(vaultDir, "notes", "restore.md"), "restored");
      await sync(slug, vaultDir);
      assert.equal(await serverStatus(slug, "notes/restore.md"), 200);
      assert.equal(await serverGet(serverUrl, slug, "notes/restore.md", testToken), "restored");
    } finally {
      cleanup();
    }
  });

  // ─── Privatefiles ─────────────────────────────────────────────────────────────

  it("privatefiles: two-way sync sends local patterns and writes merged result to .gobi/privatefiles", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, gobiDir, cleanup } = makeTempVault("/notes/\n");
    try {
      writeFileSync(join(gobiDir, "privatefiles"), "/secret.md\n/private/\n");

      await sync(slug, vaultDir);

      // Local .gobi/privatefiles should be updated with the merged (sorted) result from server
      const localPatterns = readPrivatefiles(gobiDir);
      assert.ok(localPatterns.includes("/secret.md"), "secret.md in merged privatefiles");
      assert.ok(localPatterns.includes("/private/"), "/private/ in merged privatefiles");
    } finally {
      cleanup();
    }
  });

  it("privatefiles: upload-only sends patterns to server but does NOT update local file", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, gobiDir, cleanup } = makeTempVault("/notes/\n");
    try {
      const originalContent = "/secret.md\n";
      writeFileSync(join(gobiDir, "privatefiles"), originalContent);

      await sync(slug, vaultDir, { uploadOnly: true });

      // Local file must remain exactly as written (not overwritten with merged result)
      assert.equal(readFileSync(join(gobiDir, "privatefiles"), "utf-8"), originalContent);

      // Server should have the pattern
      const serverResp = await serverPostPrivatefiles(serverUrl, slug, [], testToken);
      assert.ok(serverResp.patterns.includes("/secret.md"), "server has the uploaded pattern");
    } finally {
      cleanup();
    }
  });

  it("privatefiles: download-only with no local file creates .gobi/privatefiles from server patterns", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, gobiDir, cleanup } = makeTempVault("/notes/\n");
    try {
      // Seed server with patterns before the client has any local privatefiles
      await serverPostPrivatefiles(serverUrl, slug, ["/server-private/"], testToken);

      await sync(slug, vaultDir, { downloadOnly: true });

      // Local .gobi/privatefiles should be created with the server patterns
      assert.ok(existsSync(join(gobiDir, "privatefiles")), ".gobi/privatefiles created");
      const localPatterns = readPrivatefiles(gobiDir);
      assert.ok(localPatterns.includes("/server-private/"), "server pattern written locally");
    } finally {
      cleanup();
    }
  });

  it("privatefiles: dry-run does not send patterns to server or update local file", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, gobiDir, cleanup } = makeTempVault("/notes/\n");
    try {
      writeFileSync(join(gobiDir, "privatefiles"), "/dry-secret.md\n");

      await sync(slug, vaultDir, { dryRun: true });

      // Server should not have received the pattern (no POST sent)
      const serverResp = await serverPostPrivatefiles(serverUrl, slug, [], testToken);
      assert.ok(!serverResp.patterns.includes("/dry-secret.md"), "dry-run: pattern not sent to server");

      // Local file should be unchanged
      assert.equal(readFileSync(join(gobiDir, "privatefiles"), "utf-8"), "/dry-secret.md\n");
    } finally {
      cleanup();
    }
  });

  it("privatefiles: two clients merge patterns via server", async () => {
    const slug = makeVaultSlug();
    const { vaultDir: dirA, gobiDir: gobiA, cleanup: cleanA } = makeTempVault("/notes/\n");
    const { vaultDir: dirB, gobiDir: gobiB, cleanup: cleanB } = makeTempVault("/notes/\n");
    try {
      writeFileSync(join(gobiA, "privatefiles"), "/from-a.md\n");
      writeFileSync(join(gobiB, "privatefiles"), "/from-b.md\n");

      await sync(slug, dirA);  // A sends /from-a.md → server has [/from-a.md]
      await sync(slug, dirB);  // B sends /from-b.md → server merges to [/from-a.md, /from-b.md], B gets both
      await sync(slug, dirA);  // A re-syncs → gets merged result including /from-b.md

      // After A's second sync, it should have both patterns
      const patternsA = readPrivatefiles(gobiA);
      const patternsB = readPrivatefiles(gobiB);

      assert.ok(patternsA.includes("/from-a.md"), "A has its own pattern");
      assert.ok(patternsA.includes("/from-b.md"), "A has B's pattern after re-sync");
      assert.ok(patternsB.includes("/from-a.md"), "B has A's pattern after sync");
      assert.ok(patternsB.includes("/from-b.md"), "B has its own pattern");
    } finally {
      cleanA();
      cleanB();
    }
  });

  it("privatefiles: no local file — sync with empty list does not create .gobi/privatefiles when server has no patterns", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, gobiDir, cleanup } = makeTempVault("/notes/\n");
    try {
      await sync(slug, vaultDir);

      // Server returned empty patterns → no file should be written
      assert.ok(!existsSync(join(gobiDir, "privatefiles")), ".gobi/privatefiles should not be created when server has no patterns");
    } finally {
      cleanup();
    }
  });

  it("privatefiles: removing a pattern locally propagates deletion to server", async () => {
    const slug = makeVaultSlug();
    const { vaultDir, gobiDir, cleanup } = makeTempVault("/notes/\n");
    try {
      // First sync: upload both patterns to server
      writeFileSync(join(gobiDir, "privatefiles"), "/secret.md\n/keep-me.md\n");
      await sync(slug, vaultDir);

      // Verify server has both
      let serverResp = await serverPostPrivatefiles(serverUrl, slug, [], testToken);
      assert.ok(serverResp.patterns.includes("/secret.md"), "server has /secret.md initially");
      assert.ok(serverResp.patterns.includes("/keep-me.md"), "server has /keep-me.md initially");

      // Remove /secret.md from local privatefiles
      writeFileSync(join(gobiDir, "privatefiles"), "/keep-me.md\n");
      await sync(slug, vaultDir);

      // Server should no longer have /secret.md
      serverResp = await serverPostPrivatefiles(serverUrl, slug, [], testToken);
      assert.ok(!serverResp.patterns.includes("/secret.md"), "server no longer has removed pattern /secret.md");
      assert.ok(serverResp.patterns.includes("/keep-me.md"), "server still has /keep-me.md");

      // Local file should reflect the server's authoritative state
      const localPatterns = readPrivatefiles(gobiDir);
      assert.ok(!localPatterns.includes("/secret.md"), "local file no longer has /secret.md");
      assert.ok(localPatterns.includes("/keep-me.md"), "local file still has /keep-me.md");
    } finally {
      cleanup();
    }
  });

  it("syncfiles: client downloads updated .gobi/syncfiles when another device added a pattern", async () => {
    const slug = makeVaultSlug();
    // Device A has /notes/ and /docs/
    const { vaultDir: dirA, cleanup: cleanA } = makeTempVault("/notes/\n/docs/\n");
    // Device B only has /notes/
    const { vaultDir: dirB, gobiDir: gobiB, cleanup: cleanB } = makeTempVault("/notes/\n");
    try {
      // A syncs first — server syncfiles gets /notes/ + /docs/
      await sync(slug, dirA);

      // B syncs — server's syncfilesHash differs from B's (null on first sync)
      // so B should download the server's syncfiles
      await sync(slug, dirB);

      // B's local .gobi/syncfiles should now include /docs/ from server
      const { patterns } = readSyncfiles(gobiB);
      assert.ok(patterns.includes("/docs/"), "B downloaded /docs/ from server syncfiles");
      assert.ok(patterns.includes("/notes/"), "B still has /notes/");

      // State hash should be persisted so a second sync does NOT re-download
      const stateBefore = loadSyncState(gobiB);
      await sync(slug, dirB);
      const stateAfter = loadSyncState(gobiB);
      assert.equal(stateAfter.syncfilesHash, stateBefore.syncfilesHash, "hash stable — no redundant download");
    } finally {
      cleanA();
      cleanB();
    }
  });
});
