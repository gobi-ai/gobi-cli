import { readFileSync } from "fs";
import { Command } from "commander";
import { apiGet, apiPost, apiPatch, apiDelete } from "../client.js";
import { isJsonMode, jsonOut, unwrapResp } from "./utils.js";

function defaultTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function formatNoteLine(note: Record<string, unknown>): string {
  const content = (note.content as string | null) ?? "";
  const snippet = content
    ? content.length > 80
      ? content.slice(0, 80) + "…"
      : content
    : "(no content)";
  const attachments = ((note.attachments as unknown[]) || []) as unknown[];
  const attachStr = attachments.length
    ? `, ${attachments.length} ${attachments.length === 1 ? "attachment" : "attachments"}`
    : "";
  const agent = note.agentId != null ? `, agent: ${note.agentId}` : "";
  return `- [${note.id}] "${snippet.replace(/\n/g, " ")}" (${note.eventDate}${agent}${attachStr}, updated ${note.updatedAt})`;
}

export function registerNotesCommand(program: Command): void {
  const notes = program
    .command("notes")
    .description("Personal notes (create, list, get, edit, delete).");

  // ── List ──

  notes
    .command("list")
    .description(
      "List your notes. Without --date, returns recent notes via cursor pagination. With --date, returns all notes for that day.",
    )
    .option("--date <date>", "Filter to a single day (YYYY-MM-DD)")
    .option("--timezone <tz>", "IANA timezone name (default: system timezone)")
    .option("--limit <number>", "Items per page (1-100)", "50")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(
      async (opts: {
        date?: string;
        timezone?: string;
        limit: string;
        cursor?: string;
      }) => {
        const params: Record<string, unknown> = {
          timezone: opts.timezone || defaultTimezone(),
          limit: parseInt(opts.limit, 10),
        };
        if (opts.date) params.date = opts.date;
        if (opts.cursor) params.cursor = opts.cursor;

        const resp = (await apiGet(`/app/notes`, params)) as Record<string, unknown>;
        const items = ((resp.data as unknown[]) || []) as Record<string, unknown>[];
        const pagination = (resp.pagination || {}) as Record<string, unknown>;

        if (isJsonMode(notes)) {
          jsonOut({ items, pagination });
          return;
        }

        if (!items.length) {
          console.log("No notes found.");
          return;
        }
        const lines = items.map(formatNoteLine);
        const footer = pagination.hasMore
          ? `\n  Next cursor: ${pagination.nextCursor}`
          : "";
        console.log(`Notes (${items.length} items):\n` + lines.join("\n") + footer);
      },
    );

  // ── Get ──

  notes
    .command("get <noteId>")
    .description("Get a single note by id.")
    .action(async (noteId: string) => {
      const resp = (await apiGet(`/app/notes/${noteId}`)) as Record<string, unknown>;
      const note = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(notes)) {
        jsonOut(note);
        return;
      }

      const attachments = ((note.attachments as unknown[]) || []) as Record<string, unknown>[];
      const attachLines = attachments.map(
        (a) => `  - [${a.id}] ${a.mediaUrl} (position ${a.position})`,
      );
      const agentLine = note.agentId != null ? `Agent: ${note.agentId}\n` : "";
      const output = [
        `Note: ${note.id}`,
        `Date: ${note.eventDate}`,
        `Created: ${note.createdAt}`,
        `Updated: ${note.updatedAt}`,
        agentLine.trimEnd(),
        "",
        (note.content as string) || "(no content)",
        ...(attachLines.length ? ["", `Attachments (${attachLines.length}):`, ...attachLines] : []),
      ]
        .filter((line) => line !== "")
        .concat([""])
        .join("\n")
        .trimEnd();
      console.log(output);
    });

  // ── Create ──

  notes
    .command("create")
    .description("Create a note. Provide --content (use '-' for stdin) and/or attachments.")
    .option(
      "--content <content>",
      'Note content (markdown supported, use "-" for stdin)',
    )
    .option("--timezone <tz>", "IANA timezone name (default: system timezone)")
    .option("--agent-id <number>", "Optional agent id to associate with the note")
    .action(
      async (opts: { content?: string; timezone?: string; agentId?: string }) => {
        if (!opts.content) {
          throw new Error("--content is required (use '-' to read from stdin)");
        }
        const content =
          opts.content === "-" ? readFileSync("/dev/stdin", "utf8") : opts.content;

        const body: Record<string, unknown> = {
          content,
          timezone: opts.timezone || defaultTimezone(),
        };
        if (opts.agentId) body.agentId = parseInt(opts.agentId, 10);

        const resp = (await apiPost(`/app/notes`, body)) as Record<string, unknown>;
        const note = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(notes)) {
          jsonOut(note);
          return;
        }

        console.log(
          `Note created!\n  ID: ${note.id}\n  Date: ${note.eventDate}\n  Created: ${note.createdAt}`,
        );
      },
    );

  // ── Edit ──

  notes
    .command("edit <noteId>")
    .description("Edit a note. Provide --content and/or --agent-id.")
    .option(
      "--content <content>",
      'New note content (markdown supported, use "-" for stdin)',
    )
    .option(
      "--agent-id <number>",
      'New agent id, or "null" to clear the association',
    )
    .action(
      async (
        noteId: string,
        opts: { content?: string; agentId?: string },
      ) => {
        if (opts.content == null && opts.agentId == null) {
          throw new Error("Provide at least --content or --agent-id to update.");
        }
        const body: Record<string, unknown> = {};
        if (opts.content != null) {
          body.content =
            opts.content === "-" ? readFileSync("/dev/stdin", "utf8") : opts.content;
        }
        if (opts.agentId != null) {
          body.agentId = opts.agentId === "null" ? null : parseInt(opts.agentId, 10);
        }

        const resp = (await apiPatch(`/app/notes/${noteId}`, body)) as Record<string, unknown>;
        const note = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(notes)) {
          jsonOut(note);
          return;
        }

        console.log(
          `Note edited!\n  ID: ${note.id}\n  Updated: ${note.updatedAt}`,
        );
      },
    );

  // ── Delete ──

  notes
    .command("delete <noteId>")
    .description("Delete a note you authored.")
    .action(async (noteId: string) => {
      await apiDelete(`/app/notes/${noteId}`);

      if (isJsonMode(notes)) {
        jsonOut({ id: noteId });
        return;
      }

      console.log(`Note ${noteId} deleted.`);
    });
}
