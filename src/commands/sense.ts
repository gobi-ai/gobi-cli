import { Command } from "commander";
import { apiGet } from "../client.js";
import { isJsonMode, jsonOut } from "./utils.js";

// ── Scope ──
//
// How an activities/conversations subcommand group loads its list at action
// time. Sense data (activities + conversations) is user-owned but tagged with
// the space it was captured in; the two scopes differ only in which endpoint a
// list hits, so each scope just provides the two list calls:
//   • `space`    → the per-space routes (`/spaces/:slug/{activities,conversations}`),
//     which return EVERY member's records, keyset-paginated.
//   • `personal` → the personal routes (`/app/activities` paginated;
//     `/app/conversations` spans all the user's scopes, so it's filtered to the personal
//     scope — spaceId 0 — client-side).
// The by-id leaves (activity get/transcript, conversation transcript/audio) are
// scope-independent — the backend authorizes them off the row itself — so they
// register identically under both groups.
export interface SenseListResult {
  items: Record<string, unknown>[];
  pagination?: { hasMore?: boolean; nextCursor?: string };
}

export interface SenseScope {
  // "personal" | "space" — used in headings and empty-state copy.
  readonly label: string;
  listActivities(params: { limit?: number; before?: string; mine?: boolean }): Promise<SenseListResult>;
  listConversations(params: { limit?: number; before?: string; mine?: boolean }): Promise<SenseListResult>;
}

// ── Shared rendering ──

interface TranscriptTurn {
  speaker: string;
  speakerLabel?: string;
  timestamp: string;
  endTimestamp?: string;
  text: string;
}

// One-liner for a transcript turn. The backend resolves speaker identities at
// read time into `speakerLabel` (a managed-voice name, "Me", a session-stable
// "Speaker N", or "Unknown"); fall back to the raw diarization token only if
// it's somehow absent.
function formatTurnLine(t: TranscriptTurn): string {
  const who = t.speakerLabel || t.speaker || "Unknown";
  return `- ${who} (${t.timestamp}): ${t.text}`;
}

function printTranscriptTurns(turns: TranscriptTurn[]): void {
  const cleaned = (turns || [])
    .map((t) => ({ ...t, text: String(t.text ?? "").trim() }))
    .filter((t) => t.text);
  if (!cleaned.length) {
    console.log("No transcript available.");
    return;
  }
  console.log(
    `Transcript (${cleaned.length} turns):\n` + cleaned.map(formatTurnLine).join("\n"),
  );
}

function formatActivityLine(a: Record<string, unknown>): string {
  const end = a.end_time ? ` → ${a.end_time}` : " → ongoing";
  const details = a.details ? `: ${a.details}` : "";
  // Space activities carry the recorder(s); personal ones don't.
  const recorders = Array.isArray(a.recorders) && a.recorders.length
    ? `  by ${(a.recorders as Record<string, unknown>[])
        .map((r) => r.name || `user ${r.id}`)
        .join(", ")}`
    : "";
  return `- [${a.id}] ${a.category ?? "activity"}${details} (${a.start_time}${end})${recorders}`;
}

function formatConversationLine(c: Record<string, unknown>): string {
  const durMs = typeof c.durationMs === "number" ? c.durationMs : null;
  const dur = durMs != null ? ` (${Math.max(1, Math.round(durMs / 60000))}m)` : "";
  const cat = c.category ? ` — ${c.category}` : "";
  const status = c.status ? ` [${c.status}]` : "";
  // Space conversations carry the recorder (whose conversation it is); personal
  // ones don't.
  const rec =
    c.recorder && typeof c.recorder === "object"
      ? `  by ${(c.recorder as Record<string, unknown>).name ?? "someone"}`
      : "";
  return `- [${c.id}] ${c.source ?? "conversation"}${status}${cat} (${c.startTime}${dur})${rec}`;
}

function paginationFooter(pagination?: { hasMore?: boolean; nextCursor?: string }): string {
  return pagination?.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
}

// ── Activities ──
//
// Registers the `activities` subcommand tree under `parent` (a `gobi space` or
// `gobi personal` group). Replaces the old top-level `gobi sense list-activities`.
export function registerActivitiesSubcommands(
  parent: Command,
  scope: SenseScope,
  description: string,
): void {
  const activities = parent.command("activities").description(description);

  // ── List ──

  activities
    .command("list")
    .description("List Sense activities in this scope (newest first).")
    .option("--limit <n>", "Max items to return (default 30, max 100)")
    .option("--before <cursor>", "Pagination cursor from a previous response (nextCursor)")
    .option("--mine", "Only activities you recorded (space scope; no-op for personal, already yours)")
    .action(async (opts: { limit?: string; before?: string; mine?: boolean }) => {
      const { items, pagination } = await scope.listActivities({
        limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
        before: opts.before,
        mine: opts.mine,
      });

      if (isJsonMode(activities)) {
        jsonOut({ activities: items, pagination: pagination ?? {} });
        return;
      }

      if (!items.length) {
        console.log("No activities found.");
        return;
      }

      console.log(
        `Activities (${items.length} items, newest first):\n` +
          items.map(formatActivityLine).join("\n") +
          paginationFooter(pagination),
      );
    });

  // ── Get (by id; scope-independent) ──

  activities
    .command("get <activityId>")
    .description("Get one activity's details (visible to you if you recorded it or are a member of its space).")
    .action(async (activityId: string) => {
      const a = (await apiGet(`/app/activity/${activityId}`)) as Record<string, unknown>;

      if (isJsonMode(activities)) {
        jsonOut(a);
        return;
      }

      console.log(
        `Activity ${a.id}\n` +
          `  category: ${a.category ?? "(none)"}\n` +
          (a.details ? `  details:  ${a.details}\n` : "") +
          `  start:    ${a.start_time}\n` +
          `  end:      ${a.end_time ?? "ongoing"}`,
      );
    });

  // ── Transcript (by id; owner-only) ──

  activities
    .command("transcript <activityId>")
    .description("Get an activity's transcript (owner-only; 403 for other space members).")
    .action(async (activityId: string) => {
      const resp = (await apiGet(`/app/activity/${activityId}/transcript`)) as Record<string, unknown>;
      const turns = ((resp.turns as unknown[]) || []) as TranscriptTurn[];

      if (isJsonMode(activities)) {
        jsonOut({ turns });
        return;
      }

      printTranscriptTurns(turns);
    });
}

// ── Conversations ──
//
// Registers the `conversations` subcommand tree under `parent`. The `space`
// group lists via `/spaces/:slug/conversations` (every member's, keyset-paged);
// the `personal` group lists via the cross-scope `/app/conversations` filtered
// to the personal scope. Replaces the old top-level `gobi sense list-transcriptions`.
export function registerConversationsSubcommands(
  parent: Command,
  scope: SenseScope,
  description: string,
): void {
  const conversations = parent.command("conversations").description(description);

  // ── List ──

  conversations
    .command("list")
    .description("List conversations captured in this scope (newest first).")
    .option("--limit <n>", "Max items to return (default 30, max 100). Ignored for personal.")
    .option("--before <cursor>", "Pagination cursor from a previous response (nextCursor). Space scope only.")
    .option("--mine", "Only conversations you recorded (space scope; no-op for personal, already yours)")
    .action(async (opts: { limit?: string; before?: string; mine?: boolean }) => {
      const { items, pagination } = await scope.listConversations({
        limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
        before: opts.before,
        mine: opts.mine,
      });

      if (isJsonMode(conversations)) {
        jsonOut({ conversations: items, pagination: pagination ?? {} });
        return;
      }

      if (!items.length) {
        console.log("No conversations found.");
        return;
      }

      console.log(
        `Conversations (${items.length} items, newest first):\n` +
          items.map(formatConversationLine).join("\n") +
          paginationFooter(pagination),
      );
    });

  // ── Transcript (by id) ──

  conversations
    .command("transcript <conversationId>")
    .description("Get a conversation's transcript and summary (owner-only).")
    .action(async (conversationId: string) => {
      const resp = (await apiGet(
        `/app/conversations/${conversationId}/transcript`,
      )) as Record<string, unknown>;
      const turns = ((resp.turns as unknown[]) || []) as TranscriptTurn[];
      const summary = (resp.summary as Record<string, unknown> | null) || null;

      if (isJsonMode(conversations)) {
        jsonOut(resp);
        return;
      }

      if (summary && (summary.category || summary.details)) {
        console.log(
          `Summary: ${summary.category ?? "(uncategorized)"}` +
            (summary.details ? `\n  ${summary.details}` : ""),
        );
        console.log("");
      }
      if (resp.status && resp.status !== "ready") {
        console.log(`Status: ${resp.status}`);
      }
      printTranscriptTurns(turns);
    });

  // ── Audio (by id; signed URL, owner-only) ──

  conversations
    .command("audio <conversationId>")
    .description("Get a signed URL for a conversation's combined recording (owner-only; null for analyzer conversations).")
    .action(async (conversationId: string) => {
      const resp = (await apiGet(
        `/app/conversations/${conversationId}/audio`,
      )) as Record<string, unknown>;
      const url = (resp.url as string | null) ?? null;

      if (isJsonMode(conversations)) {
        jsonOut({ url });
        return;
      }

      if (!url) {
        console.log("No audio available for this conversation.");
        return;
      }
      console.log(url);
    });
}
