/**
 * Personal and space posts/replies. Paths match gobi-cli
 * (`src/commands/personal.ts`, `src/commands/space.ts`).
 */

import { GobiError, type GobiApi } from "./gobi-client.js";
import { parseListLimit } from "./gobi-personal.js";

const POST_OR_REPLY_PUBLIC_ID_RE = /^[pr][0-9a-z]{10,31}$/i;

export function parsePostId(value: string): string {
  const v = value.trim();
  if (POST_OR_REPLY_PUBLIC_ID_RE.test(v)) return v;
  throw new GobiError("postId must be a publicId (p… / r…).", "INVALID_POST_ID");
}

export interface CompactPost {
  id: string;
  title: string | null;
  content: string | null;
  author: string | null;
  createdAt: string | null;
  replyCount: number | null;
}

export function compactPost(row: Record<string, unknown>): CompactPost {
  const user = row.user && typeof row.user === "object" ? (row.user as Record<string, unknown>) : null;
  const author =
    (typeof row.authorName === "string" && row.authorName) ||
    (typeof user?.name === "string" && user.name) ||
    null;
  return {
    id: String(row.publicId ?? row.id ?? "?"),
    title: typeof row.title === "string" ? row.title : null,
    content: typeof row.content === "string" ? row.content : null,
    author,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    replyCount: typeof row.replyCount === "number" ? row.replyCount : null,
  };
}

function unwrapData(resp: Record<string, unknown>): Record<string, unknown>[] {
  const rows = resp.data ?? resp.items ?? resp.posts;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

export async function listSpacePosts(
  api: GobiApi,
  spaceSlug: string,
  opts?: { limit?: number; cursor?: string },
): Promise<{ posts: CompactPost[]; pagination: Record<string, unknown> }> {
  const resp = (await api.get(`/spaces/${encodeURIComponent(spaceSlug)}/posts`, {
    limit: parseListLimit(opts?.limit),
    cursor: opts?.cursor,
  })) as Record<string, unknown>;
  return {
    posts: unwrapData(resp).map(compactPost),
    pagination: (resp.pagination as Record<string, unknown>) ?? {},
  };
}

export async function searchSpacePosts(
  api: GobiApi,
  spaceSlug: string,
  opts: { q: string; limit?: number; cursor?: string },
): Promise<{ posts: CompactPost[]; pagination: Record<string, unknown> }> {
  const resp = (await api.get(`/spaces/${encodeURIComponent(spaceSlug)}/search`, {
    q: opts.q,
    limit: parseListLimit(opts.limit),
    cursor: opts.cursor,
  })) as Record<string, unknown>;
  return {
    posts: unwrapData(resp).map(compactPost),
    pagination: (resp.pagination as Record<string, unknown>) ?? {},
  };
}

export async function replyToSpacePost(
  api: GobiApi,
  spaceSlug: string,
  postId: string,
  opts: { content: string; rationale?: string },
): Promise<{ reply: CompactPost }> {
  const id = parsePostId(postId);
  const body: Record<string, unknown> = { content: opts.content };
  if (opts.rationale) body.rationale = opts.rationale;
  const resp = (await api.post(
    `/spaces/${encodeURIComponent(spaceSlug)}/posts/${id}/replies`,
    body,
  )) as Record<string, unknown>;
  const row = ((resp.data as Record<string, unknown> | undefined) ?? resp) as Record<string, unknown>;
  return { reply: compactPost(row) };
}

export async function replyToPersonalPost(
  api: GobiApi,
  postId: string,
  opts: { content: string; rationale?: string },
): Promise<{ reply: CompactPost }> {
  const id = parsePostId(postId);
  const body: Record<string, unknown> = { content: opts.content };
  if (opts.rationale) body.rationale = opts.rationale;
  const resp = (await api.post(`/posts/${id}/replies`, body)) as Record<string, unknown>;
  const row = ((resp.data as Record<string, unknown> | undefined) ?? resp) as Record<string, unknown>;
  return { reply: compactPost(row) };
}

export function resolveSpaceSlug(opts?: { spaceSlug?: string; defaultSlug?: string }): string {
  const slug = (opts?.spaceSlug ?? opts?.defaultSlug ?? process.env.GOBI_MCP_SPACE_SLUG ?? "").trim();
  if (!slug) {
    throw new GobiError(
      "spaceSlug required. Pass it on the tool, set GOBI_MCP_SPACE_SLUG, or warp a space in gobi-cli.",
      "MISSING_SPACE_SLUG",
    );
  }
  return slug;
}
