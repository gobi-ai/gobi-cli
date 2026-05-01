import { readFileSync } from "fs";
import { Command } from "commander";
import { apiGet, apiPost, apiPatch, apiDelete } from "../client.js";
import { isJsonMode, jsonOut, resolveVaultSlug, unwrapResp } from "./utils.js";
import { extractWikiLinks, uploadAttachments } from "../attachments.js";
import { getValidToken } from "../auth/manager.js";

function readContent(value: string): string {
  if (value === "-") return readFileSync("/dev/stdin", "utf8");
  return value;
}

function formatFeedLine(m: Record<string, unknown>): string {
  const isReply =
    m.parentPostId != null ||
    m.type === "post-reply";
  const id = `[${isReply ? "r" : "p"}:${m.id}]`;
  const kind = isReply ? "reply" : "post ";
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
    .description("Global commands (posts and replies in the public feed across all vaults).");

  // ── Feed (unified) ──

  global
    .command("feed")
    .description("List the global public feed (posts and replies, newest first).")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option("--following", "Only include posts from authors you follow")
    .action(async (opts: { limit: string; cursor?: string; following?: boolean }) => {
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      if (opts.following) params.following = "true";
      const resp = (await apiGet(`/feed`, params)) as Record<string, unknown>;

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
        console.log("No items found.");
        return;
      }
      const lines = items.map(formatFeedLine);
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Global feed (${items.length} items, newest first):\n` + lines.join("\n") + footer,
      );
    });

  // ── List posts ──

  global
    .command("list-posts")
    .description("List posts in the global feed (paginated). Pass --mine to limit to your own posts.")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option("--mine", "Only include posts authored by you")
    .option("--vault-slug <vaultSlug>", "Filter by author vault slug")
    .action(async (opts: { limit: string; cursor?: string; mine?: boolean; vaultSlug?: string }) => {
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      if (opts.mine) params.mine = "true";
      if (opts.vaultSlug) params.vaultSlug = opts.vaultSlug;
      const resp = (await apiGet(`/posts`, params)) as Record<string, unknown>;

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
        console.log("No posts found.");
        return;
      }
      const lines: string[] = [];
      for (const t of items) {
        const author =
          ((t.author as Record<string, unknown>)?.name as string) ||
          `User ${t.authorId}`;
        const vaultSlug =
          ((t.vault as Record<string, unknown>)?.vaultSlug as string) ||
          ((t.authorVault as Record<string, unknown>)?.vaultSlug as string) ||
          "?";
        lines.push(
          `- [${t.id}] "${t.title}" by ${author} (vault: ${vaultSlug}, ${t.replyCount ?? 0} replies, ${t.createdAt})`,
        );
      }
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Posts (${items.length} items):\n` + lines.join("\n") + footer,
      );
    });

  // ── Get post (with ancestors and replies) ──

  global
    .command("get-post <postId>")
    .description("Get a global post with its ancestors and replies (paginated).")
    .option("--limit <number>", "Replies per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option("--full", "Show full reply content without truncation")
    .action(
      async (
        postId: string,
        opts: { limit: string; cursor?: string; full?: boolean },
      ) => {
        const params: Record<string, unknown> = {
          limit: parseInt(opts.limit, 10),
        };
        if (opts.cursor) params.cursor = opts.cursor;
        const [postResp, ancestorsResp] = await Promise.all([
          apiGet(`/feed/${postId}`, params) as Promise<Record<string, unknown>>,
          apiGet(`/feed/${postId}/ancestors`) as Promise<Record<string, unknown>>,
        ]);
        const data = unwrapResp(postResp) as Record<string, unknown>;
        const pagination = (postResp.pagination || {}) as Record<string, unknown>;
        const mentions = (postResp.mentions || {}) as Record<string, unknown>;
        const ancestorsData = unwrapResp(ancestorsResp) as Record<string, unknown>;
        const ancestors = ((ancestorsData.ancestors as unknown[]) || []) as Record<string, unknown>[];

        if (isJsonMode(global)) {
          jsonOut({ ...data, ancestors, pagination, mentions });
          return;
        }

        const post = (data.update || data.post || data) as Record<string, unknown>;
        const replies = ((data.replies as unknown[]) || []) as Record<string, unknown>[];

        const author =
          ((post.author as Record<string, unknown>)?.name as string) ||
          `User ${post.authorId}`;
        const vault =
          ((post.vault as Record<string, unknown>)?.vaultSlug as string) ||
          ((post.authorVault as Record<string, unknown>)?.vaultSlug as string) ||
          "?";

        const ancestorLines: string[] = [];
        if (ancestors.length) {
          ancestors.forEach((a, i) => {
            ancestorLines.push(`  ${i + 1}. ${formatFeedLine(a)}`);
          });
        }

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

        const isReplyPost = post.parentPostId != null;
        const heading = isReplyPost
          ? `Reply [r:${post.id}]`
          : `Post: ${post.title || "(no title)"}`;

        const output = [
          heading,
          `By: ${author} (vault: ${vault}) on ${post.createdAt}`,
          ...(ancestorLines.length
            ? ["", `Ancestors (${ancestors.length} items, root first):`, ...ancestorLines]
            : []),
          "",
          (post.content as string) || "",
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

  // ── Create post ──

  global
    .command("create-post")
    .description("Create a post in the global feed (publishes from your vault).")
    .option("--title <title>", "Title of the post")
    .option("--content <content>", "Post content (markdown supported, use \"-\" for stdin)")
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Author vault slug (overrides .gobi/settings.yaml)",
    )
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before posting",
    )
    .action(async (opts: {
      title?: string;
      content?: string;
      richText?: string;
      vaultSlug?: string;
      autoAttachments?: boolean;
    }) => {
      if (!opts.content && !opts.richText) {
        throw new Error("Provide either --content or --rich-text.");
      }
      if (opts.content && opts.richText) {
        throw new Error("--content and --rich-text are mutually exclusive.");
      }
      const vaultSlug = resolveVaultSlug(opts);
      const body: Record<string, unknown> = {};
      if (opts.title != null) body.title = opts.title;
      if (opts.content != null) {
        const content = readContent(opts.content);
        if (opts.autoAttachments) {
          const token = await getValidToken();
          const links = extractWikiLinks(content);
          await uploadAttachments(vaultSlug, links, token, { addToSyncfiles: true });
        }
        body.content = content;
      }
      if (opts.richText != null) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(opts.richText);
        } catch {
          throw new Error("Invalid --rich-text JSON.");
        }
        body.richText = parsed;
      }
      const resp = (await apiPost(`/posts/vault/${vaultSlug}`, body)) as Record<string, unknown>;
      const post = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(global)) {
        jsonOut(post);
        return;
      }

      console.log(
        `Post created!\n` +
          `  ID: ${post.id}\n` +
          (post.title ? `  Title: ${post.title}\n` : "") +
          `  Created: ${post.createdAt}`,
      );
    });

  // ── Edit post ──

  global
    .command("edit-post <postId>")
    .description("Edit a post you authored in the global feed.")
    .option("--title <title>", "New title")
    .option("--content <content>", "New content (markdown supported, use \"-\" for stdin)")
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .action(async (
      postId: string,
      opts: { title?: string; content?: string; richText?: string },
    ) => {
      if (opts.title == null && opts.content == null && opts.richText == null) {
        throw new Error("Provide at least --title, --content, or --rich-text to update.");
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
      const resp = (await apiPatch(`/posts/${postId}`, body)) as Record<string, unknown>;
      const post = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(global)) {
        jsonOut(post);
        return;
      }

      console.log(
        `Post edited!\n  ID: ${post.id}\n  Edited: ${post.editedAt ?? post.updatedAt}`,
      );
    });

  // ── Delete post ──

  global
    .command("delete-post <postId>")
    .description("Delete a post you authored in the global feed.")
    .action(async (postId: string) => {
      await apiDelete(`/posts/${postId}`);

      if (isJsonMode(global)) {
        jsonOut({ id: postId });
        return;
      }

      console.log(`Post ${postId} deleted.`);
    });

  // ── Reply ──

  global
    .command("create-reply <postId>")
    .description("Reply to a post in the global feed.")
    .option("--content <content>", "Reply content (markdown supported, use \"-\" for stdin)")
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .action(async (postId: string, opts: { content?: string; richText?: string }) => {
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
      const resp = (await apiPost(`/posts/${postId}/replies`, body)) as Record<
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

  global
    .command("edit-reply <replyId>")
    .description("Edit a reply you authored in the global feed.")
    .requiredOption(
      "--content <content>",
      "New reply content (markdown supported, use \"-\" for stdin)",
    )
    .action(async (replyId: string, opts: { content: string }) => {
      const content = readContent(opts.content);
      const resp = (await apiPatch(`/posts/replies/${replyId}`, {
        content,
      })) as Record<string, unknown>;
      const reply = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(global)) {
        jsonOut(reply);
        return;
      }

      console.log(
        `Reply edited!\n  ID: ${reply.id}\n  Edited: ${reply.editedAt ?? reply.updatedAt}`,
      );
    });

  global
    .command("delete-reply <replyId>")
    .description("Delete a reply you authored in the global feed.")
    .action(async (replyId: string) => {
      await apiDelete(`/posts/replies/${replyId}`);

      if (isJsonMode(global)) {
        jsonOut({ replyId });
        return;
      }

      console.log(`Reply ${replyId} deleted.`);
    });
}
