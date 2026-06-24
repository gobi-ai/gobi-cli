import { readFileSync } from "fs";
import { Command } from "commander";
import { getSpaceSlug, getVaultSlug } from "./init.js";

// Reads all of stdin synchronously. Uses fd 0 (cross-platform) instead of
// "/dev/stdin", which doesn't exist on Windows.
export function readStdin(): string {
  return readFileSync(0, "utf8");
}

export function isJsonMode(cmd: Command): boolean {
  return !!cmd.parent?.opts().json;
}

export function jsonOut(data: unknown): void {
  console.log(JSON.stringify({ success: true, data }));
}

// Resolves the space slug from (in order): the leaf subcommand's --space-slug
// option, the parent `gobi space` command's --space-slug option, then
// `.gobi/settings.yaml`. Either side of the subcommand works:
//   gobi space --space-slug foo list-posts   (parent-level)
//   gobi space list-posts --space-slug foo   (leaf-level)
export function resolveSpaceSlug(
  parent: Command,
  leafOpts?: { spaceSlug?: string },
): string {
  return leafOpts?.spaceSlug || parent.opts().spaceSlug || getSpaceSlug();
}

export function resolveVaultSlug(opts: { vaultSlug?: string }): string {
  return opts.vaultSlug || getVaultSlug();
}

export function unwrapResp(resp: unknown): unknown {
  if (typeof resp === "object" && resp !== null && "data" in resp) {
    return (resp as Record<string, unknown>).data;
  }
  return resp;
}

// Compact reaction chips for single-line output: `👍2* 🎉1` — the trailing
// `*` marks emojis the caller has reacted with (remove via `unreact`).
export function formatReactionChips(m: Record<string, unknown>): string {
  const reactions = (m.reactions as Record<string, unknown>[]) || [];
  if (!Array.isArray(reactions) || !reactions.length) return "";
  return reactions
    .map((r) => `${r.emoji}${r.count}${r.reactedByMe ? "*" : ""}`)
    .join(" ");
}

type AttachmentKind = "photo" | "gif" | "video" | "file" | "artifact" | "media";

// Classify a wire attachment the way the clients do: declared mimeType first,
// then the media-url extension (covers rows that predate the mimeType field).
function attachmentKind(a: Record<string, unknown>): AttachmentKind {
  if (a.artifact) return "artifact";
  const mime = ((a.mimeType as string) || "").toLowerCase();
  const url = ((a.mediaUrl as string) || "").toLowerCase().split("?")[0];
  if (mime === "image/gif" || (!mime && url.endsWith(".gif"))) return "gif";
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  if (mime) return "file";
  if (/\.(jpe?g|png|webp|heic|heif|avif|svg|bmp|tiff)$/.test(url)) return "photo";
  if (/\.(mp4|mov|webm|m4v)$/.test(url)) return "video";
  if (/\.(pdf|md|txt|csv)$/.test(url)) return "file";
  return "media";
}

// Compact attachment marker for single-line output: `📎 2 photos, 1 file`.
// Counts per kind; full URLs are in `get-post` (or --json).
export function formatAttachmentSummary(m: Record<string, unknown>): string {
  const attachments = (m.attachments as Record<string, unknown>[]) || [];
  if (!Array.isArray(attachments) || !attachments.length) return "";
  const counts = new Map<AttachmentKind, number>();
  for (const a of attachments) {
    const kind = attachmentKind(a);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const [kind, count] of counts) {
    parts.push(count === 1 ? `1 ${kind}` : `${count} ${kind}s`);
  }
  return `📎 ${parts.join(", ")}`;
}

// One line per attachment with the fetchable URL — used by `get-post` so an
// agent can download/describe the media without re-querying in --json mode.
export function formatAttachmentLines(
  m: Record<string, unknown>,
  indent = "  ",
): string[] {
  const attachments = (m.attachments as Record<string, unknown>[]) || [];
  if (!Array.isArray(attachments) || !attachments.length) return [];
  return attachments.map((a) => {
    const kind = attachmentKind(a);
    if (kind === "artifact") {
      const art = a.artifact as Record<string, unknown>;
      const title = art.title ? ` "${art.title}"` : "";
      const status = art.isPublished ? "published" : "unpublished";
      return `${indent}- artifact [${art.kind}]${title} (${art.artifactId}, ${status})${art.mediaUrl ? ` — ${art.mediaUrl}` : ""}`;
    }
    const dims = a.width && a.height ? ` ${a.width}×${a.height}` : "";
    const name = a.fileName ? ` "${a.fileName}"` : "";
    const mime = a.mimeType ? ` (${a.mimeType})` : "";
    return `${indent}- ${kind}${name}${dims}${mime} — ${a.mediaUrl}`;
  });
}
