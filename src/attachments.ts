import { existsSync, readFileSync, appendFileSync, statSync } from "fs";
import { EOL } from "os";
import { basename, join, extname, isAbsolute, resolve } from "path";
import ignore from "ignore";
import { WEBDRIVE_BASE_URL } from "./constants.js";
import { apiPost } from "./client.js";
import { normalizeSyncPattern } from "./commands/sync.js";

// Best-effort extension → MIME mapping. Anything we don't recognize falls
// back to `application/octet-stream`; the backend caps size per content-type
// tier (10MB photos / 15MB GIFs / 512MB video / 250MB document files) so
// it's the authority on what's allowed. We're just trying to set a usable
// Content-Type for the S3 PUT — and for document files the declared MIME is
// what routes the post row into the 'file' kind, so it must be accurate.
const POST_MEDIA_MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
  ".pdf": "application/pdf",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

const FILE_EXTENSIONS = [".pdf", ".md", ".markdown", ".txt", ".csv"];
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v"];

export type PostAttachment = {
  mediaUrl: string;
  mediaKey: string;
  // Document files only: the S3 key is a UUID, so the row's fileName is the
  // only place the original name survives; mimeType picks the previewer.
  fileName?: string;
  mimeType?: string;
};

// Mirrors the backend mix rule: up to 4 photos + up to 4 document files
// (pdf/md/txt/csv) together, OR 1 GIF, OR 1 video — GIF and video are
// exclusive with everything. Unknown extensions count against the photo cap
// (the backend's 'other' kind) so nothing slips through unlimited.
export function assertPostAttachmentMix(paths: string[]): void {
  let photos = 0;
  let gifs = 0;
  let videos = 0;
  let files = 0;
  for (const p of paths) {
    const ext = extname(p).toLowerCase();
    if (ext === ".gif") gifs += 1;
    else if (VIDEO_EXTENSIONS.includes(ext)) videos += 1;
    else if (FILE_EXTENSIONS.includes(ext)) files += 1;
    else photos += 1;
  }
  if (videos > 1) throw new Error("Only 1 video allowed per post");
  if (gifs > 1) throw new Error("Only 1 GIF allowed per post");
  if (photos > 4) throw new Error("Up to 4 photos allowed per post");
  if (files > 4) throw new Error("Up to 4 files allowed per post");
  if (videos > 0 && (gifs > 0 || photos > 0 || files > 0)) {
    throw new Error("A video can't be combined with other media");
  }
  if (gifs > 0 && (videos > 0 || photos > 0 || files > 0)) {
    throw new Error("A GIF can't be combined with other media");
  }
}

/**
 * Upload a single local file as a post attachment.
 * init (`POST /posts/upload-url`) → PUT to S3 → return `{ mediaUrl, mediaKey }`
 * suitable for the `attachments` array on create-post.
 */
export async function uploadPostAttachment(
  filePath: string,
): Promise<PostAttachment> {
  const abs = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
  if (!existsSync(abs)) {
    throw new Error(`Attachment not found: ${filePath}`);
  }
  const ext = extname(abs).toLowerCase();
  const contentType = POST_MEDIA_MIME_MAP[ext] || "application/octet-stream";
  const fileSize = statSync(abs).size;
  const initResp = (await apiPost("/posts/upload-url", {
    fileName: basename(abs),
    contentType,
    fileSize,
  })) as Record<string, unknown>;
  const data = (initResp.data ?? initResp) as Record<string, unknown>;
  const uploadUrl = data.uploadUrl as string | undefined;
  const mediaUrl = data.mediaUrl as string | undefined;
  const mediaKey = data.mediaKey as string | undefined;
  if (!uploadUrl || !mediaUrl || !mediaKey) {
    throw new Error("Upload init returned an incomplete payload");
  }
  const body = readFileSync(abs);
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!putRes.ok) {
    throw new Error(
      `Failed to PUT ${filePath} to S3: HTTP ${putRes.status}`,
    );
  }
  const attachment: PostAttachment = { mediaUrl, mediaKey };
  // Document files carry name + MIME on the row: the declared mimeType is
  // what the backend trusts for kind/preview routing, and the original
  // filename only survives here (the S3 key is a UUID).
  if (FILE_EXTENSIONS.includes(ext)) {
    attachment.fileName = basename(abs);
    attachment.mimeType = contentType;
  }
  return attachment;
}

export async function uploadPostAttachments(
  paths: string[],
): Promise<PostAttachment[]> {
  const out: PostAttachment[] = [];
  for (const p of paths) {
    out.push(await uploadPostAttachment(p));
  }
  return out;
}

export function extractWikiLinks(content: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const link = match[1].trim();
    if (!seen.has(link)) {
      seen.add(link);
      results.push(link);
    }
  }
  return results;
}

function readSyncfilesPatterns(gobiDir: string): string[] {
  const syncfilesPath = join(gobiDir, "syncfiles");
  if (!existsSync(syncfilesPath)) return [];
  return readFileSync(syncfilesPath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

function isPathCovered(filePath: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  return ignore().add(patterns).ignores(filePath.replace(/\\/g, "/"));
}

function addToLocalSyncfiles(gobiDir: string, filePath: string): void {
  const patterns = readSyncfilesPatterns(gobiDir);
  if (isPathCovered(filePath, patterns)) return;
  const syncfilesPath = join(gobiDir, "syncfiles");
  const pattern = normalizeSyncPattern(filePath);
  appendFileSync(syncfilesPath, `${EOL}${pattern}`);
  console.log(`Added to syncfiles: ${pattern}`);
}

export async function uploadAttachments(
  vaultSlug: string,
  links: string[],
  token: string,
  options?: { addToSyncfiles?: boolean },
): Promise<void> {
  const addToSyncfiles = options?.addToSyncfiles ?? false;
  const gobiDir = join(process.cwd(), ".gobi");

  for (const link of links) {
    let localPath = join(process.cwd(), link);
    if (!existsSync(localPath)) {
      if (!extname(link)) {
        localPath = join(process.cwd(), link + ".md");
      }
      if (!existsSync(localPath)) {
        console.warn(`Warning: Skipping [[${link}]]: not found locally`);
        continue;
      }
    }

    const filePath = extname(link) ? link : link + ".md";
    console.log(`Uploading [[${link}]]...`);
    const content = readFileSync(localPath);
    const queryString = addToSyncfiles ? "?add_to_syncfiles=true" : "";
    const url = `${WEBDRIVE_BASE_URL}/api/v1/vaults/${vaultSlug}/file/${filePath}${queryString}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: content,
    });

    if (!res.ok) {
      throw new Error(
        `Failed to upload [[${link}]]: HTTP ${res.status}: ${(await res.text()) || "(no body)"}`,
      );
    }
    console.log(`Uploaded [[${link}]]`);

    if (addToSyncfiles) {
      addToLocalSyncfiles(gobiDir, filePath);
    }
  }
}
