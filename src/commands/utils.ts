import { readFileSync } from "fs";
import { Command } from "commander";
import { getSpaceSlug, getVaultSlug } from "./init.js";

// Reads all of stdin synchronously. Uses fd 0 (cross-platform) instead of
// "/dev/stdin", which doesn't exist on Windows.
export function readStdin(): string {
  return readFileSync(0, "utf8");
}

// The top-level `--json` flag lives on the root program. Walk up the ancestry so
// this works regardless of how deeply the calling command is nested (e.g. a
// leaf under `gobi space artifact …`, not just a direct child of the program).
export function isJsonMode(cmd: Command): boolean {
  let cur: Command | null | undefined = cmd;
  while (cur) {
    if (cur.opts().json) return true;
    cur = cur.parent;
  }
  return false;
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

// Maps a userId to a display name, built from a response's `mentions.users`
// block. richText `user` nodes only carry `userId`, so this resolves them to
// names instead of printing the raw `@<id>`.
export type MentionMap = Map<number, string>;

// Build a userId -> name lookup from a list/feed/thread response's `mentions`
// block. Returns an empty map when absent, so callers can pass it through
// unconditionally and mentions just fall back to `@<id>`.
export function buildMentionMap(resp: Record<string, unknown>): MentionMap {
  const map: MentionMap = new Map();
  // `mentions` sits at the top level on raw list/feed responses but under
  // `data` on unwrapped thread/topic payloads — accept either.
  const data = resp?.data as Record<string, unknown> | undefined;
  const mentions = (resp?.mentions || data?.mentions) as
    | Record<string, unknown>
    | undefined;
  const users = mentions?.users;
  if (Array.isArray(users)) {
    for (const u of users as Record<string, unknown>[]) {
      if (u && typeof u.id === "number" && typeof u.name === "string") {
        map.set(u.id, u.name);
      }
    }
  }
  return map;
}

// Flatten a richText node array into a plain-text string for display. Posts
// commonly carry an empty `content` with the real body living only in
// `richText`, so list/feed labels go blank without this. Renders text nodes
// verbatim, user mentions as `@<name>` (resolved live via `mentions`, else a
// node-baked snapshot, else `@<id>`), `@here` broadcasts, and link nodes as
// their label or URL.
export function flattenRichText(
  richText: unknown,
  mentions?: MentionMap,
): string {
  if (!Array.isArray(richText)) return "";
  const parts: string[] = [];
  for (const node of richText) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    if (typeof n.text === "string" && n.text) {
      parts.push(n.text);
    } else if (n.type === "user") {
      const id = n.userId;
      // Prefer the live name from the response's `mentions` side-channel over
      // any `name` snapshot baked into the node, so a rename shows through;
      // fall back to the snapshot, then the bare id. This matches every other
      // surface (feed/web/inbox), which resolve the id at render time.
      const resolved =
        (typeof id === "number" ? mentions?.get(id) : undefined) ||
        (n.name as string) ||
        "";
      parts.push(
        resolved ? `@${resolved.replace(/^@/, "")}` : id != null ? `@${id}` : "",
      );
    } else if (n.type === "here") {
      parts.push("@here");
    } else if (n.type === "link") {
      parts.push((n.text as string) || (n.url as string) || (n.href as string) || "");
    }
  }
  return parts.join("");
}

// Best available plain-text body for a post or reply: explicit `content` first,
// then flattened `richText`. Empty string if neither has text.
export function postBodyText(
  m: Record<string, unknown>,
  mentions?: MentionMap,
): string {
  const content = (m.content as string) || "";
  if (content.trim()) return content;
  return flattenRichText(m.richText, mentions);
}

// Single-line display label for a post: its title, else a body snippet, else
// "(untitled)". Falls through title -> content -> richText so titleless posts
// (the common case) read sensibly instead of printing "null"/blank. Body
// snippets are collapsed to one line and truncated; titles are left intact.
export function formatPostLabel(
  m: Record<string, unknown>,
  mentions?: MentionMap,
  maxLen = 100,
): string {
  const title = (m.title as string) || "";
  if (title.trim()) return title;
  const body = postBodyText(m, mentions).replace(/\s+/g, " ").trim();
  if (!body) return "(untitled)";
  return body.length > maxLen ? body.slice(0, maxLen) + "…" : body;
}

// Compact one-line rendering of a reply for nested display under a post (used
// by `list-posts`). Indented two levels so it reads as a child of the post
// line; surfaces attachments/artifacts and reactions on the reply.
export function formatReplyLine(
  r: Record<string, unknown>,
  mentions?: MentionMap,
  maxLen = 200,
): string {
  const author =
    ((r.author as Record<string, unknown>)?.name as string) ||
    `User ${r.authorId ?? "?"}`;
  const text = postBodyText(r, mentions).replace(/\s+/g, " ").trim();
  const body = text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
  const attach = formatAttachmentSummary(r);
  const chips = formatReactionChips(r);
  return (
    `    - [r:${r.id}] ${author}: ${body} (${r.createdAt})` +
    (attach ? `  ${attach}` : "") +
    (chips ? `  ${chips}` : "")
  );
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

// One line per attachment with a fetchable reference — a `mediaUrl` for files
// and media, or the `artifactId` for artifacts (retrievable via
// `gobi artifact get <id>`). Used by `get-post` and nested under posts in
// `list-posts` so an agent can fetch/describe the data without re-querying.
// `marker` is the bullet prefix (e.g. "-" or "📎").
export function formatAttachmentLines(
  m: Record<string, unknown>,
  indent = "  ",
  marker = "-",
): string[] {
  const attachments = (m.attachments as Record<string, unknown>[]) || [];
  if (!Array.isArray(attachments) || !attachments.length) return [];
  return attachments.map((a) => {
    const kind = attachmentKind(a);
    if (kind === "artifact") {
      const art = a.artifact as Record<string, unknown>;
      const title = art.title ? ` "${art.title}"` : "";
      const status = art.isPublished ? "published" : "unpublished";
      return `${indent}${marker} artifact [${art.kind}]${title} (${art.artifactId}, ${status})${art.mediaUrl ? ` — ${art.mediaUrl}` : ""}`;
    }
    const dims = a.width && a.height ? ` ${a.width}×${a.height}` : "";
    const name = a.fileName ? ` "${a.fileName}"` : "";
    const mime = a.mimeType ? ` (${a.mimeType})` : "";
    return `${indent}${marker} ${kind}${name}${dims}${mime} — ${a.mediaUrl}`;
  });
}
