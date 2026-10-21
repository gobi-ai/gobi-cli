import { Command } from "commander";
import { GobiError } from "../errors.js";
import {
  getPersonalActivity,
  getPersonalNote,
  listPersonalActivities,
  listPersonalNotes,
  noteSourceLabel,
  stripFrontmatter,
} from "./capture.js";
import { isJsonMode, jsonOut } from "./utils.js";

export const DEFAULT_CONTEXT_SINCE = "24h";
export const DEFAULT_CONTEXT_LIMIT = 5;
const MAX_CONTEXT_LIMIT = 50;
const LIST_PAGE = 30;
const MAX_LIST_PAGES = 8;

export interface ContextError {
  section: "currentActivity" | "activities" | "notes" | "captures";
  error: string;
}

export interface ContextActivity {
  id: string;
  category: string | null;
  details: string | null;
  start: string | null;
  end: string | null;
}

export interface ContextNote {
  id: string;
  title: string | null;
  time: string | null;
  summary: string | null;
  speakers: string[];
  source: string | null;
  sourceLabel: string;
}

/**
 * A capture that landed in the window: a Sense/recorder note or an analyzer
 * activity, read straight from the notes / activities APIs by createdAt.
 * (The backend stopped writing `capture_note` inbox rows on 2026-09-23 and
 * `capture_activity` rows on 2026-10-17, so the inbox is no longer a source.)
 */
export interface ContextCapture {
  id: string;
  type: "note" | "activity";
  title: string;
  body: string;
  createdAt: string;
}

export interface PersonalContext {
  since: string;
  currentActivity: ContextActivity | null;
  activities: ContextActivity[];
  notes: ContextNote[];
  captures: ContextCapture[];
  errors: ContextError[];
}

const DURATION_RE = /^(\d+)(ms|s|m|h|d|w)$/i;
const DURATION_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 7 * 86_400_000,
};

/**
 * Parse `--since`: a compact duration (`24h`, `7d`, `30m`) or an ISO timestamp.
 * Durations are counted back from `now`.
 */
export function parseSince(input: string, now: Date = new Date()): Date {
  const raw = input.trim();
  if (!raw) {
    throw new GobiError(
      "--since must be a duration (e.g. 24h, 7d, 30m) or an ISO timestamp.",
      "INVALID_SINCE",
    );
  }
  const dur = raw.match(DURATION_RE);
  if (dur) {
    const n = Number(dur[1]);
    const unit = dur[2].toLowerCase();
    return new Date(now.getTime() - n * DURATION_MS[unit]);
  }
  const iso = Date.parse(raw);
  if (!Number.isNaN(iso)) return new Date(iso);
  throw new GobiError(
    `--since must be a duration (e.g. 24h, 7d, 30m) or an ISO timestamp, got "${input}".`,
    "INVALID_SINCE",
  );
}

export function parseContextLimit(input: string): number {
  const n = parseInt(input, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new GobiError("--limit must be a positive integer.", "INVALID_LIMIT");
  }
  return Math.min(n, MAX_CONTEXT_LIMIT);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function parseTime(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t);
}

function itemTime(item: Record<string, unknown>, keys: string[]): Date | null {
  for (const key of keys) {
    const t = parseTime(item[key]);
    if (t) return t;
  }
  return null;
}

function inWindow(item: Record<string, unknown>, keys: string[], since: Date): boolean {
  const t = itemTime(item, keys);
  // No timestamp: keep the row so we don't hide data we can't date.
  if (!t) return true;
  return t.getTime() >= since.getTime();
}

function recordId(item: Record<string, unknown>): string {
  const id = item.publicId ?? item.id;
  return typeof id === "string" && id ? id : "";
}

function compactActivity(a: Record<string, unknown>): ContextActivity {
  const start =
    (typeof a.start_time === "string" && a.start_time) ||
    (typeof a.startTime === "string" && a.startTime) ||
    null;
  const end =
    (typeof a.end_time === "string" && a.end_time) ||
    (typeof a.endTime === "string" && a.endTime) ||
    null;
  return {
    id: recordId(a) || "?",
    category: typeof a.category === "string" ? a.category : null,
    details: typeof a.details === "string" ? a.details : null,
    start,
    end,
  };
}

export function speakersFromTurns(turns: unknown): string[] {
  if (!Array.isArray(turns)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of turns) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as Record<string, unknown>;
    const who =
      (typeof t.speakerLabel === "string" && t.speakerLabel.trim()) ||
      (typeof t.speaker === "string" && t.speaker.trim()) ||
      "";
    if (!who || seen.has(who)) continue;
    seen.add(who);
    out.push(who);
  }
  return out;
}

function compactNote(
  listRow: Record<string, unknown>,
  detail?: Record<string, unknown>,
): ContextNote {
  const src = detail ?? listRow;
  const title =
    (typeof src.title === "string" && src.title.trim()) ||
    (typeof listRow.title === "string" && listRow.title.trim()) ||
    null;
  const time =
    (typeof src.startTime === "string" && src.startTime) ||
    (typeof listRow.startTime === "string" && listRow.startTime) ||
    (typeof src.createdAt === "string" && src.createdAt) ||
    null;
  const summaryRaw = typeof src.summary === "string" ? src.summary : "";
  const summary = summaryRaw ? stripFrontmatter(summaryRaw) : null;
  const source = typeof src.source === "string" ? src.source : typeof listRow.source === "string" ? listRow.source : null;
  return {
    id: recordId(src) || recordId(listRow) || "?",
    title,
    time,
    summary,
    speakers: speakersFromTurns(src.turns),
    source,
    sourceLabel: noteSourceLabel(source),
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

const CAPTURE_TIME_KEYS = ["createdAt", "created_at"];

function noteCapture(n: Record<string, unknown>): ContextCapture {
  return {
    id: recordId(n) || "?",
    type: "note",
    title: str(n.title).trim() || "(untitled note)",
    body: noteSourceLabel(typeof n.source === "string" ? n.source : null),
    createdAt: str(itemTime(n, [...CAPTURE_TIME_KEYS, "startTime"])?.toISOString()),
  };
}

function activityCapture(a: Record<string, unknown>): ContextCapture {
  return {
    id: recordId(a) || "?",
    type: "activity",
    title: str(a.category) || "activity",
    body: str(a.details),
    createdAt: str(itemTime(a, [...CAPTURE_TIME_KEYS, "start_time", "startTime"])?.toISOString()),
  };
}

/**
 * Walk a newest-first list until we have `limit` rows in the window, we pass
 * `since` (older rows follow), or the list runs dry. Caps pages so a sparse
 * window cannot walk forever.
 */
async function collectRecent(
  listPage: (params: { limit: number; before?: string }) => Promise<{
    items: Record<string, unknown>[];
    pagination?: { hasMore?: boolean; nextCursor?: string };
  }>,
  timeKeys: string[],
  since: Date,
  limit: number,
): Promise<{ items: Record<string, unknown>[]; first: Record<string, unknown> | null }> {
  const items: Record<string, unknown>[] = [];
  let first: Record<string, unknown> | null = null;
  let before: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const { items: rows, pagination } = await listPage({ limit: LIST_PAGE, before });
    if (!first && rows[0]) first = rows[0];
    if (!rows.length) break;

    let passedWindow = false;
    for (const row of rows) {
      const t = itemTime(row, timeKeys);
      if (t && t.getTime() < since.getTime()) {
        passedWindow = true;
        break;
      }
      if (inWindow(row, timeKeys, since)) items.push(row);
      if (items.length >= limit) {
        return { items: items.slice(0, limit), first };
      }
    }
    if (passedWindow) break;
    if (!pagination?.hasMore || !pagination.nextCursor) break;
    before = pagination.nextCursor;
  }
  return { items: items.slice(0, limit), first };
}

async function loadActivities(
  since: Date,
  limit: number,
): Promise<{ current: ContextActivity | null; recent: ContextActivity[]; errors: ContextError[] }> {
  const errors: ContextError[] = [];
  const { items, first } = await collectRecent(
    listPersonalActivities,
    ["start_time", "startTime"],
    since,
    limit,
  );

  let current: ContextActivity | null = null;
  if (first) {
    const id = recordId(first);
    if (id) {
      try {
        current = compactActivity(await getPersonalActivity(id));
      } catch (err) {
        errors.push({ section: "currentActivity", error: errorMessage(err) });
        current = compactActivity(first);
      }
    } else {
      current = compactActivity(first);
    }
  }

  return { current, recent: items.map(compactActivity), errors };
}

async function loadNotes(since: Date, limit: number): Promise<{ notes: ContextNote[]; errors: ContextError[] }> {
  const { items } = await collectRecent(listPersonalNotes, ["startTime", "createdAt"], since, limit);
  const errors: ContextError[] = [];
  const notes = await Promise.all(
    items.map(async (row) => {
      const id = recordId(row);
      if (!id) return compactNote(row);
      try {
        return compactNote(row, await getPersonalNote(id));
      } catch (err) {
        errors.push({ section: "notes", error: errorMessage(err) });
        return compactNote(row);
      }
    }),
  );
  return { notes, errors };
}

async function loadCaptures(since: Date, limit: number): Promise<ContextCapture[]> {
  // Captures = notes + activities that LANDED (createdAt) in the window,
  // newest first. Falls back to start time for rows without createdAt.
  const [notes, activities] = await Promise.all([
    collectRecent(listPersonalNotes, [...CAPTURE_TIME_KEYS, "startTime"], since, limit),
    collectRecent(listPersonalActivities, [...CAPTURE_TIME_KEYS, "start_time", "startTime"], since, limit),
  ]);
  const all = [...notes.items.map(noteCapture), ...activities.items.map(activityCapture)];
  all.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  return all.slice(0, limit);
}

/** Compose the snapshot. Each section is isolated so one failure cannot blank the rest. */
export async function fetchPersonalContext(opts: {
  since: Date;
  limit: number;
}): Promise<PersonalContext> {
  const { since, limit } = opts;
  const errors: ContextError[] = [];

  const [activitiesSettled, notesSettled, capturesSettled] = await Promise.allSettled([
    loadActivities(since, limit),
    loadNotes(since, limit),
    loadCaptures(since, limit),
  ]);

  let currentActivity: ContextActivity | null = null;
  let activities: ContextActivity[] = [];
  if (activitiesSettled.status === "fulfilled") {
    currentActivity = activitiesSettled.value.current;
    activities = activitiesSettled.value.recent;
    errors.push(...activitiesSettled.value.errors);
  } else {
    errors.push({ section: "activities", error: errorMessage(activitiesSettled.reason) });
  }

  let notes: ContextNote[] = [];
  if (notesSettled.status === "fulfilled") {
    notes = notesSettled.value.notes;
    errors.push(...notesSettled.value.errors);
  } else {
    errors.push({ section: "notes", error: errorMessage(notesSettled.reason) });
  }

  let captures: ContextCapture[] = [];
  if (capturesSettled.status === "fulfilled") {
    captures = capturesSettled.value;
  } else {
    errors.push({ section: "captures", error: errorMessage(capturesSettled.reason) });
  }

  return {
    since: since.toISOString(),
    currentActivity,
    activities,
    notes,
    captures,
    errors,
  };
}

function formatActivityLine(a: ContextActivity): string {
  const end = a.end ? ` → ${a.end}` : " → ongoing";
  const details = a.details ? `: ${a.details}` : "";
  const start = a.start ?? "?";
  return `- [${a.id}] ${a.category ?? "activity"}${details} (${start}${end})`;
}

function formatNoteBlock(n: ContextNote): string {
  const title = n.title || "(untitled)";
  const when = n.time ?? "?";
  const lines = [`- [${n.id}] ${title} — ${n.sourceLabel} (${when})`];
  if (n.speakers.length) lines.push(`    Speakers: ${n.speakers.join(", ")}`);
  if (n.summary) {
    const oneLine = n.summary.replace(/\s+/g, " ").trim();
    const clipped = oneLine.length > 200 ? oneLine.slice(0, 200) + "…" : oneLine;
    lines.push(`    ${clipped}`);
  }
  return lines.join("\n");
}

export function formatPersonalContext(ctx: PersonalContext): string {
  const blocks: string[] = [`Personal context since ${ctx.since}`];

  blocks.push("");
  if (ctx.currentActivity) {
    blocks.push("Current activity:");
    blocks.push("  " + formatActivityLine(ctx.currentActivity).replace(/^- /, ""));
  } else {
    blocks.push("Current activity: none");
  }

  blocks.push("");
  if (ctx.activities.length) {
    blocks.push(`Recent activities (${ctx.activities.length}):`);
    blocks.push(ctx.activities.map(formatActivityLine).join("\n"));
  } else {
    blocks.push("Recent activities: none");
  }

  blocks.push("");
  if (ctx.notes.length) {
    blocks.push(`Recent notes (${ctx.notes.length}):`);
    blocks.push(ctx.notes.map(formatNoteBlock).join("\n"));
  } else {
    blocks.push("Recent notes: none");
  }

  blocks.push("");
  if (ctx.captures.length) {
    blocks.push(`Fresh captures (${ctx.captures.length}):`);
    blocks.push(
      ctx.captures
        .map((n) => {
          const body = n.body ? `\n    ${n.body.replace(/\n/g, " ").slice(0, 100)}` : "";
          return `- ${n.title}${body}\n    ${n.type} · ${n.createdAt || "?"} · id=${n.id}`;
        })
        .join("\n"),
    );
  } else {
    blocks.push("Fresh captures: none");
  }

  if (ctx.errors.length) {
    blocks.push("");
    blocks.push("Errors (other sections still returned):");
    for (const e of ctx.errors) {
      blocks.push(`  - ${e.section}: ${e.error}`);
    }
  }

  return blocks.join("\n");
}

export function registerContextCommand(personal: Command): void {
  personal
    .command("context")
    .description(
      "Compact snapshot of recent real-world context for assistant agents: the current/latest activity, recent activities, recent notes (id, title, time, summary, speakers), and fresh captures (notes/activities created in the window). Read-only. Composes `personal notes list/get` and `personal activities list/get` — no new backend endpoint.",
    )
    .option(
      "--since <when>",
      "Window start: duration (24h, 7d, 30m) or ISO timestamp (default: 24h)",
      DEFAULT_CONTEXT_SINCE,
    )
    .option(
      "--limit <n>",
      `Max items per section (default ${DEFAULT_CONTEXT_LIMIT}, max ${MAX_CONTEXT_LIMIT})`,
      String(DEFAULT_CONTEXT_LIMIT),
    )
    .action(async (opts: { since: string; limit: string }) => {
      const since = parseSince(opts.since);
      const limit = parseContextLimit(opts.limit);
      const ctx = await fetchPersonalContext({ since, limit });

      if (isJsonMode(personal)) {
        jsonOut(ctx);
        return;
      }
      console.log(formatPersonalContext(ctx));
    });
}
