import { Command } from "commander";
import { apiGet, apiPost, apiPatch, apiDelete } from "../client.js";
import { isJsonMode, jsonOut, readStdin, unwrapResp } from "./utils.js";

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

function formatSavedPostLine(item: Record<string, unknown>): string {
  const author = (item.author as Record<string, unknown> | null)?.name as string | undefined;
  const title = (item.title as string | null) || (item.content as string | null) || "(no title)";
  const snippet = title.length > 80 ? title.slice(0, 80) + "…" : title;
  const space = item.spaceSlug ? `, space: ${item.spaceSlug}` : "";
  return `- [${item.postId}] "${snippet.replace(/\n/g, " ")}" by ${author ?? "?"}${space} (saved ${item.savedAt})`;
}

function registerNoteCommands(saved: Command): void {
  const note = saved
    .command("note")
    .description("Personal saved notes (create, list, get, edit, delete).");

  note
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

        if (isJsonMode(saved)) {
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

  note
    .command("get <noteId>")
    .description("Get a single note by id.")
    .action(async (noteId: string) => {
      const resp = (await apiGet(`/app/notes/${noteId}`)) as Record<string, unknown>;
      const note = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(saved)) {
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

  note
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
          opts.content === "-" ? readStdin() : opts.content;

        const body: Record<string, unknown> = {
          content,
          timezone: opts.timezone || defaultTimezone(),
        };
        if (opts.agentId) body.agentId = parseInt(opts.agentId, 10);

        const resp = (await apiPost(`/app/notes`, body)) as Record<string, unknown>;
        const note = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(saved)) {
          jsonOut(note);
          return;
        }

        console.log(
          `Note created!\n  ID: ${note.id}\n  Date: ${note.eventDate}\n  Created: ${note.createdAt}`,
        );
      },
    );

  note
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
            opts.content === "-" ? readStdin() : opts.content;
        }
        if (opts.agentId != null) {
          body.agentId = opts.agentId === "null" ? null : parseInt(opts.agentId, 10);
        }

        const resp = (await apiPatch(`/app/notes/${noteId}`, body)) as Record<string, unknown>;
        const note = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(saved)) {
          jsonOut(note);
          return;
        }

        console.log(
          `Note edited!\n  ID: ${note.id}\n  Updated: ${note.updatedAt}`,
        );
      },
    );

  note
    .command("delete <noteId>")
    .description("Delete a note you authored.")
    .action(async (noteId: string) => {
      await apiDelete(`/app/notes/${noteId}`);

      if (isJsonMode(saved)) {
        jsonOut({ id: noteId });
        return;
      }

      console.log(`Note ${noteId} deleted.`);
    });
}

function registerPostCommands(saved: Command): void {
  const post = saved
    .command("post")
    .description("Saved posts (snapshots of posts and replies you bookmark).");

  post
    .command("list")
    .description("List posts you have saved.")
    .option("--type <type>", "Filter by type: all|article|space-post", "all")
    .option("--limit <number>", "Items per page (1-50)", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (opts: { type: string; limit: string; cursor?: string }) => {
      const params: Record<string, unknown> = {
        type: opts.type,
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;

      const resp = (await apiGet(`/reactions/me/saved`, params)) as Record<string, unknown>;
      const items = ((resp.data as unknown[]) || []) as Record<string, unknown>[];
      const pagination = (resp.pagination || {}) as Record<string, unknown>;

      if (isJsonMode(saved)) {
        jsonOut({ items, pagination });
        return;
      }

      if (!items.length) {
        console.log("No saved posts found.");
        return;
      }
      const lines = items.map(formatSavedPostLine);
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(`Saved posts (${items.length} items):\n` + lines.join("\n") + footer);
    });

  post
    .command("get <postId>")
    .description("Get a saved post snapshot by post id.")
    .action(async (postId: string) => {
      const resp = (await apiGet(`/feed/${postId}`)) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(saved)) {
        jsonOut(data);
        return;
      }

      const post = (data.update || data.post || data) as Record<string, unknown>;
      const author =
        ((post.author as Record<string, unknown>)?.name as string) ||
        `User ${post.authorId}`;
      const title = (post.title as string) || "(no title)";
      console.log(
        [
          `Saved post [${post.id}]: ${title}`,
          `By: ${author} on ${post.createdAt}`,
          "",
          (post.content as string) || "",
        ].join("\n"),
      );
    });

  post
    .command("create")
    .description(
      "Save a post or reply. Records a snapshot in your saved-posts collection.",
    )
    .requiredOption(
      "--source <id>",
      "Source post or reply id to save (numeric)",
    )
    .action(async (opts: { source: string }) => {
      const sourceId = parseInt(opts.source, 10);
      if (!Number.isFinite(sourceId)) {
        throw new Error("--source must be a numeric post or reply id.");
      }
      const resp = (await apiPost(`/reactions/posts/${sourceId}/save`, {
        vaultIds: [],
      })) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(saved)) {
        jsonOut({ postId: sourceId, ...data });
        return;
      }

      console.log(`Saved post ${sourceId}.`);
    });

  post
    .command("delete <postId>")
    .description("Remove a post from your saved-posts collection.")
    .action(async (postId: string) => {
      await apiDelete(`/reactions/posts/${postId}/save`);

      if (isJsonMode(saved)) {
        jsonOut({ postId });
        return;
      }

      console.log(`Removed post ${postId} from saved.`);
    });
}

export function registerSavedCommand(program: Command): void {
  const saved = program
    .command("saved")
    .description("Saved-knowledge commands (notes and posts).");

  registerNoteCommands(saved);
  registerPostCommands(saved);
}
