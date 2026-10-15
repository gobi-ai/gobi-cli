/**
 * People directory and notes search.
 *
 * gobi-cli has neither: notes search is not a CLI command, and People DB
 * extract/merge is owned by Jimin (not present in this repo). Tools call the
 * interfaces below. Http* adapters hit the documented paths; 404/501 becomes
 * `{ unimplemented: true }` instead of invented people. Tests use in-memory mocks.
 */

import { ApiError, type GobiApi } from "./gobi-client.js";
import { noteSourceLabel, parseListLimit } from "./gobi-personal.js";

export interface Person {
  id: string;
  name: string;
  role: string | null;
  highlights: string[];
  aliases?: string[];
}

export interface NoteSearchHit {
  id: string;
  title: string | null;
  time: string | null;
  summary: string | null;
  speakers: string[];
  source: string | null;
  sourceLabel: string;
}

export type Unimplemented = {
  unimplemented: true;
  endpoint: string;
  todo: string;
};

export interface PeopleDirectory {
  listPeople(opts?: { q?: string; limit?: number }): Promise<{ people: Person[] } | Unimplemented>;
  getPerson(id: string): Promise<{ person: Person } | Unimplemented>;
}

export interface NoteSearch {
  searchNotes(opts: { q: string; limit?: number; before?: string }): Promise<{ notes: NoteSearchHit[]; pagination?: { hasMore?: boolean; nextCursor?: string } } | Unimplemented>;
}

const PEOPLE_LIST_TODO =
  "People DB GET /app/people is owned by Jimin and is not in gobi-cli. Implement list/search, then this adapter will work.";
const PEOPLE_GET_TODO =
  "People DB GET /app/people/:id is owned by Jimin and is not in gobi-cli.";
const NOTES_SEARCH_TODO =
  "GET /app/conversations/search is not in gobi-cli (only post search exists). Add a Sense-notes search endpoint.";

function unimplemented(endpoint: string, todo: string): Unimplemented {
  return { unimplemented: true, endpoint, todo };
}

function isMissing(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 404 || err.status === 501 || err.status === 405);
}

export class HttpPeopleDirectory implements PeopleDirectory {
  constructor(private readonly api: GobiApi) {}

  async listPeople(opts?: { q?: string; limit?: number }): Promise<{ people: Person[] } | Unimplemented> {
    try {
      const resp = (await this.api.get("/app/people", {
        q: opts?.q,
        limit: parseListLimit(opts?.limit),
      })) as Record<string, unknown>;
      const rows = (resp.people ?? resp.data ?? []) as Record<string, unknown>[];
      return { people: rows.map(compactPerson) };
    } catch (err) {
      if (isMissing(err)) return unimplemented("GET /app/people", PEOPLE_LIST_TODO);
      throw err;
    }
  }

  async getPerson(id: string): Promise<{ person: Person } | Unimplemented> {
    try {
      const resp = (await this.api.get(`/app/people/${encodeURIComponent(id)}`)) as Record<string, unknown>;
      const row = (resp.person as Record<string, unknown> | undefined) ?? resp;
      return { person: compactPerson(row) };
    } catch (err) {
      if (isMissing(err)) return unimplemented(`GET /app/people/${id}`, PEOPLE_GET_TODO);
      throw err;
    }
  }
}

export class HttpNoteSearch implements NoteSearch {
  constructor(private readonly api: GobiApi) {}

  async searchNotes(opts: {
    q: string;
    limit?: number;
    before?: string;
  }): Promise<{ notes: NoteSearchHit[]; pagination?: { hasMore?: boolean; nextCursor?: string } } | Unimplemented> {
    try {
      const resp = (await this.api.get("/app/conversations/search", {
        q: opts.q,
        limit: parseListLimit(opts.limit),
        before: opts.before,
      })) as Record<string, unknown>;
      const rows = (resp.conversations ?? resp.notes ?? resp.data ?? []) as Record<string, unknown>[];
      return {
        notes: rows.map(compactSearchHit),
        pagination: (resp.pagination as { hasMore?: boolean; nextCursor?: string }) ?? {},
      };
    } catch (err) {
      if (isMissing(err)) return unimplemented("GET /app/conversations/search", NOTES_SEARCH_TODO);
      throw err;
    }
  }
}

export class InMemoryPeopleDirectory implements PeopleDirectory {
  constructor(private readonly people: Person[]) {}

  async listPeople(opts?: { q?: string; limit?: number }): Promise<{ people: Person[] }> {
    const q = opts?.q?.toLowerCase().trim();
    let rows = this.people;
    if (q) {
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.role?.toLowerCase().includes(q) ||
          p.highlights.some((h) => h.toLowerCase().includes(q)),
      );
    }
    return { people: rows.slice(0, parseListLimit(opts?.limit)) };
  }

  async getPerson(id: string): Promise<{ person: Person } | Unimplemented> {
    const person = this.people.find((p) => p.id === id);
    if (!person) return unimplemented(`GET /app/people/${id}`, PEOPLE_GET_TODO);
    return { person };
  }
}

export class InMemoryNoteSearch implements NoteSearch {
  constructor(private readonly notes: NoteSearchHit[]) {}

  async searchNotes(opts: { q: string; limit?: number }): Promise<{ notes: NoteSearchHit[] }> {
    const q = opts.q.toLowerCase();
    const hits = this.notes.filter(
      (n) =>
        n.title?.toLowerCase().includes(q) ||
        n.summary?.toLowerCase().includes(q) ||
        n.speakers.some((s) => s.toLowerCase().includes(q)),
    );
    return { notes: hits.slice(0, parseListLimit(opts.limit)) };
  }
}

function compactPerson(row: Record<string, unknown>): Person {
  const highlights = Array.isArray(row.highlights)
    ? (row.highlights as unknown[]).map(String)
    : [];
  return {
    id: String(row.publicId ?? row.id ?? "?"),
    name: typeof row.name === "string" ? row.name : "Unknown",
    role: typeof row.role === "string" ? row.role : null,
    highlights,
    aliases: Array.isArray(row.aliases) ? (row.aliases as unknown[]).map(String) : undefined,
  };
}

function compactSearchHit(c: Record<string, unknown>): NoteSearchHit {
  return {
    id: String(c.publicId ?? c.id ?? "?"),
    title: typeof c.title === "string" ? c.title : null,
    time: typeof c.startTime === "string" ? c.startTime : typeof c.createdAt === "string" ? c.createdAt : null,
    summary: typeof c.summary === "string" ? c.summary : null,
    speakers: Array.isArray(c.speakers) ? (c.speakers as unknown[]).map(String) : [],
    source: typeof c.source === "string" ? c.source : null,
    sourceLabel: noteSourceLabel(c.source),
  };
}

export function isUnimplemented(v: unknown): v is Unimplemented {
  return Boolean(v && typeof v === "object" && (v as Unimplemented).unimplemented === true);
}
