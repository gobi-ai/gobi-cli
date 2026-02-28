import { Command } from "commander";
import { apiGet, apiPost, apiPatch } from "../client.js";
import { isJsonMode, jsonOut, unwrapResp } from "./utils.js";

export function registerSessionsCommand(program: Command): void {
  const sessions = program
    .command("session")
    .description("Session commands (get, list, reply, update).");

  // ── Get ──

  sessions
    .command("get <sessionId>")
    .description("Get a session and its messages (paginated).")
    .option("--limit <number>", "Messages per page", "20")
    .option("--offset <number>", "Offset for message pagination", "0")
    .action(
      async (sessionId: string, opts: { limit: string; offset: string }) => {
        const resp = (await apiGet(`/session/${sessionId}`, {
          limit: parseInt(opts.limit, 10),
          offset: parseInt(opts.offset, 10),
        })) as Record<string, unknown>;
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
        const totalMessages =
          (pagination.total as number) || messages.length;

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
          `Messages (${messages.length} of ${totalMessages}):`,
          ...msgLines,
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
    .option("--offset <number>", "Offset for pagination", "0")
    .action(async (opts: { spaceSlug?: string; limit: string; offset: string }) => {
      const limit = parseInt(opts.limit, 10);
      const offset = parseInt(opts.offset, 10);

      const query: Record<string, unknown> = { limit, offset };
      if (opts.spaceSlug) query.spaceSlug = opts.spaceSlug;
      const resp = (await apiGet(`/session/my-sessions`, query)) as Record<string, unknown>;

      const items = ((resp.data as unknown[]) || []) as Record<string, unknown>[];
      const pagination = (resp.pagination || {}) as Record<string, unknown>;
      const total = (pagination.total as number) ?? items.length;

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
      console.log(
        `Sessions (${items.length} of ${total}):\n` + lines.join("\n"),
      );
    });

  // ── Reply ──

  sessions
    .command("reply <sessionId>")
    .description("Send a human reply to a session you are a member of.")
    .requiredOption(
      "--content <content>",
      "Reply content (markdown supported)",
    )
    .action(async (sessionId: string, opts: { content: string }) => {
      const resp = (await apiPost(`/session/${sessionId}/reply`, {
        content: opts.content,
      })) as Record<string, unknown>;
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

  // ── Update ──

  sessions
    .command("update <sessionId>")
    .description(
      'Update a session. "auto" lets the AI respond automatically; "manual" requires human replies.',
    )
    .option("--mode <mode>", 'Session mode: "auto" or "manual"')
    .action(async (sessionId: string, opts: { mode?: string }) => {
      if (!opts.mode) {
        throw new Error(
          "Provide at least one option to update (e.g. --mode).",
        );
      }
      const body: Record<string, string> = {};
      if (opts.mode != null) {
        if (opts.mode !== "auto" && opts.mode !== "manual") {
          throw new Error(
            'Invalid mode. Must be "auto" or "manual".',
          );
        }
        body.mode = opts.mode;
      }
      const resp = (await apiPatch(`/session/${sessionId}`, body)) as Record<
        string,
        unknown
      >;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(sessions)) {
        jsonOut(data);
        return;
      }

      const session = (data.session || data) as Record<string, unknown>;
      console.log(
        `Session updated!\n` +
          `  ID: ${session.id}\n` +
          `  Mode: ${session.mode}`,
      );
    });
}
