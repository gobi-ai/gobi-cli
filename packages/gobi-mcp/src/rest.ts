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
import { resolveDirectories, type GobiMcpOptions } from "./options.js";

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
      return json({ error: "not found" }, 404);
    } catch (err) {
      if (err instanceof NotAuthenticatedError) return json({ error: err.message }, 401);
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: message }, 400);
    }
  };
}
