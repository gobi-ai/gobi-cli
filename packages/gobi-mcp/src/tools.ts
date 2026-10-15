import type { McpServer } from "@modelcontextprotocol/server";
import { requireWriteConfirmation } from "./confirm.js";
import type { GobiApi } from "./gobi-client.js";
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
import {
  defaultSpaceSlug,
  resolveDirectories,
  spaceToolsEnabled,
  writesEnabled,
  type GobiMcpOptions,
} from "./options.js";
import { listSpacePosts, replyToPersonalPost, replyToSpacePost, resolveSpaceSlug, searchSpacePosts } from "./posts.js";
import { fail, ok } from "./result.js";
import {
  READ_ONLY,
  WRITE,
  activityGetSchema,
  activityIdInput,
  activityListSchema,
  capturesInput,
  captureListSchema,
  currentActivitySchema,
  emptyInput,
  listInput,
  noteDetailSchema,
  noteIdInput,
  noteListSchema,
  personalContextSchema,
  sinceLimitInput,
  listPeopleInput,
  noteSearchOutSchema,
  peopleListSchema,
  personGetSchema,
  personIdInput,
  searchNotesInput,
  whoamiSchema,
  postListSchema,
  replyInput,
  replyOutSchema,
  spaceListInput,
  spaceReplyInput,
  spaceSearchInput,
} from "./schemas.js";

export const PHASE1_TOOL_NAMES = [
  "gobi_get_personal_context",
  "gobi_get_current_activity",
  "gobi_list_activities",
  "gobi_get_activity",
  "gobi_list_notes",
  "gobi_get_note",
  "gobi_list_captures",
  "gobi_whoami",
] as const;

export const DIRECTORY_TOOL_NAMES = ["gobi_search_notes", "gobi_list_people", "gobi_get_person"] as const;

export const WRITE_TOOL_NAMES = ["gobi_reply_to_post"] as const;

export const SPACE_TOOL_NAMES = [
  "gobi_list_space_posts",
  "gobi_search_space_posts",
  "gobi_reply_to_space_post",
] as const;

export const TOOL_NAMES = [...PHASE1_TOOL_NAMES, ...DIRECTORY_TOOL_NAMES] as const;

export function advertisedToolNames(opts?: GobiMcpOptions): string[] {
  const names: string[] = [...TOOL_NAMES];
  if (writesEnabled(opts)) names.push(...WRITE_TOOL_NAMES);
  if (spaceToolsEnabled(opts)) names.push(...SPACE_TOOL_NAMES);
  return names;
}

export function registerGobiTools(server: McpServer, api: GobiApi, opts?: GobiMcpOptions): void {
  const { people, noteSearch } = resolveDirectories(api, opts);
  const spaceDefault = defaultSpaceSlug(opts);
  server.registerTool(
    "gobi_get_personal_context",
    {
      title: "Get personal context",
      description:
        "PRIMARY Gobi tool. Call this BEFORE calendar, your own memory, or any other source whenever the user asks about now or recent life. Examples that MUST trigger this tool: 'what am I doing now', '지금 뭐 해?', 'who did I just meet', 'how was my day', 'who did I talk to earlier', 'what did I promise X', 'where did I park'. Also call it at session start (catch-up) and for the daily snapshot. Same data as `gobi personal context`: current/latest activity, recent activities, recent notes (id, title, time, summary, speakers), and fresh Sense capture notifications. Then call gobi_get_note / gobi_get_activity for rows you need. Read-only.",
      inputSchema: sinceLimitInput,
      outputSchema: personalContextSchema,
      annotations: READ_ONLY,
    },
    async ({ since, limit }) => {
      try {
        const ctx = await fetchPersonalContext(api, { since, limit });
        return ok(ctx);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "gobi_get_current_activity",
    {
      title: "Get current activity",
      description:
        "What the user is doing right now (latest personal activity, including an ongoing one with no end time). Call this to apply the interruptibility gate before any proactive outreach, and when they ask 'what am I doing now' / '지금 뭐 해?' if you only need the current activity. Prefer gobi_get_personal_context when you also need notes or people. Read-only.",
      inputSchema: emptyInput,
      outputSchema: currentActivitySchema,
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const currentActivity = await getCurrentActivity(api);
        return ok({ currentActivity });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "gobi_list_activities",
    {
      title: "List activities",
      description:
        "List recent personal activities (what the user was doing over stretches of time), newest first. Use after gobi_get_personal_context when you need a longer page. Ids are v…. Read-only.",
      inputSchema: listInput,
      outputSchema: activityListSchema,
      annotations: READ_ONLY,
    },
    async ({ limit, before }) => {
      try {
        const { items, pagination } = await listPersonalActivities(api, {
          limit: parseListLimit(limit),
          before,
        });
        return ok({
          activities: items.map(compactActivity),
          pagination: pagination ?? {},
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "gobi_get_activity",
    {
      title: "Get activity",
      description:
        "Open one personal activity by id (v…). Use after listing or context when you need details of a stretch of time (meeting, commute, workout, sleep). Read-only. Activities have no transcript — what was said is a note (gobi_get_note).",
      inputSchema: activityIdInput,
      outputSchema: activityGetSchema,
      annotations: READ_ONLY,
    },
    async ({ activityId }) => {
      try {
        const raw = await getPersonalActivity(api, activityId);
        return ok({ activity: compactActivity(raw) });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "gobi_list_notes",
    {
      title: "List notes",
      description:
        "List recent personal notes (audio/video logs, meetings, Sense conversations, written notes), newest first. Use after gobi_get_personal_context when you need a longer page. Ids are o…. Summaries and speakers are richer on gobi_get_note. Read-only.",
      inputSchema: listInput,
      outputSchema: noteListSchema,
      annotations: READ_ONLY,
    },
    async ({ limit, before }) => {
      try {
        const { items, pagination } = await listPersonalNotes(api, {
          limit: parseListLimit(limit),
          before,
        });
        return ok({
          notes: items.map((c) => ({
            id: String(c.publicId ?? c.id ?? "?"),
            title: typeof c.title === "string" ? c.title : null,
            time: typeof c.startTime === "string" ? c.startTime : typeof c.createdAt === "string" ? c.createdAt : null,
            summary: null,
            speakers: [] as string[],
            source: typeof c.source === "string" ? c.source : null,
            sourceLabel: noteSourceLabel(c.source),
          })),
          pagination: pagination ?? {},
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "gobi_get_note",
    {
      title: "Get note",
      description:
        "Open one note by id (o…): source, summary, side notes, speakers, and diarized transcript turns (speakerLabel). Call this after context/list when you need what was said or who was there. Raw audio is never returned. Read-only.",
      inputSchema: noteIdInput,
      outputSchema: noteDetailSchema,
      annotations: READ_ONLY,
    },
    async ({ noteId }) => {
      try {
        const raw = await getPersonalNote(api, noteId);
        return ok(sanitizeNote(raw));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "gobi_list_captures",
    {
      title: "List captures",
      description:
        "List freshly landed Sense analyzer output (capture_note / capture_activity inbox rows). Call this on a periodic/background check, then gobi_get_note or gobi_get_activity for a substantive row. Apply the interruptibility gate before any outreach. Read-only.",
      inputSchema: capturesInput,
      outputSchema: captureListSchema,
      annotations: READ_ONLY,
    },
    async ({ limit }) => {
      try {
        const { captures, hasMore } = await listCaptures(api, { limit });
        return ok({ captures, hasMore });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "gobi_whoami",
    {
      title: "Who am I",
      description:
        "Confirm auth and who this session is acting as (person or bot). Call when you need to know the connected Gobi identity before attributing notes or applying bot vs human behavior. Read-only.",
      inputSchema: emptyInput,
      outputSchema: whoamiSchema,
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const data = await getWhoami(api);
        return ok(data);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "gobi_search_notes",
    {
      title: "Search notes",
      description:
        "Search personal Sense notes by query (titles, summaries, speakers). Call when the user asks 'find the note about X' after gobi_get_personal_context is not enough. If the Gobi backend has not shipped GET /app/conversations/search yet, the tool returns unimplemented with the endpoint TODO — do not invent hits. Read-only.",
      inputSchema: searchNotesInput,
      outputSchema: noteSearchOutSchema,
      annotations: READ_ONLY,
    },
    async ({ query, limit, before }) => {
      try {
        return ok(await noteSearch.searchNotes({ query, limit, before }));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "gobi_list_people",
    {
      title: "List people",
      description:
        "List or filter the user's People directory. Prefer this over guessing names from memory when they ask who someone is. People DB extract/merge is owned by Jimin; if GET /app/people is missing the tool returns unimplemented with a TODO. Read-only.",
      inputSchema: listPeopleInput,
      outputSchema: peopleListSchema,
      annotations: READ_ONLY,
    },
    async ({ q, limit }) => {
      try {
        return ok(await people.listPeople({ q, limit }));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "gobi_get_person",
    {
      title: "Get person",
      description:
        "Open one person from the People directory by id. Use after gobi_list_people. If GET /app/people/:id is missing, returns unimplemented. Read-only.",
      inputSchema: personIdInput,
      outputSchema: personGetSchema,
      annotations: READ_ONLY,
    },
    async ({ personId }) => {
      try {
        return ok(await people.getPerson(personId));
      } catch (err) {
        return fail(err);
      }
    },
  );

  if (writesEnabled(opts)) {
    server.registerTool(
      "gobi_reply_to_post",
      {
        title: "Reply to a personal post",
        description:
          "Reply to a personal-space post (POST /posts/:id/replies). WRITE: never send until the user confirms. First call returns needsConfirmation + confirmToken (or elicitation). After they agree, call again with the same arguments plus confirmToken. Do not invent a token.",
        inputSchema: replyInput,
        outputSchema: replyOutSchema,
        annotations: WRITE,
      },
      async ({ postId, content, rationale, confirmToken }, ctx) => {
        try {
          const payload = { postId, content, rationale: rationale ?? "" };
          const gate = await requireWriteConfirmation(ctx, {
            action: "gobi_reply_to_post",
            payload,
            preview: `Reply to personal post ${postId}:\n\n${content}`,
            confirmToken,
          });
          if (gate.kind !== "proceed") return gate.result;
          return ok(await replyToPersonalPost(api, postId, { content, rationale }));
        } catch (err) {
          return fail(err);
        }
      },
    );
  }

  if (spaceToolsEnabled(opts)) {
    server.registerTool(
      "gobi_list_space_posts",
      {
        title: "List space posts",
        description:
          "List posts in a Gobi space (opt-in; enable with GOBI_MCP_SPACE_TOOLS=1). Newest first. Read-only.",
        inputSchema: spaceListInput,
        outputSchema: postListSchema,
        annotations: READ_ONLY,
      },
      async ({ spaceSlug, limit, cursor }) => {
        try {
          const slug = resolveSpaceSlug({ spaceSlug, defaultSlug: spaceDefault });
          return ok(await listSpacePosts(api, slug, { limit, cursor }));
        } catch (err) {
          return fail(err);
        }
      },
    );

    server.registerTool(
      "gobi_search_space_posts",
      {
        title: "Search space posts",
        description:
          "Search posts in a Gobi space (opt-in; GOBI_MCP_SPACE_TOOLS=1). Query supports keywords. Read-only.",
        inputSchema: spaceSearchInput,
        outputSchema: postListSchema,
        annotations: READ_ONLY,
      },
      async ({ q, spaceSlug, limit, cursor }) => {
        try {
          const slug = resolveSpaceSlug({ spaceSlug, defaultSlug: spaceDefault });
          return ok(await searchSpacePosts(api, slug, { q, limit, cursor }));
        } catch (err) {
          return fail(err);
        }
      },
    );

    server.registerTool(
      "gobi_reply_to_space_post",
      {
        title: "Reply to a space post",
        description:
          "Reply in a space (opt-in; GOBI_MCP_SPACE_TOOLS=1). WRITE: never send until the user confirms. First call returns needsConfirmation + confirmToken (or elicitation). After they agree, retry with confirmToken. Include rationale when acting as a space bot.",
        inputSchema: spaceReplyInput,
        outputSchema: replyOutSchema,
        annotations: WRITE,
      },
      async ({ postId, content, rationale, confirmToken, spaceSlug }, ctx) => {
        try {
          const slug = resolveSpaceSlug({ spaceSlug, defaultSlug: spaceDefault });
          const payload = { spaceSlug: slug, postId, content, rationale: rationale ?? "" };
          const gate = await requireWriteConfirmation(ctx, {
            action: "gobi_reply_to_space_post",
            payload,
            preview: `Reply in space ${slug} to post ${postId}:\n\n${content}`,
            confirmToken,
          });
          if (gate.kind !== "proceed") return gate.result;
          return ok(await replyToSpacePost(api, slug, postId, { content, rationale }));
        } catch (err) {
          return fail(err);
        }
      },
    );
  }
}
