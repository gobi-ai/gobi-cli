import { Command } from "commander";
import { apiGet, apiPost, apiPatch, apiDelete } from "../client.js";
import { selectSpace, writeSpaceSetting } from "./init.js";
import { isJsonMode, jsonOut, resolveSpaceSlug, unwrapResp } from "./utils.js";

export function registerAstraCommand(program: Command): void {
  const space = program
    .command("space")
    .description(
      "Space commands (threads, replies).",
    )
    .option(
      "--space-slug <slug>",
      "Space slug (overrides .gobi/settings.yaml)",
    );

  // ── Warp (space selection) ──

  space
    .command("warp")
    .description("Select the active space.")
    .action(async () => {
      const result = await selectSpace();
      if (result === null) {
        console.log("No space selected.");
        return;
      }
      writeSpaceSetting(result.slug);

      if (isJsonMode(space)) {
        jsonOut({ spaceSlug: result.slug, spaceName: result.name });
        return;
      }

      console.log(`Warped to space "${result.name}" (${result.slug})`);
    });

  // ── Threads (get, list, create, edit, delete) ──

  space
    .command("get-thread <threadId>")
    .description("Get a thread and its replies (paginated).")
    .option("--limit <number>", "Replies per page", "20")
    .option("--offset <number>", "Offset for reply pagination", "0")
    .action(
      async (threadId: string, opts: { limit: string; offset: string }) => {
        const spaceSlug = resolveSpaceSlug(space);
        const resp = (await apiGet(
          `/spaces/${spaceSlug}/threads/${threadId}`,
          {
            limit: parseInt(opts.limit, 10),
            offset: parseInt(opts.offset, 10),
          },
        )) as Record<string, unknown>;
        const data = unwrapResp(resp) as Record<string, unknown>;
        const pagination = (resp.pagination || {}) as Record<string, unknown>;

        if (isJsonMode(space)) {
          jsonOut({ ...data, pagination });
          return;
        }

        const thread = (data.thread || data) as Record<string, unknown>;
        const replies = ((data.items as unknown[]) || []) as Record<
          string,
          unknown
        >[];
        const totalReplies =
          (pagination.total as number) ||
          (thread.replyCount as number) ||
          0;

        const author =
          ((thread.author as Record<string, unknown>)?.name as string) ||
          `User ${thread.authorId}`;
        const replyLines: string[] = [];
        for (const r of replies) {
          const rAuthor =
            ((r.author as Record<string, unknown>)?.name as string) ||
            `User ${r.authorId}`;
          const text = r.content as string;
          const truncated =
            text.length > 200 ? text.slice(0, 200) + "\u2026" : text;
          replyLines.push(`  - ${rAuthor}: ${truncated} (${r.createdAt})`);
        }

        const output = [
          `Thread: ${thread.title}`,
          `By: ${author} on ${thread.createdAt}`,
          "",
          thread.content as string,
          "",
          `Replies (${replies.length} of ${totalReplies}):`,
          ...replyLines,
        ].join("\n");
        console.log(output);
      },
    );

  space
    .command("list-threads")
    .description("List threads in a space (paginated).")
    .option("--limit <number>", "Items per page", "20")
    .option("--offset <number>", "Offset for pagination", "0")
    .action(async (opts: { limit: string; offset: string }) => {
      const spaceSlug = resolveSpaceSlug(space);
      const resp = (await apiGet(`/spaces/${spaceSlug}/threads`, {
        limit: parseInt(opts.limit, 10),
        offset: parseInt(opts.offset, 10),
      })) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut({
          items: resp.data || [],
          pagination: resp.pagination || {},
        });
        return;
      }

      const items = (resp.data || []) as Record<string, unknown>[];
      const pagination = (resp.pagination || {}) as Record<string, unknown>;
      if (!items.length) {
        console.log("No threads found.");
        return;
      }
      const lines: string[] = [];
      for (const t of items) {
        const author =
          ((t.author as Record<string, unknown>)?.name as string) ||
          `User ${t.authorId}`;
        lines.push(
          `- [${t.id}] "${t.title}" by ${author} (${t.replyCount} replies, ${t.createdAt})`,
        );
      }
      const total = (pagination.total as number) || items.length;
      console.log(
        `Threads (${items.length} of ${total}):\n` + lines.join("\n"),
      );
    });

  space
    .command("create-thread")
    .description("Create a thread in a space.")
    .requiredOption("--title <title>", "Title of the thread")
    .requiredOption(
      "--content <content>",
      "Thread content (markdown supported)",
    )
    .action(
      async (opts: {
        title: string;
        content: string;
      }) => {
        const spaceSlug = resolveSpaceSlug(space);
        const resp = (await apiPost(`/spaces/${spaceSlug}/threads`, {
          title: opts.title,
          content: opts.content,
        })) as Record<string, unknown>;
        const thread = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(space)) {
          jsonOut(thread);
          return;
        }

        console.log(
          `Thread created!\n` +
            `  ID: ${thread.id}\n` +
            `  Title: ${thread.title}\n` +
            `  Created: ${thread.createdAt}`,
        );
      },
    );

  space
    .command("edit-thread <threadId>")
    .description("Edit a thread. You must be the author.")
    .option("--title <title>", "New title for the thread")
    .option(
      "--content <content>",
      "New content for the thread (markdown supported)",
    )
    .action(
      async (
        threadId: string,
        opts: { title?: string; content?: string },
      ) => {
        if (!opts.title && !opts.content) {
          throw new Error(
            "Provide at least --title or --content to update.",
          );
        }
        const spaceSlug = resolveSpaceSlug(space);
        const body: Record<string, string> = {};
        if (opts.title != null) body.title = opts.title;
        if (opts.content != null) body.content = opts.content;
        const resp = (await apiPatch(
          `/spaces/${spaceSlug}/threads/${threadId}`,
          body,
        )) as Record<string, unknown>;
        const thread = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(space)) {
          jsonOut(thread);
          return;
        }

        console.log(
          `Thread edited!\n` +
            `  ID: ${thread.id}\n` +
            `  Title: ${thread.title}\n` +
            `  Edited: ${thread.editedAt}`,
        );
      },
    );

  space
    .command("delete-thread <threadId>")
    .description("Delete a thread. You must be the author.")
    .action(async (threadId: string) => {
      const spaceSlug = resolveSpaceSlug(space);
      await apiDelete(`/spaces/${spaceSlug}/threads/${threadId}`);

      if (isJsonMode(space)) {
        jsonOut({ id: threadId });
        return;
      }

      console.log(`Thread ${threadId} deleted.`);
    });

  // ── Replies (create, edit, delete) ──

  space
    .command("create-reply <threadId>")
    .description("Create a reply to a thread in a space.")
    .requiredOption(
      "--content <content>",
      "Reply content (markdown supported)",
    )
    .action(async (threadId: string, opts: { content: string }) => {
      const spaceSlug = resolveSpaceSlug(space);
      const resp = (await apiPost(
        `/spaces/${spaceSlug}/threads/${threadId}/replies`,
        { content: opts.content },
      )) as Record<string, unknown>;
      const msg = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut(msg);
        return;
      }

      console.log(
        `Reply created!\n  ID: ${msg.id}\n  Created: ${msg.createdAt}`,
      );
    });

  space
    .command("edit-reply <replyId>")
    .description("Edit a reply. You must be the author.")
    .requiredOption(
      "--content <content>",
      "New content for the reply (markdown supported)",
    )
    .action(async (replyId: string, opts: { content: string }) => {
      const spaceSlug = resolveSpaceSlug(space);
      const resp = (await apiPatch(
        `/spaces/${spaceSlug}/replies/${replyId}`,
        { content: opts.content },
      )) as Record<string, unknown>;
      const msg = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut(msg);
        return;
      }

      console.log(
        `Reply edited!\n  ID: ${msg.id}\n  Edited: ${msg.editedAt}`,
      );
    });

  space
    .command("delete-reply <replyId>")
    .description("Delete a reply. You must be the author.")
    .action(async (replyId: string) => {
      const spaceSlug = resolveSpaceSlug(space);
      await apiDelete(`/spaces/${spaceSlug}/replies/${replyId}`);

      if (isJsonMode(space)) {
        jsonOut({ replyId });
        return;
      }

      console.log(`Reply ${replyId} deleted.`);
    });
}
