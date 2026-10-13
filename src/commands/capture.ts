import { Command } from "commander";
import { apiGet } from "../client.js";
import { ApiError, GobiError } from "../errors.js";
import {
  isJsonMode,
  jsonOut,
  parseActivityIdentifier,
  parseNoteIdentifier,
} from "./utils.js";

// Shared subcommand trees for the two kinds of RECORD a lane keeps — NOTES and
// ACTIVITIES. A lane is the personal space or a space; each record belongs to
// the lane it was captured into and stays there. (Sharing outside a lane is
// what artifacts are for — see artifact.ts.) Registered under the group that
// owns the lane:
//   • `gobi personal` — notes and activities of your personal space.
//   • `gobi space`    — notes and activities of a space.
//
// A scope only supplies its list call(s); `notes get` hits a lane-independent
// route the backend authorizes off the row itself. `activities get` reads a
// personal activity only (the backend has no by-id read for a space's), so the
// space tree registers `list` alone — its rows already carry every field.
// Raw audio is never exposed.

/** What a note was made from, in the words a person uses. The wire `source`
 *  keeps its stored values (old and new spellings both); this is display only. */
export function noteSourceLabel(source: unknown): string {
  switch (String(source ?? "")) {
    case "mobile":
    case "watch":
    case "desktop":
      return "audio log";
    case "import-video":
    case "video":
    case "post-video":
      return "video log";
    case "meet":
    case "meet-video":
      return "meeting";
    case "import-audio":
    case "import":
    case "post-audio":
      return "imported audio";
    case "sense":
      return "Sense";
    case "text":
      return "written note";
    default:
      return "note";
  }
}

export interface CaptureListResult {
  items: Record<string, unknown>[];
  pagination?: { hasMore?: boolean; nextCursor?: string };
}

export interface ActivityScope {
  /** "personal" | "space" — heading/empty-state copy. */
  readonly label: string;
  /** When true, `list` exposes `--space-slug`, and there is no `get` (see the
   *  note at the top of this file). */
  readonly spaceScoped?: boolean;
  listActivities(params: {
    limit?: number;
    before?: string;
    spaceSlug?: string;
  }): Promise<CaptureListResult>;
}

export interface NoteScope {
  readonly label: string;
  /** When true, `list` exposes `--space-slug` and the value is threaded into
   *  `listNotes` so the scope can resolve which space to read. */
  readonly spaceScoped?: boolean;
  listNotes(params: {
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
  const recorders =
    Array.isArray(a.recorders) && a.recorders.length
      ? `  by ${(a.recorders as Record<string, unknown>[]).map((r) => r.name || `user ${(r as Record<string, unknown>).publicId ?? "?"}`).join(", ")}`
      : "";
  return `- [${a.publicId ?? "?"}] ${a.category ?? "activity"}${details} (${a.start_time}${end})${recorders}`;
}

// One note per line: its title first — what it is about — then what it was made
// from, so a reader can pick the one to open without opening each.
function formatNoteLine(c: Record<string, unknown>): string {
  const durMs = typeof c.durationMs === "number" ? c.durationMs : null;
  const dur = durMs != null ? `, ${Math.max(1, Math.round(durMs / 60000))}m` : "";
  const title = typeof c.title === "string" && c.title.trim() ? c.title.trim() : "(untitled)";
  const status = c.status ? ` [${c.status}]` : "";
  // A space's notes carry the recorder (whose note it is); personal ones don't.
  const rec =
    c.recorder && typeof c.recorder === "object"
      ? `  by ${(c.recorder as Record<string, unknown>).name ?? "someone"}`
      : "";
  // A personal row names its note `publicId`; a space row names the same
  // public id `id`.
  const id = c.publicId ?? c.id ?? "?";
  return `- [${id}] ${title} — ${noteSourceLabel(c.source)}${status} (${c.startTime}${dur})${rec}`;
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

  const list = activities
    .command("list")
    .description(
      `List the ${scope.label === "space" ? "space's" : "personal space's"} activities (newest first).`,
    )
    .option("--limit <n>", "Max items to return (default 30, max 100)")
    .option("--before <cursor>", "Pagination cursor from a previous response (nextCursor)");
  if (scope.spaceScoped) {
    list.option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)");
  }
  list.action(async (opts: { limit?: string; before?: string; spaceSlug?: string }) => {
      const { items, pagination } = await scope.listActivities({
        limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
        before: opts.before,
        spaceSlug: opts.spaceSlug,
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

  // ── Get (by id) ──
  // GET /app/activity/:id authorizes off the row's user_id (the caller and
  // their personal agent via readableUserIds), so it reads a personal activity
  // only. A space's activities are read from `list`, whose rows are complete.
  if (scope.spaceScoped) return;
  activities
    .command("get <activityId>")
    .description(
      "Get one activity's details (visible if you recorded it).",
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

  // No `transcript` subcommand: an activity has no transcript route. What was
  // said is a note: `gobi personal notes get <o…>` (or `gobi space notes get`).
}

// ── Notes ──

export function registerNotesSubcommands(
  parent: Command,
  scope: NoteScope,
  description: string,
): void {
  const notes = parent.command("notes").description(description);

  const list = notes
    .command("list")
    .description(
      `List the ${scope.label === "space" ? "space's" : "personal space's"} notes, newest first — ` +
        "every audio log, video log, meeting, imported recording, Sense-detected " +
        "conversation and written note. People only: an agent opens a note by its id.",
    )
    .option("--limit <n>", "Max items to return (default 30, max 100)")
    .option("--before <cursor>", "Pagination cursor from a previous response (nextCursor)")
    // `--mine`: the space list filters client-side on each row's `mine` flag
    // (GET /spaces/:slug/conversations ignores a mine query). Every personal
    // note is already the caller's.
    .option("--mine", "Only notes you recorded. Filters a space's list; every personal note is already yours");
  // Only the space scope reads a specific space; personal always reads its own.
  if (scope.spaceScoped) {
    list.option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)");
  }
  list.action(
    async (opts: { limit?: string; before?: string; mine?: boolean; spaceSlug?: string }) => {
      const { items, pagination } = await scope.listNotes({
        limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
        before: opts.before,
        mine: opts.mine,
        spaceSlug: opts.spaceSlug,
      });

      if (isJsonMode(notes)) {
        jsonOut({
          notes: items.map((c) => ({ ...c, sourceLabel: noteSourceLabel(c.source) })),
          pagination: pagination ?? {},
        });
        return;
      }
      if (!items.length) {
        console.log("No notes found.");
        return;
      }
      console.log(
        `Notes (${items.length} items, newest first):\n` +
          items.map(formatNoteLine).join("\n") +
          paginationFooter(pagination),
      );
    },
  );

  // ── Get (by id; lane-independent) ──
  //
  // Readable by the note's recorder or by a member of the note's space; an
  // agent reads as the person it acts for. The backend answers 404 both when
  // the id is unknown and when the caller may not read it, so the two are
  // reported together below — neither is fixed by retrying.
  //
  // A note's content, in one view:
  //   • source     — what it was made from (audio log, video log, meeting, …)
  //   • summary    — the AI-generated note body
  //   • side notes — what the USER wrote while recording (null when none)
  //   • artifact   — the shareable ARTIFACT, minted only once the note is
  //                  shared out of its lane (else null)
  //   • transcript — the diarized turns
  //
  // Audio is deliberately NOT exposed: the raw recording is private, and the
  // transcript/summary carry the content a reader needs.
  notes
    .command("get <noteId>")
    .description(
      "Get a note: what it was made from, its summary, side notes, transcript, and the artifact it was shared as (if any). Readable by the recorder or a member of the note's space (an agent reads as the person it acts for). <noteId> is an opaque public id (o…).",
    )
    .action(async (noteId: string) => {
      noteId = parseNoteIdentifier(noteId);
      let resp: Record<string, unknown>;
      try {
        resp = (await apiGet(`/app/conversations/${noteId}/transcript`)) as Record<string, unknown>;
      } catch (err) {
        throw noteReadError(noteId, err);
      }

      if (isJsonMode(notes)) {
        jsonOut({ ...resp, sourceLabel: noteSourceLabel(resp.source) });
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

      console.log(
        `Note ${resp.publicId ?? noteId}` +
          (title ? ` — ${title}` : "") +
          (resp.source ? ` (${noteSourceLabel(resp.source)})` : "") +
          "\n",
      );

      // No readable content: still processing or genuinely silent. Access is
      // settled before we get here — a caller who may not read the note gets
      // the 404 handled above, never an empty shell.
      if (!turns.length && !summary && !sideNotes) {
        const ongoing = resp.ongoing === true || resp.status === "processing";
        console.log(
          ongoing
            ? "Still processing — check back shortly."
            : "No readable content — this note captured no speech and has no " +
                "summary or side notes yet. (Transcript, summary and side notes are readable " +
                "by the recorder or a member of the note's space; an agent reads as the person " +
                "it acts for.)",
        );
        return;
      }

      if (summary) console.log("Summary:\n" + indent(summary) + "\n");
      if (sideNotes) console.log("Side notes:\n" + indent(sideNotes) + "\n");
      // Only when the note has been shared out of its lane as an artifact.
      if (noteArtifactId) {
        console.log(`Shared as artifact: ${noteTitle ?? "(untitled)"} [${noteArtifactId}]\n`);
      }
      printTranscriptTurns(turns);
    });
}

/**
 * The error `notes get` surfaces for a transcript-route failure. The backend
 * answers 404 both for an unknown id and for a caller who may not read the note
 * (not its recorder, not a member of its space), and neither is fixed by
 * retrying — so say exactly that, once. Anything else passes through untouched.
 */
export function noteReadError(noteId: string, err: unknown): unknown {
  if (err instanceof ApiError && err.status === 404) {
    return new GobiError(
      `Note ${noteId} could not be read: it does not exist, or you are not ` +
        "allowed to read it (you are not its recorder and not a member of its space; an agent " +
        "reads as the person it acts for). Retrying will not help.",
      "NOTE_NOT_READABLE",
    );
  }
  return err;
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
