/**
 * Personal-lane reads: notes, activities, captures, whoami, and the
 * `personal context` snapshot. Adapted from gobi-cli
 * (`src/commands/capture.ts`, `src/commands/context.ts`,
 * `src/commands/notifications.ts`) at https://github.com/gobi-ai/gobi-cli
 * Copyright (c) 2025-2026 Gobi AI, MIT License.
 */

import { ApiError, GobiError, type GobiApi } from "./gobi-client.js";

export const DEFAULT_CONTEXT_SINCE = "24h";
export const DEFAULT_CONTEXT_LIMIT = 5;
export const MAX_CONTEXT_LIMIT = 50;
export const DEFAULT_LIST_LIMIT = 30;
export const MAX_LIST_LIMIT = 100;

const LIST_PAGE = 30;
const MAX_LIST_PAGES = 8;
const NOTIF_MAX_PAGES = 20;
const NOTIF_SERVER_PAGE = 50;

const NOTE_PUBLIC_ID_RE = /^o[0-9a-z]{10,31}$/i;
const ACTIVITY_PUBLIC_ID_RE = /^v[0-9a-z]{10,31}$/i;
const CAPTURE_TYPES = new Set(["capture_note", "capture_activity"]);

export function parseNoteId(value: string): string {
  const v = value.trim();
  if (NOTE_PUBLIC_ID_RE.test(v)) return v;
  throw new GobiError("noteId must be a publicId (o…).", "INVALID_NOTE_ID");
}

export function parseActivityId(value: string): string {
  const v = value.trim();
  if (ACTIVITY_PUBLIC_ID_RE.test(v)) return v;
  throw new GobiError("activityId must be a publicId (v…).", "INVALID_ACTIVITY_ID");
}

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

export function stripFrontmatter(md: string): string {
  const m = md.match(/^---\n[\s\S]*?\n---\n?/);
  return m ? md.slice(m[0].length).trim() : md;
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

const DURATION_RE = /^(\d+)(ms|s|m|h|d|w)$/i;
const DURATION_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 7 * 86_400_000,
};

export function parseSince(input: string, now: Date = new Date()): Date {
  const raw = input.trim();
  if (!raw) {
    throw new GobiError(
      "since must be a duration (e.g. 24h, 7d, 30m) or an ISO timestamp.",
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
    `since must be a duration (e.g. 24h, 7d, 30m) or an ISO timestamp, got "${input}".`,
    "INVALID_SINCE",
  );
}

export function parseContextLimit(input: number | string | undefined): number {
  const n = typeof input === "number" ? input : parseInt(String(input ?? DEFAULT_CONTEXT_LIMIT), 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new GobiError("limit must be a positive integer.", "INVALID_LIMIT");
  }
  return Math.min(n, MAX_CONTEXT_LIMIT);
}

export function parseListLimit(input: number | string | undefined): number {
  const n = typeof input === "number" ? input : parseInt(String(input ?? DEFAULT_LIST_LIMIT), 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new GobiError("limit must be a positive integer.", "INVALID_LIMIT");
  }
  return Math.min(n, MAX_LIST_LIMIT);
}

export interface CaptureListResult {
  items: Record<string, unknown>[];
  pagination?: { hasMore?: boolean; nextCursor?: string };
}

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

export interface ContextCapture {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface PersonalContext {
  since: string;
  currentActivity: ContextActivity | null;
  activities: ContextActivity[];
  notes: ContextNote[];
  captures: ContextCapture[];
  errors: ContextError[];
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  read: boolean;
  createdAt: string;
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
  if (!t) return true;
  return t.getTime() >= since.getTime();
}

function recordId(item: Record<string, unknown>): string {
  const id = item.publicId ?? item.id;
  return typeof id === "string" && id ? id : "";
}

export function compactActivity(a: Record<string, unknown>): ContextActivity {
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

function compactNote(listRow: Record<string, unknown>, detail?: Record<string, unknown>): ContextNote {
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
  const source =
    typeof src.source === "string" ? src.source : typeof listRow.source === "string" ? listRow.source : null;
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

function compactCapture(n: NotificationRow): ContextCapture {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt,
    read: n.read,
  };
}

export async function listPersonalActivities(
  api: GobiApi,
  params?: { limit?: number; before?: string },
): Promise<CaptureListResult> {
  const resp = (await api.get("/app/activities", params)) as Record<string, unknown>;
  return {
    items: ((resp.activities as unknown[]) || []) as Record<string, unknown>[],
    pagination: resp.pagination as { hasMore?: boolean; nextCursor?: string } | undefined,
  };
}

export async function getPersonalActivity(
  api: GobiApi,
  activityId: string,
): Promise<Record<string, unknown>> {
  return (await api.get(`/app/activity/${parseActivityId(activityId)}`)) as Record<string, unknown>;
}

export async function listPersonalNotes(
  api: GobiApi,
  params?: { limit?: number; before?: string },
): Promise<CaptureListResult> {
  const resp = (await api.get("/app/conversations", {
    limit: params?.limit,
    before: params?.before,
  })) as Record<string, unknown>;
  return {
    items: ((resp.conversations as unknown[]) || []) as Record<string, unknown>[],
    pagination: resp.pagination as { hasMore?: boolean; nextCursor?: string } | undefined,
  };
}

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

export async function getPersonalNote(api: GobiApi, noteId: string): Promise<Record<string, unknown>> {
  const id = parseNoteId(noteId);
  try {
    return (await api.get(`/app/conversations/${id}/transcript`)) as Record<string, unknown>;
  } catch (err) {
    throw noteReadError(id, err);
  }
}

export function sanitizeNote(detail: Record<string, unknown>): Record<string, unknown> {
  const turns = Array.isArray(detail.turns)
    ? (detail.turns as Record<string, unknown>[]).map((t) => ({
        speaker: typeof t.speaker === "string" ? t.speaker : "",
        speakerLabel: typeof t.speakerLabel === "string" ? t.speakerLabel : undefined,
        timestamp: typeof t.timestamp === "string" ? t.timestamp : "",
        endTimestamp: typeof t.endTimestamp === "string" ? t.endTimestamp : undefined,
        text: String(t.text ?? ""),
      }))
    : [];
  const source = typeof detail.source === "string" ? detail.source : null;
  const summaryRaw = typeof detail.summary === "string" ? detail.summary : "";
  return {
    id: recordId(detail) || "?",
    title: typeof detail.title === "string" ? detail.title : null,
    time:
      (typeof detail.startTime === "string" && detail.startTime) ||
      (typeof detail.createdAt === "string" && detail.createdAt) ||
      null,
    summary: summaryRaw ? stripFrontmatter(summaryRaw) : null,
    speakers: speakersFromTurns(detail.turns),
    source,
    sourceLabel: noteSourceLabel(source),
    sideNotes: typeof detail.sideNotes === "string" ? detail.sideNotes : null,
    status: typeof detail.status === "string" ? detail.status : null,
    ongoing: detail.ongoing === true,
    turns,
  };
}

export async function getWhoami(api: GobiApi): Promise<Record<string, unknown>> {
  const me = (await api.get("/auth/me")) as Record<string, unknown> | null;
  return {
    authenticated: true,
    user: me ?? null,
  };
}

export async function listCaptures(
  api: GobiApi,
  opts?: { limit?: number },
): Promise<{ captures: ContextCapture[]; hasMore: boolean }> {
  const limit = parseListLimit(opts?.limit);
  const matched: NotificationRow[] = [];
  let cursor: string | undefined;
  let reachedEnd = false;
  for (let page = 0; page < NOTIF_MAX_PAGES; page++) {
    const params: Record<string, unknown> = { limit: String(NOTIF_SERVER_PAGE) };
    if (cursor) params.cursor = cursor;
    const resp = (await api.get("/notifications", params)) as {
      data?: NotificationRow[];
      pagination?: { nextCursor?: string | null; hasMore?: boolean };
    };
    const rows = resp.data ?? [];
    matched.push(...rows.filter((n) => CAPTURE_TYPES.has(n.type)));
    const next = resp.pagination?.nextCursor ?? null;
    if (!next) {
      reachedEnd = true;
      break;
    }
    if (matched.length >= limit) break;
    cursor = next;
  }
  const out = matched.slice(0, limit);
  return { captures: out.map(compactCapture), hasMore: matched.length > limit || !reachedEnd };
}

async function collectRecent(
  listPage: (params: { limit: number; before?: string }) => Promise<CaptureListResult>,
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
  api: GobiApi,
  since: Date,
  limit: number,
): Promise<{ current: ContextActivity | null; recent: ContextActivity[]; errors: ContextError[] }> {
  const errors: ContextError[] = [];
  const { items, first } = await collectRecent(
    (params) => listPersonalActivities(api, params),
    ["start_time", "startTime"],
    since,
    limit,
  );

  let current: ContextActivity | null = null;
  if (first) {
    const id = recordId(first);
    if (id) {
      try {
        current = compactActivity(await getPersonalActivity(api, id));
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

async function loadNotes(
  api: GobiApi,
  since: Date,
  limit: number,
): Promise<{ notes: ContextNote[]; errors: ContextError[] }> {
  const { items } = await collectRecent(
    (params) => listPersonalNotes(api, params),
    ["startTime", "createdAt"],
    since,
    limit,
  );
  const errors: ContextError[] = [];
  const notes = await Promise.all(
    items.map(async (row) => {
      const id = recordId(row);
      if (!id) return compactNote(row);
      try {
        return compactNote(row, await getPersonalNote(api, id));
      } catch (err) {
        errors.push({ section: "notes", error: errorMessage(err) });
        return compactNote(row);
      }
    }),
  );
  return { notes, errors };
}

async function loadCaptures(api: GobiApi, since: Date, limit: number): Promise<ContextCapture[]> {
  const fetchLimit = Math.min(MAX_CONTEXT_LIMIT, Math.max(limit, LIST_PAGE));
  const { captures } = await listCaptures(api, { limit: fetchLimit });
  const inWin = captures.filter((n) => inWindow(n as unknown as Record<string, unknown>, ["createdAt"], since));
  return inWin.slice(0, limit);
}

/** Same snapshot as `gobi personal context`. Each section is isolated. */
export async function fetchPersonalContext(
  api: GobiApi,
  opts?: { since?: string; limit?: number | string; now?: Date },
): Promise<PersonalContext> {
  const since = parseSince(opts?.since ?? DEFAULT_CONTEXT_SINCE, opts?.now);
  const limit = parseContextLimit(opts?.limit);
  const errors: ContextError[] = [];

  const [activitiesSettled, notesSettled, capturesSettled] = await Promise.allSettled([
    loadActivities(api, since, limit),
    loadNotes(api, since, limit),
    loadCaptures(api, since, limit),
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

export async function getCurrentActivity(api: GobiApi): Promise<ContextActivity | null> {
  const { items } = await listPersonalActivities(api, { limit: 1 });
  const first = items[0];
  if (!first) return null;
  const id = recordId(first);
  if (!id) return compactActivity(first);
  try {
    return compactActivity(await getPersonalActivity(api, id));
  } catch {
    return compactActivity(first);
  }
}
