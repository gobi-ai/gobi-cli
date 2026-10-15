import type { McpServer } from "@modelcontextprotocol/server";
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
import { fail, ok } from "./result.js";
import {
  READ_ONLY,
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
  whoamiSchema,
} from "./schemas.js";

export const TOOL_NAMES = [
  "gobi_get_personal_context",
  "gobi_get_current_activity",
  "gobi_list_activities",
  "gobi_get_activity",
  "gobi_list_notes",
  "gobi_get_note",
  "gobi_list_captures",
  "gobi_whoami",
] as const;

export function registerGobiTools(server: McpServer, api: GobiApi): void {
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
}
