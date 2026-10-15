/**
 * REST (/v1) mapping of the same core the MCP tools call, for agents without MCP.
 */

import { NotAuthenticatedError, type GobiApi } from "./gobi-client.js";
import {
  compactActivity,
  fetchPersonalContext,
  getCurrentActivity,
  getPersonalActivity,
  getPersonalNote,
  getWhoami,
  listCaptures,
  listPersonalActivities,
  listPersonalNotes,
  noteSourceLabel,
  parseListLimit,
  sanitizeNote,
} from "./gobi-personal.js";
import { mintConfirmToken, takeConfirmToken } from "./confirm.js";
import { defaultSpaceSlug, resolveDirectories, spaceToolsEnabled, writesEnabled, type GobiMcpOptions } from "./options.js";
import { listSpacePosts, replyToPersonalPost, replyToSpacePost, resolveSpaceSlug, searchSpacePosts } from "./posts.js";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function query(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams);
}

export function createRestRouter(api: GobiApi, opts?: GobiMcpOptions) {
  const { people, noteSearch } = resolveDirectories(api, opts);

  return async function restRouter(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (!path.startsWith("/v1")) return null;
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
      });
    }
    if (path === "/v1/openapi.json" && req.method === "GET") {
      const { buildOpenApiSpec } = await import("./openapi.js");
      return json(buildOpenApiSpec());
    }

    const q = query(url);
    const limit = q.limit ? Number(q.limit) : undefined;

    try {
      if (path === "/v1/personal/context" && req.method === "GET") {
        return json(await fetchPersonalContext(api, { since: q.since, limit }));
      }
      if (path === "/v1/personal/activity/current" && req.method === "GET") {
        return json({ currentActivity: await getCurrentActivity(api) });
      }
      if (path === "/v1/personal/activities" && req.method === "GET") {
        const { items, pagination } = await listPersonalActivities(api, {
          limit: parseListLimit(limit),
          before: q.before,
        });
        return json({ activities: items.map(compactActivity), pagination: pagination ?? {} });
      }
      const activityMatch = path.match(/^\/v1\/personal\/activities\/([^/]+)$/);
      if (activityMatch && req.method === "GET") {
        const raw = await getPersonalActivity(api, activityMatch[1]!);
        return json({ activity: compactActivity(raw) });
      }
      if (path === "/v1/personal/notes/search" && req.method === "GET") {
        if (!q.q) return json({ error: "q required" }, 400);
        return json(await noteSearch.searchNotes({ q: q.q, limit, before: q.before }));
      }
      if (path === "/v1/personal/notes" && req.method === "GET") {
        const { items, pagination } = await listPersonalNotes(api, {
          limit: parseListLimit(limit),
          before: q.before,
        });
        return json({
          notes: items.map((c) => ({
            id: String(c.publicId ?? c.id ?? "?"),
            title: typeof c.title === "string" ? c.title : null,
            time: typeof c.startTime === "string" ? c.startTime : null,
            summary: null,
            speakers: [] as string[],
            source: typeof c.source === "string" ? c.source : null,
            sourceLabel: noteSourceLabel(c.source),
          })),
          pagination: pagination ?? {},
        });
      }
      const noteMatch = path.match(/^\/v1\/personal\/notes\/([^/]+)$/);
      if (noteMatch && req.method === "GET") {
        return json(sanitizeNote(await getPersonalNote(api, noteMatch[1]!)));
      }
      if (path === "/v1/personal/captures" && req.method === "GET") {
        return json(await listCaptures(api, { limit }));
      }
      if (path === "/v1/whoami" && req.method === "GET") {
        return json(await getWhoami(api));
      }
      if (path === "/v1/people" && req.method === "GET") {
        return json(await people.listPeople({ q: q.q, limit }));
      }
      const personMatch = path.match(/^\/v1\/people\/([^/]+)$/);
      if (personMatch && req.method === "GET") {
        return json(await people.getPerson(personMatch[1]!));
      }

      const personalReply = path.match(/^\/v1\/personal\/posts\/([^/]+)\/replies$/);
      if (personalReply && req.method === "POST") {
        if (!writesEnabled(opts)) return json({ error: "writes disabled" }, 404);
        const body = (await req.json()) as { content?: string; rationale?: string; confirmToken?: string };
        if (!body.content) return json({ error: "content required" }, 400);
        const payload = { postId: personalReply[1]!, content: body.content, rationale: body.rationale ?? "" };
        if (!body.confirmToken) {
          const token = mintConfirmToken("gobi_reply_to_post", payload, `Reply to ${payload.postId}: ${body.content}`);
          return json({
            needsConfirmation: true,
            confirmToken: token,
            preview: `Reply to personal post ${payload.postId}:\n\n${body.content}`,
            action: "gobi_reply_to_post",
            expiresInSeconds: 600,
            instruction: "Retry POST with the same JSON plus confirmToken after the user agrees.",
          });
        }
        if (!takeConfirmToken(body.confirmToken, "gobi_reply_to_post", payload)) {
          return json({ error: "Invalid or expired confirmToken" }, 400);
        }
        return json(await replyToPersonalPost(api, payload.postId, { content: body.content, rationale: body.rationale }));
      }

      if (spaceToolsEnabled(opts)) {
        const spacePosts = path.match(/^\/v1\/spaces\/([^/]+)\/posts$/);
        if (spacePosts && req.method === "GET") {
          const slug = resolveSpaceSlug({ spaceSlug: spacePosts[1], defaultSlug: defaultSpaceSlug(opts) });
          return json(await listSpacePosts(api, slug, { limit, cursor: q.cursor }));
        }
        const spaceSearch = path.match(/^\/v1\/spaces\/([^/]+)\/search$/);
        if (spaceSearch && req.method === "GET") {
          if (!q.q) return json({ error: "q required" }, 400);
          const slug = resolveSpaceSlug({ spaceSlug: spaceSearch[1], defaultSlug: defaultSpaceSlug(opts) });
          return json(await searchSpacePosts(api, slug, { q: q.q, limit, cursor: q.cursor }));
        }
        const spaceReply = path.match(/^\/v1\/spaces\/([^/]+)\/posts\/([^/]+)\/replies$/);
        if (spaceReply && req.method === "POST") {
          const slug = resolveSpaceSlug({ spaceSlug: spaceReply[1], defaultSlug: defaultSpaceSlug(opts) });
          const body = (await req.json()) as { content?: string; rationale?: string; confirmToken?: string };
          if (!body.content) return json({ error: "content required" }, 400);
          const payload = { spaceSlug: slug, postId: spaceReply[2]!, content: body.content, rationale: body.rationale ?? "" };
          if (!body.confirmToken) {
            const token = mintConfirmToken(
              "gobi_reply_to_space_post",
              payload,
              `Reply in ${slug} to ${payload.postId}: ${body.content}`,
            );
            return json({
              needsConfirmation: true,
              confirmToken: token,
              preview: `Reply in space ${slug} to post ${payload.postId}:\n\n${body.content}`,
              action: "gobi_reply_to_space_post",
              expiresInSeconds: 600,
              instruction: "Retry POST with the same JSON plus confirmToken after the user agrees.",
            });
          }
          if (!takeConfirmToken(body.confirmToken, "gobi_reply_to_space_post", payload)) {
            return json({ error: "Invalid or expired confirmToken" }, 400);
          }
          return json(await replyToSpacePost(api, slug, payload.postId, { content: body.content, rationale: body.rationale }));
        }
      }

      return json({ error: "not found" }, 404);
    } catch (err) {
      if (err instanceof NotAuthenticatedError) return json({ error: err.message }, 401);
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: message }, 400);
    }
  };
}
