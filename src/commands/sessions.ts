import { Command } from "commander";
import { apiGet, apiPost } from "../client.js";
import { isJsonMode, jsonOut, unwrapResp } from "./utils.js";

export function registerSessionsCommand(program: Command): void {
  const sessions = program
    .command("session")
    .description("Session commands (get, list, reply).");

  // ── Get ──

  sessions
    .command("get <sessionId>")
    .description("Get a session and its messages (paginated).")
    .option("--limit <number>", "Messages per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(
      async (sessionId: string, opts: { limit: string; cursor?: string }) => {
        const params: Record<string, unknown> = {
          limit: parseInt(opts.limit, 10),
        };
        if (opts.cursor) params.cursor = opts.cursor;
        const resp = (await apiGet(`/session/${sessionId}`, params)) as Record<string, unknown>;
        const data = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(sessions)) {
          jsonOut(data);
          return;
        }

        const session = (data.session || data) as Record<string, unknown>;
        const messages = ((data.messages as unknown[]) || []) as Record<
          string,
          unknown
        >[];
        const pagination = (data.pagination || {}) as Record<string, unknown>;

        const msgLines: string[] = [];
        for (const m of messages) {
          const author =
            ((m.author as Record<string, unknown>)?.name as string) ||
            (m.source as string) ||
            `User ${m.authorId}`;
          const text = m.content as string;
          const truncated =
            text.length > 200 ? text.slice(0, 200) + "\u2026" : text;
          msgLines.push(`  - ${author}: ${truncated} (${m.createdAt})`);
        }

        const output = [
          `Session: ${session.title}`,
          `  ID: ${session.id}`,
          `  Mode: ${session.mode}`,
          `  Last activity: ${session.lastMessageAt}`,
          "",
          `Messages (${messages.length} items):`,
          ...msgLines,
          ...(pagination.hasMore ? [`  Next cursor: ${pagination.nextCursor}`] : []),
        ].join("\n");
        console.log(output);
      },
    );

  // ── List ──

  sessions
    .command("list")
    .description("List all sessions you are part of, sorted by most recent activity.")
    .option("--space-slug <spaceSlug>", "Filter by space slug")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (opts: { spaceSlug?: string; limit: string; cursor?: string }) => {
      const query: Record<string, unknown> = { limit: parseInt(opts.limit, 10) };
      if (opts.cursor) query.cursor = opts.cursor;
      if (opts.spaceSlug) query.spaceSlug = opts.spaceSlug;
      const resp = (await apiGet(`/session/my-sessions`, query)) as Record<string, unknown>;

      const items = ((resp.data as unknown[]) || []) as Record<string, unknown>[];
      const pagination = (resp.pagination || {}) as Record<string, unknown>;

      if (isJsonMode(sessions)) {
        jsonOut({
          items,
          pagination: resp.pagination || {},
        });
        return;
      }

      if (!items.length) {
        console.log("No sessions found.");
        return;
      }
      const lines: string[] = [];
      for (const s of items) {
        const title = (s.title as string) || "(no title)";
        const members = (s.members as Record<string, unknown>[]) || [];
        const memberCount = (s.memberCount as number) ?? 0;

        let memberInfo = "";
        if (members.length > 0) {
          const names = members.map(
            (m) => (m.vaultName as string) || (m.name as string) || "Unknown",
          );
          const overflow = memberCount - members.length - 1; // -1 for "me"
          memberInfo = ` | with: ${names.join(", ")}`;
          if (overflow > 0) memberInfo += ` +${overflow} more`;
        }

        lines.push(
          `- [${s.id}] "${title}" (mode: ${s.mode}, last activity: ${s.lastMessageAt})${memberInfo}`,
        );
      }
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Sessions (${items.length} items):\n` + lines.join("\n") + footer,
      );
    });

  // ── Reply ──

  sessions
    .command("reply <sessionId>")
    .description("Send a human reply to a session you are a member of.")
    .option(
      "--content <content>",
      "Reply content (markdown supported)",
    )
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (e.g. [{\"type\":\"text\",\"text\":\"hello\"}])",
    )
    .action(async (sessionId: string, opts: { content?: string; richText?: string }) => {
      if (!opts.content && !opts.richText) {
        throw new Error("Provide either --content or --rich-text.");
      }
      if (opts.content && opts.richText) {
        throw new Error("--content and --rich-text are mutually exclusive.");
      }
      const body: Record<string, unknown> = {};
      if (opts.richText != null) {
        let parsed: unknown;
        try { parsed = JSON.parse(opts.richText); } catch { throw new Error("Invalid --rich-text JSON."); }
        body.richText = parsed;
      } else {
        body.content = opts.content;
      }
      const resp = (await apiPost(`/session/${sessionId}/reply`,
        body,
      )) as Record<string, unknown>;
      const msg = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(sessions)) {
        jsonOut(msg);
        return;
      }

      console.log(
        `Reply sent!\n` +
          `  Message ID: ${msg.id}\n` +
          `  Source: ${msg.source}\n` +
          `  Created: ${msg.createdAt}`,
      );
    });

}
