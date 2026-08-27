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
// The document half mirrors POST_FILE_CONTENT_TYPES on the backend and BY_EXT
// in gobi-web's utils/fileAttachments.ts — keep the three in sync. HTML in
// particular must go up as real `text/html`: the clients open it in a browser
// tab, and octet-stream makes that tab download the file instead.
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
  ".html": "text/html",
  ".htm": "text/html",
  ".xhtml": "application/xhtml+xml",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v"];
// Still images (GIF is tracked separately — it's an exclusive kind).
const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".avif",
  ".svg",
  ".bmp",
  ".tiff",
];

export type AttachmentKind = "photo" | "gif" | "video" | "file";

/**
 * Classify a local path the way the server and the other clients do: only
 * images and videos are inline media — EVERYTHING ELSE is a document 'file'
 * attachment on the 250 MB tier. That's the backend's `kindForContentType`
 * (post/dto/upload-post-media.dto.ts) and gobi-web's `fileTypeForFile`
 * (utils/fileAttachments.ts) rule.
 *
 * Deliberately an allow-list of media rather than an allow-list of documents:
 * classifying by "is it a known document type?" made every unrecognized
 * extension (.html, .docx, .zip, .json, an extension-less file) fall into the
 * photo bucket, which both capped them at 4-mixed-with-photos client-side and
 * uploaded them as unnamed media the clients then failed to render.
 */
export function kindForPath(p: string): AttachmentKind {
  const ext = extname(p).toLowerCase();
  if (ext === ".gif") return "gif";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (IMAGE_EXTENSIONS.includes(ext)) return "photo";
  return "file";
}

export type PostAttachment = {
  mediaUrl: string;
  mediaKey: string;
  // Document files only: the S3 key is a UUID, so the row's fileName is the
  // only place the original name survives; mimeType picks the previewer.
  fileName?: string;
  mimeType?: string;
};

// The backend's ONE rule: at most 8 attachments per post, all kinds mixing
// freely (POST_MEDIA_LIMITS.maxAttachmentsPerPost). The old X-style
// exclusivity — 4 photos OR 1 GIF OR 1 video — was dropped there precisely
// because a composer can only discover it after the upload is spent; this
// client kept enforcing it and refused combinations the server accepts.
export const MAX_ATTACHMENTS_PER_POST = 8;

export function assertPostAttachmentMix(paths: string[]): void {
  if (paths.length > MAX_ATTACHMENTS_PER_POST) {
    throw new Error(
      `Up to ${MAX_ATTACHMENTS_PER_POST} attachments per post (got ${paths.length}).`,
    );
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
  const kind = kindForPath(abs);
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
  // Every non-media attachment carries name + MIME on the row: the declared
  // mimeType is what the backend trusts for kind/preview routing, and the
  // original filename only survives here (the S3 key is a UUID). Omitting
  // them on an unrecognized type leaves the clients no way to tell a file row
  // from a legacy media row, so it renders as broken inline media instead of
  // a download card. Inline media (photo/gif/video) stores neither, by design.
  if (kind === "file") {
    // Backend caps fileName at 255 chars — truncate rather than 400.
    attachment.fileName = basename(abs).slice(0, 255);
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
