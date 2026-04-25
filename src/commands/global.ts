import { readFileSync } from "fs";
import { Command } from "commander";
import { apiGet, apiPost } from "../client.js";
import { isJsonMode, jsonOut, unwrapResp } from "./utils.js";

function readContent(value: string): string {
  if (value === "-") return readFileSync("/dev/stdin", "utf8");
  return value;
}

function formatMessageLine(m: Record<string, unknown>): string {
  const isReply = m.parentThreadId != null;
  const id = `[${isReply ? "r" : "t"}:${m.id}]`;
  const kind = isReply ? "reply " : "thread";
  const author =
    ((m.author as Record<string, unknown>)?.name as string) ||
    `User ${m.authorId ?? "?"}`;
  let label: string;
  if (isReply) {
    const text = (m.content as string) || "";
    label = text.length > 80 ? text.slice(0, 80) + "…" : text;
    label = label.replace(/\s+/g, " ").trim();
  } else {
    label = (m.title as string) || (m.content as string) || "";
  }
  return `${id} ${kind} ${author}  "${label}"  ${m.createdAt}`;
}

export function registerGlobalCommand(program: Command): void {
  const global = program
    .command("global")
    .description("Global thread commands. Global is the platform-wide thread feed visible to everyone on Gobi.");

  // ── Messages (unified feed) ──

  global
    .command("messages")
    .description("List the global unified message feed (threads and replies, newest first).")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (opts: { limit: string; cursor?: string }) => {
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      const resp = (await apiGet(`/global/messages`, params)) as Record<string, unknown>;

      if (isJsonMode(global)) {
        jsonOut({
          items: resp.data || [],
          pagination: resp.pagination || {},
        });
        return;
      }

      const items = (resp.data || []) as Record<string, unknown>[];
      const pagination = (resp.pagination || {}) as Record<string, unknown>;
      if (!items.length) {
        console.log("No messages found.");
        return;
      }
      const lines = items.map(formatMessageLine);
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Global messages (${items.length} items, newest first):\n` + lines.join("\n") + footer,
      );
    });

  // ── Get thread ──

  global
    .command("get-thread <threadId>")
    .description("Get a global thread and its direct replies (paginated).")
    .option("--limit <number>", "Replies per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (threadId: string, opts: { limit: string; cursor?: string }) => {
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      const resp = (await apiGet(`/global/threads/${threadId}`, params)) as Record<
        string,
        unknown
      >;
      const data = unwrapResp(resp) as Record<string, unknown>;
      const pagination = (resp.pagination || {}) as Record<string, unknown>;

      if (isJsonMode(global)) {
        jsonOut({ ...data, pagination });
        return;
      }

      const thread = (data.thread || data) as Record<string, unknown>;
      const replies = ((data.items as unknown[]) || []) as Record<string, unknown>[];

      const author =
        ((thread.author as Record<string, unknown>)?.name as string) ||
        `User ${thread.authorId}`;

      const replyLines: string[] = [];
      for (const r of replies) {
        const rAuthor =
          ((r.author as Record<string, unknown>)?.name as string) ||
          `User ${r.authorId}`;
        const text = (r.content as string) || "";
        const truncated = text.length > 200 ? text.slice(0, 200) + "…" : text;
        replyLines.push(`  - ${rAuthor}: ${truncated} (${r.createdAt})`);
      }

      const isReply = thread.parentThreadId != null;
      const heading = isReply
        ? `Reply [r:${thread.id}]`
        : `Thread: ${thread.title || "(no title)"}`;

      const output = [
        heading,
        `By: ${author} on ${thread.createdAt}`,
        "",
        thread.content as string,
        "",
        `Replies (${replies.length} items):`,
        ...replyLines,
        ...(pagination.hasMore ? [`  Next cursor: ${pagination.nextCursor}`] : []),
      ].join("\n");
      console.log(output);
    });

  // ── Ancestors ──

  global
    .command("ancestors <threadId>")
    .description("Show the ancestor lineage of a global thread or reply (root → immediate parent).")
    .action(async (threadId: string) => {
      const resp = (await apiGet(`/global/threads/${threadId}/ancestors`)) as Record<
        string,
        unknown
      >;
      const data = unwrapResp(resp) as Record<string, unknown>;
      const ancestors = ((data.ancestors as unknown[]) || []) as Record<string, unknown>[];

      if (isJsonMode(global)) {
        jsonOut({ ancestors });
        return;
      }

      if (!ancestors.length) {
        console.log("No ancestors (this is a root thread).");
        return;
      }

      const lines: string[] = [];
      ancestors.forEach((a, i) => {
        lines.push(`${i + 1}. ${formatMessageLine(a)}`);
      });
      console.log(
        `Ancestors (${ancestors.length} items, root first):\n` + lines.join("\n"),
      );
    });

  // ── Create thread ──

  global
    .command("create-thread")
    .description("Create a global thread (visible platform-wide).")
    .option("--title <title>", "Title of the thread")
    .option("--content <content>", "Thread content (markdown supported, use \"-\" for stdin)")
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .action(async (opts: { title?: string; content?: string; richText?: string }) => {
      if (!opts.content && !opts.richText) {
        throw new Error("Provide either --content or --rich-text.");
      }
      if (opts.content && opts.richText) {
        throw new Error("--content and --rich-text are mutually exclusive.");
      }
      const body: Record<string, unknown> = {};
      if (opts.title != null) body.title = opts.title;
      if (opts.content != null) body.content = readContent(opts.content);
      if (opts.richText != null) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(opts.richText);
        } catch {
          throw new Error("Invalid --rich-text JSON.");
        }
        body.richText = parsed;
      }
      const resp = (await apiPost(`/global/threads`, body)) as Record<string, unknown>;
      const thread = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(global)) {
        jsonOut(thread);
        return;
      }

      console.log(
        `Global thread created!\n` +
          `  ID: ${thread.id}\n` +
          (thread.title ? `  Title: ${thread.title}\n` : "") +
          `  Created: ${thread.createdAt}`,
      );
    });

  // ── Reply ──

  global
    .command("reply <threadId>")
    .description("Reply to a global thread.")
    .option("--content <content>", "Reply content (markdown supported, use \"-\" for stdin)")
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .action(async (threadId: string, opts: { content?: string; richText?: string }) => {
      if (!opts.content && !opts.richText) {
        throw new Error("Provide either --content or --rich-text.");
      }
      if (opts.content && opts.richText) {
        throw new Error("--content and --rich-text are mutually exclusive.");
      }
      const body: Record<string, unknown> = {};
      if (opts.content != null) body.content = readContent(opts.content);
      if (opts.richText != null) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(opts.richText);
        } catch {
          throw new Error("Invalid --rich-text JSON.");
        }
        body.richText = parsed;
      }
      const resp = (await apiPost(`/global/threads/${threadId}/replies`, body)) as Record<
        string,
        unknown
      >;
      const reply = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(global)) {
        jsonOut(reply);
        return;
      }

      console.log(
        `Reply created!\n  ID: ${reply.id}\n  Created: ${reply.createdAt}`,
      );
    });
}
