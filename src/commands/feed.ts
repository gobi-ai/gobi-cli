import { readFileSync } from "fs";
import { Command } from "commander";
import { apiGet, apiPost, apiPatch, apiDelete } from "../client.js";
import { isJsonMode, jsonOut, unwrapResp } from "./utils.js";

export function registerFeedCommand(program: Command): void {
  const feed = program
    .command("feed")
    .description(
      "Feed of brain updates from people across the platform.",
    );

  // ── List ──

  feed
    .command("list")
    .description("List recent brain updates from the global public feed.")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (opts: { limit: string; cursor?: string }) => {
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      const resp = (await apiGet(`/feed`, params)) as Record<string, unknown>;

      if (isJsonMode(feed)) {
        jsonOut({
          items: resp.data || [],
          pagination: resp.pagination || {},
        });
        return;
      }

      const items = (resp.data || []) as Record<string, unknown>[];
      const pagination = (resp.pagination || {}) as Record<string, unknown>;
      if (!items.length) {
        console.log("No feed items found.");
        return;
      }
      const lines: string[] = [];
      for (const u of items) {
        const author =
          ((u.author as Record<string, unknown>)?.name as string) ||
          `User ${u.authorId}`;
        const vaultSlug =
          ((u.vault as Record<string, unknown>)?.vaultSlug as string) ||
          ((u.authorVault as Record<string, unknown>)?.vaultSlug as string) ||
          "?";
        const replyCount = (u.replyCount as number) ?? 0;
        const replies = replyCount ? `, ${replyCount} ${replyCount === 1 ? "reply" : "replies"}` : "";
        lines.push(
          `- [${u.id}] "${u.title}" by ${author} (vault: ${vaultSlug}, ${u.createdAt}${replies})`,
        );
      }
      const footer = pagination.hasMore
        ? `\n  Next cursor: ${pagination.nextCursor}`
        : "";
      console.log(
        `Feed (${items.length} items):\n` + lines.join("\n") + footer,
      );
    });

  // ── Get ──

  feed
    .command("get <updateId>")
    .description("Get a feed brain update and its replies (paginated).")
    .option("--limit <number>", "Replies per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option("--full", "Show full reply content without truncation")
    .action(
      async (
        updateId: string,
        opts: { limit: string; cursor?: string; full?: boolean },
      ) => {
        const params: Record<string, unknown> = {
          limit: parseInt(opts.limit, 10),
        };
        if (opts.cursor) params.cursor = opts.cursor;
        const resp = (await apiGet(
          `/feed/${updateId}`,
          params,
        )) as Record<string, unknown>;
        const data = unwrapResp(resp) as Record<string, unknown>;
        const pagination = (resp.pagination || {}) as Record<string, unknown>;

        if (isJsonMode(feed)) {
          jsonOut({ ...data, pagination });
          return;
        }

        const update = (data.update || data) as Record<string, unknown>;
        const replies = ((data.replies as unknown[]) || []) as Record<string, unknown>[];

        const author =
          ((update.author as Record<string, unknown>)?.name as string) ||
          `User ${update.authorId}`;
        const vault =
          ((update.vault as Record<string, unknown>)?.vaultSlug as string) ||
          ((update.authorVault as Record<string, unknown>)?.vaultSlug as string) ||
          "?";

        const replyLines: string[] = [];
        for (const r of replies) {
          const rAuthor =
            ((r.author as Record<string, unknown>)?.name as string) ||
            `User ${r.authorId}`;
          const text = (r.content as string) || "";
          const truncated =
            opts.full || text.length <= 200 ? text : text.slice(0, 200) + "…";
          replyLines.push(`  - ${rAuthor}: ${truncated} (${r.createdAt})`);
        }

        const output = [
          `Feed Update: ${update.title || "(no title)"}`,
          `By: ${author} (vault: ${vault}) on ${update.createdAt}`,
          "",
          (update.content as string) || "",
          "",
          `Replies (${replies.length} items):`,
          ...replyLines,
          ...(pagination.hasMore
            ? [`  Next cursor: ${pagination.nextCursor}`]
            : []),
        ].join("\n");
        console.log(output);
      },
    );

  // ── Reply ──

  feed
    .command("post-reply <updateId>")
    .description("Post a reply to a brain update in the feed.")
    .requiredOption(
      "--content <content>",
      'Reply content (markdown supported, use "-" for stdin)',
    )
    .action(async (updateId: string, opts: { content: string }) => {
      const content =
        opts.content === "-" ? readFileSync("/dev/stdin", "utf8") : opts.content;
      const resp = (await apiPost(`/feed/${updateId}/replies`, {
        content,
      })) as Record<string, unknown>;
      const reply = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(feed)) {
        jsonOut(reply);
        return;
      }

      console.log(
        `Reply created!\n  ID: ${reply.id}\n  Created: ${reply.createdAt}`,
      );
    });

  // ── Edit reply ──

  feed
    .command("edit-reply <replyId>")
    .description("Edit a reply you authored in the feed.")
    .requiredOption(
      "--content <content>",
      'New reply content (markdown supported, use "-" for stdin)',
    )
    .action(async (replyId: string, opts: { content: string }) => {
      const content =
        opts.content === "-" ? readFileSync("/dev/stdin", "utf8") : opts.content;
      const resp = (await apiPatch(`/brain-updates/replies/${replyId}`, {
        content,
      })) as Record<string, unknown>;
      const reply = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(feed)) {
        jsonOut(reply);
        return;
      }

      console.log(
        `Reply edited!\n  ID: ${reply.id}\n  Edited: ${reply.editedAt}`,
      );
    });

  // ── Delete reply ──

  feed
    .command("delete-reply <replyId>")
    .description("Delete a reply you authored in the feed.")
    .action(async (replyId: string) => {
      await apiDelete(`/brain-updates/replies/${replyId}`);

      if (isJsonMode(feed)) {
        jsonOut({ replyId });
        return;
      }

      console.log(`Reply ${replyId} deleted.`);
    });
}
