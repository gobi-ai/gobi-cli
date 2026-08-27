import { Command } from "commander";
import { apiGet } from "../client.js";
import {
  isJsonMode,
  jsonOut,
  parseActivityIdentifier,
  parseConversationIdentifier,
} from "./utils.js";

// Shared subcommand trees for capture-derived data — Sense/Badge ACTIVITIES and
// (Sense-ambient + phone/desktop-intentional) CONVERSATIONS. Registered under a
// parent group so the same trees serve both scopes without a top-level `sense`
// command:
//   • `gobi personal` — activities AND conversations, the personal core.
//   • `gobi space`    — conversations only. There is no space-scoped activities
//     route: an activity is always filed in the personal core (space_id 0), so a
//     space has none to list (see the backend's `:spaceSlug/conversations` note).
//
// A scope only supplies its list call(s); the by-id leaves (activity
// get/transcript, conversation get) hit scope-independent routes that the
// backend authorizes off the row itself, so they are shared verbatim. Raw
// audio is intentionally never exposed — private by default.

export interface CaptureListResult {
  items: Record<string, unknown>[];
  pagination?: { hasMore?: boolean; nextCursor?: string };
}

export interface ActivityScope {
  /** "personal" | "space" — heading/empty-state copy. */
  readonly label: string;
  listActivities(params: {
    limit?: number;
    before?: string;
    mine?: boolean;
  }): Promise<CaptureListResult>;
}

export interface ConversationScope {
  readonly label: string;
  /** When true, `list` exposes `--space-slug` and the value is threaded into
   *  `listConversations` so the scope can resolve which space to read. */
  readonly spaceScoped?: boolean;
  listConversations(params: {
    limit?: number;
    before?: string;
    mine?: boolean;
    spaceSlug?: string;
  }): Promise<CaptureListResult>;
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
  console.log(`Transcript (${cleaned.length} turns):\n` + cleaned.map(formatTurnLine).join("\n"));
}

function formatActivityLine(a: Record<string, unknown>): string {
  const end = a.end_time ? ` → ${a.end_time}` : " → ongoing";
  const details = a.details ? `: ${a.details}` : "";
  // Space activities carry the recorder(s); personal ones don't.
  const recorders =
    Array.isArray(a.recorders) && a.recorders.length
      ? `  by ${(a.recorders as Record<string, unknown>[]).map((r) => r.name || `user ${(r as Record<string, unknown>).publicId ?? "?"}`).join(", ")}`
      : "";
  return `- [${a.publicId ?? "?"}] ${a.category ?? "activity"}${details} (${a.start_time}${end})${recorders}`;
}

function formatConversationLine(c: Record<string, unknown>): string {
  const durMs = typeof c.durationMs === "number" ? c.durationMs : null;
  const dur = durMs != null ? ` (${Math.max(1, Math.round(durMs / 60000))}m)` : "";
  const cat = c.category ? ` — ${c.category}` : "";
  const status = c.status ? ` [${c.status}]` : "";
  // `source` distinguishes ambient (sense) from intentional (mobile/desktop)
  // capture — a first-class field worth surfacing on the line.
  const source = c.source ?? "conversation";
  // Space conversations carry the recorder (whose conversation it is); personal
  // ones don't.
  const rec =
    c.recorder && typeof c.recorder === "object"
      ? `  by ${(c.recorder as Record<string, unknown>).name ?? "someone"}`
      : "";
  return `- [${c.publicId ?? "?"}] ${source}${status}${cat} (${c.startTime}${dur})${rec}`;
}

function paginationFooter(pagination?: { hasMore?: boolean; nextCursor?: string }): string {
  return pagination?.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
}

// ── Activities ──

export function registerActivitiesSubcommands(
  parent: Command,
  scope: ActivityScope,
  description: string,
): void {
  const activities = parent.command("activities").description(description);

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
    .description(
      "Get one activity's details (visible to you if you recorded it or are a member of its space).",
    )
    .action(async (activityId: string) => {
      activityId = parseActivityIdentifier(activityId);
      const a = (await apiGet(`/app/activity/${activityId}`)) as Record<string, unknown>;
      if (isJsonMode(activities)) {
        jsonOut(a);
        return;
      }
      console.log(
        `Activity ${a.publicId ?? "?"}\n` +
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
      activityId = parseActivityIdentifier(activityId);
      const resp = (await apiGet(
        `/app/activity/${activityId}/transcript`,
      )) as Record<string, unknown>;
      const turns = ((resp.turns as unknown[]) || []) as TranscriptTurn[];
      if (isJsonMode(activities)) {
        jsonOut({ turns });
        return;
      }
      printTranscriptTurns(turns);
    });
}

// ── Conversations ──

export function registerConversationsSubcommands(
  parent: Command,
  scope: ConversationScope,
  description: string,
): void {
  const conversations = parent.command("conversations").description(description);

  const list = conversations
    .command("list")
    .description("List conversations captured in this scope (newest first).")
    .option("--limit <n>", "Max items to return (default 30, max 100). Ignored for personal.")
    .option(
      "--before <cursor>",
      "Pagination cursor from a previous response (nextCursor). Space scope only.",
    )
    .option("--mine", "Only conversations you recorded (space scope; no-op for personal, already yours)");
  // Only the space scope reads a specific space; personal always reads the core.
  if (scope.spaceScoped) {
    list.option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)");
  }
  list.action(
    async (opts: { limit?: string; before?: string; mine?: boolean; spaceSlug?: string }) => {
      const { items, pagination } = await scope.listConversations({
        limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
        before: opts.before,
        mine: opts.mine,
        spaceSlug: opts.spaceSlug,
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
    },
  );

  // ── Get (by id; owner-only, scope-independent) ──
  //
  // A conversation's four content components, in one view:
  //   • summary    — the AI-generated note body, inline on the conversation
  //   • side notes — what the USER wrote in the recorder (null when none)
  //   • note       — the shareable note ARTIFACT, minted only once shared
  //                  (else the summary lives inline and this is null)
  //   • transcript — the diarized turns
  //
  // Audio is deliberately NOT exposed: the raw recording is private, and the
  // transcript/summary carry the content a reader needs.
  conversations
    .command("get <conversationId>")
    .description(
      "Get a conversation's summary, side notes, linked note, and transcript (owner-only). <conversationId> is an opaque public id (o…).",
    )
    .action(async (conversationId: string) => {
      conversationId = parseConversationIdentifier(conversationId);
      const resp = (await apiGet(
        `/app/conversations/${conversationId}/transcript`,
      )) as Record<string, unknown>;

      if (isJsonMode(conversations)) {
        jsonOut(resp);
        return;
      }

      const turns = ((resp.turns as unknown[]) || []) as TranscriptTurn[];
      const title = typeof resp.title === "string" ? resp.title : null;
      // The summary is the generated note body — markdown with a YAML
      // frontmatter block whose `title:` duplicates the header; drop it for
      // readable output (the raw form stays in --json).
      const summary = typeof resp.summary === "string" ? stripFrontmatter(resp.summary) : "";
      const sideNotes = typeof resp.sideNotes === "string" ? resp.sideNotes.trim() : "";
      const noteArtifactId = (resp.noteArtifactId as string | null) ?? null;
      const noteTitle = (resp.noteTitle as string | null) ?? null;

      console.log(`Conversation ${resp.publicId ?? conversationId}` + (title ? ` — ${title}` : "") + "\n");

      // No readable content: still processing, genuinely silent, or owner-gated.
      // The transcript route returns an empty shell (no turns/summary/notes) to a
      // non-recorder, indistinguishable from a truly empty capture — so say both.
      if (!turns.length && !summary && !sideNotes) {
        const ongoing = resp.ongoing === true || resp.status === "processing";
        console.log(
          ongoing
            ? "Still processing — check back shortly."
            : "No readable content — this conversation captured no speech, or you " +
                "are not its recorder (transcript, summary and notes are owner-only).",
        );
        return;
      }

      if (summary) console.log("Summary:\n" + indent(summary) + "\n");
      if (sideNotes) console.log("Side notes:\n" + indent(sideNotes) + "\n");
      // Only surface the shareable note ARTIFACT when one has been minted; the
      // common case keeps the note inline on `summary` above, so silence there.
      if (noteArtifactId) {
        console.log(`Note artifact: ${noteTitle ?? "(untitled)"} [${noteArtifactId}]\n`);
      }
      printTranscriptTurns(turns);
    });
}

/** Indent a possibly-multi-line block two spaces for nested display. */
function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
}

/** Strip a leading YAML frontmatter block (`---\n…\n---`) from note markdown so
 *  terminal output shows the body, not the metadata header. No-op when absent. */
function stripFrontmatter(md: string): string {
  const m = md.match(/^---\n[\s\S]*?\n---\n?/);
  return m ? md.slice(m[0].length).trim() : md;
}
