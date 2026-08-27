import { Command } from "commander";
import {
  existsSync,
  readFileSync,
  statSync,
} from "fs";
import { basename, extname, isAbsolute, resolve } from "path";
import { apiDelete, apiGet, apiPatch, apiPost } from "../client.js";
import { isJsonMode, jsonOut, readStdin, unwrapResp } from "./utils.js";
import { extractWikiLinks, uploadAttachments } from "../attachments.js";
import { getValidToken } from "../auth/manager.js";

// Artifact kinds, mirrored from the backend (entities/artifact.entity.ts:
// TEXT_ARTIFACT_KINDS / MEDIA_ARTIFACT_KINDS). Keep in sync — the create
// DTO rejects anything outside this set.
//
// `html` is a text kind, not a markdown one: its body is a self-contained HTML
// document that the clients render in a sandboxed frame. It takes a body the
// same way markdown does, but resolves no wikilinks and has no vault anchor —
// which is why the body-vs-media gate below asks "is this text", not "is this
// markdown".
const TEXT_KINDS = ["markdown", "note", "html"] as const;
const MEDIA_KINDS = ["image", "video", "gif"] as const;
const ALL_KINDS = [...MEDIA_KINDS, ...TEXT_KINDS] as const;

type ArtifactKind = (typeof ALL_KINDS)[number];

function isTextKind(kind: string): boolean {
  return (TEXT_KINDS as readonly string[]).includes(kind);
}

function isMediaKind(kind: string): boolean {
  return (MEDIA_KINDS as readonly string[]).includes(kind);
}

// Best-effort extension → MIME mapping for artifact media uploads. Mirrors the
// post-attachment map in attachments.ts; the backend derives the per-tier size
// ceiling (10MB photos / 15MB GIFs / 512MB video) from the content type.
const ARTIFACT_MIME_MAP: Record<string, string> = {
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
};

interface Revision {
  revisionId: string;
  seq: number;
  parentRevisionId: string | null;
  authorPublicId: string | null;
  content: string | null;
  mediaUrl: string | null;
  mediaKey: string | null;
  metadata: Record<string, unknown>;
  changeNote: string | null;
  createdAt: string;
}

interface Artifact {
  artifactId: string;
  kind: ArtifactKind;
  title: string | null;
  ownerPublicId: string | null;
  ownerVault: { slug: string; public: boolean } | null;
  metadata: Record<string, unknown>;
  resolveWikilinks: boolean;
  canWrite: boolean;
  revision: Revision | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

function readContent(value: string): string {
  if (value === "-") return readStdin();
  return value;
}

// Resolve the markdown body for create/revise from --file | --content | stdin.
// Returns undefined when none is given (revise may carry media instead).
function resolveBody(opts: {
  file?: string;
  content?: string;
}): string | undefined {
  if (opts.file && opts.content) {
    throw new Error("--file and --content are mutually exclusive.");
  }
  if (opts.file) {
    const abs = isAbsolute(opts.file) ? opts.file : resolve(process.cwd(), opts.file);
    if (!existsSync(abs)) throw new Error(`File not found: ${opts.file}`);
    return readFileSync(abs, "utf8");
  }
  if (opts.content != null) return readContent(opts.content);
  return undefined;
}

// Upload a local media file via POST /artifacts/upload-url → PUT to S3 →
// return { mediaUrl, mediaKey } for the artifact create/revise body. Mirrors
// uploadPostAttachment in attachments.ts but against the artifact endpoint.
async function uploadArtifactMedia(
  filePath: string,
): Promise<{ mediaUrl: string; mediaKey: string }> {
  const abs = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
  if (!existsSync(abs)) throw new Error(`File not found: ${filePath}`);
  const ext = extname(abs).toLowerCase();
  const contentType = ARTIFACT_MIME_MAP[ext] || "application/octet-stream";
  const fileSize = statSync(abs).size;
  const initResp = (await apiPost("/artifacts/upload-url", {
    fileName: basename(abs),
    contentType,
    fileSize,
  })) as Record<string, unknown>;
  const data = unwrapResp(initResp) as Record<string, unknown>;
  const uploadUrl = data.uploadUrl as string | undefined;
  const mediaUrl = data.mediaUrl as string | undefined;
  const mediaKey = data.mediaKey as string | undefined;
  if (!uploadUrl || !mediaUrl || !mediaKey) {
    throw new Error("Upload init returned an incomplete payload");
  }
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: readFileSync(abs),
  });
  if (!putRes.ok) {
    throw new Error(`Failed to PUT ${filePath} to S3: HTTP ${putRes.status}`);
  }
  return { mediaUrl, mediaKey };
}

// Append an artifact to a post without clobbering its existing artifacts. The
// post edit endpoint treats `artifactIds` as a full replacement of the post's
// artifact attachments, so we read the post's current artifact attachments,
// append the new id, and write the merged set.
async function attachArtifactToPost(
  postId: string,
  artifactId: string,
): Promise<void> {
  const resp = (await apiGet(`/posts/${postId}`)) as Record<string, unknown>;
  const data = unwrapResp(resp) as Record<string, unknown>;
  const post = (data.update || data.post || data) as Record<string, unknown>;
  const attachments = ((post.attachments as unknown[]) || []) as Record<
    string,
    unknown
  >[];
  const existing = attachments
    .map((a) => (a.artifact as Record<string, unknown> | undefined)?.artifactId)
    .filter((x): x is string => typeof x === "string");
  const merged = existing.includes(artifactId)
    ? existing
    : [...existing, artifactId];
  await apiPatch(`/posts/${postId}`, { artifactIds: merged });
}

function formatRevisionLine(r: Revision): string {
  const note = r.changeNote ? ` — ${r.changeNote}` : "";
  const parent =
    r.parentRevisionId != null ? ` (from ${r.parentRevisionId.slice(0, 8)})` : "";
  return `  seq ${r.seq} ${r.revisionId.slice(0, 8)} by ${r.authorPublicId ?? "unknown"}${parent}${note}  ${r.createdAt}`;
}

function printArtifact(a: Artifact): void {
  console.log(`Artifact ${a.artifactId}`);
  console.log(`  kind:      ${a.kind}`);
  if (a.title) console.log(`  title:     ${a.title}`);
  console.log(`  owner:     ${a.ownerPublicId ?? "unknown"}`);
  if (a.ownerVault) {
    console.log(`  vault:     ${a.ownerVault.slug} (${a.ownerVault.public ? "public" : "private"})`);
  }
  console.log(`  canWrite:  ${a.canWrite ? "yes" : "no"}`);
  console.log(`  created:   ${a.createdAt}`);
  console.log(`  updated:   ${a.updatedAt}`);
  const rev = a.revision;
  if (rev) {
    console.log("");
    console.log(`Current revision (seq ${rev.seq}):`);
    if (rev.content != null) {
      console.log("");
      console.log(rev.content);
    }
    if (rev.mediaUrl) console.log(`  mediaUrl: ${rev.mediaUrl}`);
  }
}

// How an artifact subcommand group resolves its scope at action time. The only
// group left is `gobi personal`, which resolves to {} (the caller's personal
// core — the backend's default); there is no space-scoped artifact group. Only
// `create` and `list` carry the scope to the backend; the by-id leaves
// (revise/revert/get/…) authorize off the artifact itself.
export interface ArtifactScope {
  resolve(): { spaceSlug?: string };
}

// Registers the full `artifact` subcommand tree under `parent` (the `gobi
// personal` group — the only caller). Moved here from a top-level `gobi
// artifact` group; artifacts live in the personal core and reach a space only
// by being attached to a post.
export function registerArtifactSubcommands(
  parent: Command,
  scope: ArtifactScope,
  description: string,
): void {
  const artifact = parent.command("artifact").description(description);

  // ── Create ──

  artifact
    .command("create")
    .description(
      "Create an artifact. markdown/note/html kinds take a body via --file, --content, or stdin (\"-\"). image/gif/video kinds upload --file. Pass --post-id to attach the new artifact to a post.",
    )
    .requiredOption(
      "--kind <kind>",
      `Artifact kind: ${ALL_KINDS.join(" | ")}`,
    )
    .option("--file <path>", "Local file: text body (markdown/note/html kinds) or media file (media kinds)")
    .option("--content <md>", "Markdown body inline (markdown kinds; pass \"-\" for stdin)")
    .option("--title <t>", "Display title")
    .option("--vault-slug <slug>", "Anchor vault for [[wikilink]] resolution (markdown kinds). Stored in metadata.vaultSlug.")
    .option("--post-id <id>", "Attach the created artifact to this post afterward")
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before creating (markdown kinds; uses --vault-slug)",
    )
    .option("--change-note <note>", "Note describing this revision")
    .action(
      async (opts: {
        kind: string;
        file?: string;
        content?: string;
        title?: string;
        vaultSlug?: string;
        postId?: string;
        autoAttachments?: boolean;
        changeNote?: string;
      }) => {
        const kind = opts.kind;
        if (!(ALL_KINDS as readonly string[]).includes(kind)) {
          throw new Error(`--kind must be one of: ${ALL_KINDS.join(", ")}`);
        }

        const body: Record<string, unknown> = { kind };
        // Scope the new artifact. The only group left resolves to {}, so this
        // never sets spaceSlug and the backend files it in the personal core.
        const { spaceSlug } = scope.resolve();
        if (spaceSlug) body.spaceSlug = spaceSlug;
        if (opts.title != null) body.title = opts.title;
        if (opts.vaultSlug) body.vaultSlug = opts.vaultSlug;
        if (opts.changeNote != null) body.changeNote = opts.changeNote;

        if (isTextKind(kind)) {
          const content = resolveBody(opts);
          if (content == null) {
            throw new Error(
              "markdown/note/html kinds require a body via --file, --content, or stdin.",
            );
          }
          if (opts.autoAttachments) {
            if (!opts.vaultSlug) {
              throw new Error("--auto-attachments requires --vault-slug.");
            }
            const token = await getValidToken();
            const links = extractWikiLinks(content);
            await uploadAttachments(opts.vaultSlug, links, token, {
              addToSyncfiles: true,
            });
          }
          body.content = content;
        } else if (isMediaKind(kind)) {
          if (!opts.file) throw new Error(`${kind} kind requires --file.`);
          if (opts.content != null) {
            throw new Error("--content is only valid for text kinds.");
          }
          if (opts.autoAttachments) {
            throw new Error("--auto-attachments is only valid for markdown kinds.");
          }
          const { mediaUrl, mediaKey } = await uploadArtifactMedia(opts.file);
          body.mediaUrl = mediaUrl;
          body.mediaKey = mediaKey;
        }

        const resp = (await apiPost("/artifacts", body)) as Record<string, unknown>;
        const a = unwrapResp(resp) as Artifact;

        if (opts.postId) {
          await attachArtifactToPost(opts.postId, a.artifactId);
        }

        if (isJsonMode(artifact)) {
          jsonOut(a);
          return;
        }

        console.log(
          `Artifact created!\n` +
            `  ID:   ${a.artifactId}\n` +
            `  Kind: ${a.kind}` +
            (a.title ? `\n  Title: ${a.title}` : "") +
            (opts.postId ? `\n  Attached to post: ${opts.postId}` : ""),
        );
      },
    );

  // ── Revise ──

  artifact
    .command("revise <artifactId>")
    .description(
      "Edit an artifact: records a revision and makes it the current one. New body via --file, --content, or stdin (markdown), or --file (media). Use --from to branch off a specific revision.",
    )
    .option("--file <path>", "Local file: text body (markdown/note/html kinds) or media file (media kinds)")
    .option("--content <md>", "Markdown body inline (markdown kinds; pass \"-\" for stdin)")
    .option("--change-note <note>", "Note describing this revision")
    .option("--from <revisionId>", "Branch off this revision instead of the current one")
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before revising (markdown kinds; uses the artifact's stored metadata.vaultSlug)",
    )
    .action(
      async (
        artifactId: string,
        opts: {
          file?: string;
          content?: string;
          changeNote?: string;
          from?: string;
          autoAttachments?: boolean;
        },
      ) => {
        // Fetch the artifact first to learn its kind — that determines how
        // --file is handled (markdown body text vs binary media upload). Also
        // carries metadata.vaultSlug for --auto-attachments. Branching on kind
        // (like `create`) is REQUIRED: resolveBody() reads --file as UTF-8, so
        // calling it for a media kind would corrupt the binary into `content`.
        const getResp = (await apiGet(`/artifacts/${artifactId}`)) as Record<
          string,
          unknown
        >;
        const existing = unwrapResp(getResp) as Artifact;
        const kind = existing.kind;

        const body: Record<string, unknown> = {};
        if (opts.changeNote != null) body.changeNote = opts.changeNote;
        if (opts.from) body.fromRevisionId = opts.from;

        if (isTextKind(kind)) {
          const content = resolveBody(opts);
          if (content == null) {
            throw new Error(
              "markdown/note/html kinds require a new body via --file, --content, or stdin.",
            );
          }
          if (opts.autoAttachments) {
            const vaultSlug = existing.metadata?.vaultSlug as string | undefined;
            if (!vaultSlug) {
              throw new Error(
                "--auto-attachments needs the artifact's metadata.vaultSlug, which is not set.",
              );
            }
            const token = await getValidToken();
            const links = extractWikiLinks(content);
            await uploadAttachments(vaultSlug, links, token, {
              addToSyncfiles: true,
            });
          }
          body.content = content;
        } else if (isMediaKind(kind)) {
          if (!opts.file) throw new Error(`${kind} kind requires --file.`);
          if (opts.content != null) {
            throw new Error("--content is only valid for text kinds.");
          }
          if (opts.autoAttachments) {
            throw new Error("--auto-attachments is only valid for markdown kinds.");
          }
          const { mediaUrl, mediaKey } = await uploadArtifactMedia(opts.file);
          body.mediaUrl = mediaUrl;
          body.mediaKey = mediaKey;
        }

        const resp = (await apiPost(
          `/artifacts/${artifactId}/revisions`,
          body,
        )) as Record<string, unknown>;
        const rev = unwrapResp(resp) as Revision;

        if (isJsonMode(artifact)) {
          jsonOut(rev);
          return;
        }

        console.log(
          `Revision added!\n` +
            `  Revision: ${rev.revisionId}\n` +
            `  Seq:      ${rev.seq}`,
        );
      },
    );

  // ── Revert ──

  artifact
    .command("revert <artifactId>")
    .description("Restore an earlier revision's content as a new revision, which becomes the current one.")
    .requiredOption("--to <revisionId>", "Revision to revert to")
    .action(async (artifactId: string, opts: { to: string }) => {
      const resp = (await apiPost(`/artifacts/${artifactId}/revert`, {
        toRevisionId: opts.to,
      })) as Record<string, unknown>;
      const a = unwrapResp(resp) as Artifact;

      if (isJsonMode(artifact)) {
        jsonOut(a);
        return;
      }

      console.log(
        `Reverted!\n  Artifact: ${a.artifactId}\n  Restored from: ${opts.to}`,
      );
    });

  // ── History ──

  artifact
    .command("history <artifactId>")
    .description("List the artifact's full revision tree (owner only).")
    .action(async (artifactId: string) => {
      const resp = (await apiGet(`/artifacts/${artifactId}/revisions`)) as Record<
        string,
        unknown
      >;
      const revisions = (unwrapResp(resp) as Revision[]) || [];

      if (isJsonMode(artifact)) {
        jsonOut(revisions);
        return;
      }

      if (!revisions.length) {
        console.log("No revisions.");
        return;
      }

      console.log(`Revision history (${revisions.length}):`);
      for (const r of revisions) console.log(formatRevisionLine(r));
    });

  // ── Download ──

  artifact
    .command("download <artifactId>")
    .description(
      "Download an artifact's content. markdown → write the body; media → fetch the bytes. Defaults to the current revision; pass --revision to pick one. Writes to --out or stdout (markdown).",
    )
    .option("--revision <revisionId>", "Specific revision (defaults to the artifact's current revision)")
    .option("--out <path>", "Write to this file (markdown defaults to stdout)")
    .action(
      async (
        artifactId: string,
        opts: { revision?: string; out?: string },
      ) => {
        // Resolve the target revision. Without --revision, use the artifact's
        // current revision from GET /artifacts/:id.
        let kind: ArtifactKind;
        let rev: Revision;
        if (opts.revision) {
          const aResp = (await apiGet(`/artifacts/${artifactId}`)) as Record<
            string,
            unknown
          >;
          kind = (unwrapResp(aResp) as Artifact).kind;
          const rResp = (await apiGet(
            `/artifacts/${artifactId}/revisions/${opts.revision}`,
          )) as Record<string, unknown>;
          rev = unwrapResp(rResp) as Revision;
        } else {
          const aResp = (await apiGet(`/artifacts/${artifactId}`)) as Record<
            string,
            unknown
          >;
          const a = unwrapResp(aResp) as Artifact;
          if (!a.revision) {
            throw new Error("Artifact has no current revision to download.");
          }
          kind = a.kind;
          rev = a.revision;
        }

        if (isTextKind(kind)) {
          const content = rev.content ?? "";
          if (opts.out) {
            const { writeFile, mkdir } = await import("fs/promises");
            const { dirname } = await import("path");
            await mkdir(dirname(opts.out), { recursive: true });
            await writeFile(opts.out, content, "utf8");
            if (isJsonMode(artifact)) {
              jsonOut({ artifactId, revisionId: rev.revisionId, filename: opts.out, size: Buffer.byteLength(content) });
              return;
            }
            console.log(`Wrote ${opts.out} (${Buffer.byteLength(content)} bytes)`);
            return;
          }
          if (isJsonMode(artifact)) {
            jsonOut({ artifactId, revisionId: rev.revisionId, content });
            return;
          }
          process.stdout.write(content.endsWith("\n") ? content : content + "\n");
          return;
        }

        // Media kind — fetch the mediaUrl bytes.
        if (!rev.mediaUrl) {
          throw new Error("Revision has no media URL to download.");
        }
        const res = await fetch(rev.mediaUrl);
        if (!res.ok) {
          throw new Error(`Failed to fetch media from ${rev.mediaUrl}: HTTP ${res.status}`);
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") || "application/octet-stream";
        const out = opts.out || `${artifactId}${extForContentType(contentType)}`;
        const { writeFile, mkdir } = await import("fs/promises");
        const { dirname } = await import("path");
        await mkdir(dirname(out), { recursive: true });
        await writeFile(out, buffer);
        if (isJsonMode(artifact)) {
          jsonOut({ artifactId, revisionId: rev.revisionId, filename: out, contentType, size: buffer.length });
          return;
        }
        console.log(`Saved media to ${out} (${buffer.length} bytes)`);
      },
    );

  // ── Delete ──

  artifact
    .command("delete <artifactId>")
    .description("Delete an artifact (and its revision tree).")
    .action(async (artifactId: string) => {
      await apiDelete(`/artifacts/${artifactId}`);

      if (isJsonMode(artifact)) {
        jsonOut({ artifactId, ok: true });
        return;
      }

      console.log(`Deleted ${artifactId}.`);
    });

  // ── Get ──

  artifact
    .command("get <artifactId>")
    .description("Get one artifact with its current revision.")
    .action(async (artifactId: string) => {
      const resp = (await apiGet(`/artifacts/${artifactId}`)) as Record<
        string,
        unknown
      >;
      const a = unwrapResp(resp) as Artifact;

      if (isJsonMode(artifact)) {
        jsonOut(a);
        return;
      }

      printArtifact(a);
    });

  // ── List ──

  artifact
    .command("list")
    .description("List this scope's artifacts (newest first).")
    .option("--kind <kind>", `Filter by kind: ${ALL_KINDS.join(" | ")}`)
    .option("--limit <n>", "Max items to return")
    .action(async (opts: { kind?: string; limit?: string }) => {
      const params: Record<string, unknown> = {};
      // Scope the listing to this group's space (team) or personal space.
      const { spaceSlug } = scope.resolve();
      if (spaceSlug) params.spaceSlug = spaceSlug;
      if (opts.kind) {
        if (!(ALL_KINDS as readonly string[]).includes(opts.kind)) {
          throw new Error(`--kind must be one of: ${ALL_KINDS.join(", ")}`);
        }
        params.kind = opts.kind;
      }
      if (opts.limit) params.limit = parseInt(opts.limit, 10);

      const resp = (await apiGet("/artifacts", params)) as Record<string, unknown>;
      const items = (unwrapResp(resp) as Artifact[]) || [];

      if (isJsonMode(artifact)) {
        jsonOut(items);
        return;
      }

      if (!items.length) {
        console.log("No artifacts.");
        return;
      }

      console.log(`Artifacts (${items.length}):`);
      for (const a of items) {
        console.log(
          `- [${a.kind}] ${a.artifactId.slice(0, 8)} ${a.title ?? "(untitled)"} (${a.updatedAt})`,
        );
      }
    });
}

// Pick a file extension for a downloaded media artifact from its content type.
function extForContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("png")) return ".png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("gif")) return ".gif";
  if (ct.includes("mp4")) return ".mp4";
  if (ct.includes("quicktime")) return ".mov";
  if (ct.includes("webm")) return ".webm";
  return "";
}
