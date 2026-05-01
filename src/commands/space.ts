import { Command } from "commander";
import { apiGet, apiPost, apiPatch, apiDelete } from "../client.js";
import { selectSpace, writeSpaceSetting } from "./init.js";
import {
  isJsonMode,
  jsonOut,
  readStdin,
  resolveSpaceSlug,
  resolveVaultSlug,
  unwrapResp,
} from "./utils.js";
import { extractWikiLinks, uploadAttachments } from "../attachments.js";
import { getValidToken } from "../auth/manager.js";

function readContent(value: string): string {
  if (value === "-") return readStdin();
  return value;
}

function formatFeedLine(m: Record<string, unknown>): string {
  const isReply = m.parentPostId != null;
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

export function registerSpaceCommand(program: Command): void {
  const space = program
    .command("space")
    .description(
      "Space commands (posts, replies). Space and member admin is web-UI only.",
    )
    .option(
      "--space-slug <slug>",
      "Space slug (overrides .gobi/settings.yaml)",
    );

  // ── List spaces ──

  space
    .command("list")
    .description("List spaces you are a member of.")
    .action(async () => {
      const resp = (await apiGet("/spaces")) as Record<string, unknown>;
      const items = (resp.data || []) as Record<string, unknown>[];

      if (isJsonMode(space)) {
        jsonOut(items);
        return;
      }

      if (!items.length) {
        console.log("No spaces found.");
        return;
      }

      const lines: string[] = [];
      for (const s of items) {
        const desc = s.description ? ` - ${s.description}` : "";
        lines.push(`- [${s.slug}] ${s.name}${desc}`);
      }
      console.log(`Spaces (${items.length}):\n` + lines.join("\n"));
    });

  // ── Get space ──

  space
    .command("get [spaceSlug]")
    .description(
      "Get details for a space. Pass a slug or omit to use the current space (from .gobi/settings.yaml or --space-slug).",
    )
    .action(async (spaceSlug?: string) => {
      const slug = spaceSlug || resolveSpaceSlug(space);
      const resp = (await apiGet(`/spaces/${slug}`)) as Record<string, unknown>;
      const s = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut(s);
        return;
      }

      const desc = s.description ? `\n  Description: ${s.description}` : "";
      console.log(
        `Space [${s.slug}] ${s.name}${desc}\n` +
          `  ID: ${s.id}\n` +
          `  Created: ${s.createdAt}`,
      );
    });

  // ── Warp (space selection) ──

  space
    .command("warp [spaceSlug]")
    .description("Select the active space. Pass a slug to warp directly, or omit for interactive selection.")
    .action(async (spaceSlug?: string) => {
      if (spaceSlug) {
        writeSpaceSetting(spaceSlug);

        if (isJsonMode(space)) {
          jsonOut({ spaceSlug });
          return;
        }

        console.log(`Warped to space "${spaceSlug}"`);
        return;
      }

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

  // ── Topics ──

  space
    .command("list-topics")
    .description("List topics in a space, ordered by most recent content linkage.")
    .option("--limit <number>", "Max topics to return (0 = all)", "50")
    .action(async (opts: { limit: string }) => {
      const spaceSlug = resolveSpaceSlug(space);
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      const resp = (await apiGet(`/spaces/${spaceSlug}/topics`, params)) as Record<string, unknown>;
      const items = (resp.data || []) as Record<string, unknown>[];

      if (isJsonMode(space)) {
        jsonOut(items);
        return;
      }

      if (!items.length) {
        console.log("No topics found.");
        return;
      }

      const lines: string[] = [];
      for (const t of items) {
        const desc = t.description ? ` - ${t.description}` : "";
        lines.push(`- [${t.slug}] ${t.name}${desc}`);
      }
      console.log(`Topics (${items.length}):\n` + lines.join("\n"));
    });

  space
    .command("list-topic-posts <topicSlug>")
    .description("List posts tagged with a topic in a space (cursor-paginated).")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (topicSlug: string, opts: { limit: string; cursor?: string }) => {
      const spaceSlug = resolveSpaceSlug(space);
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      const resp = (await apiGet(`/spaces/${spaceSlug}/topics/${topicSlug}/posts`, params)) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;
      const pagination = (resp.pagination || {}) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut({ ...data, pagination });
        return;
      }

      const topic = (data.topic || {}) as Record<string, unknown>;
      const posts = (data.posts || []) as Record<string, unknown>[];

      if (!posts.length) {
        console.log(`No posts found for topic "${topic.name || topicSlug}".`);
        return;
      }

      const lines: string[] = [];
      for (const t of posts) {
        const author =
          ((t.author as Record<string, unknown>)?.name as string) || "Unknown";
        const spaceName =
          ((t.space as Record<string, unknown>)?.name as string) || "";
        lines.push(
          `- [${t.id}] "${t.title}" by ${author} in ${spaceName} (${t.replyCount} replies, ${t.createdAt})`,
        );
      }
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Topic: ${topic.name || topicSlug}\n` +
          `Posts (${posts.length} items):\n` +
          lines.join("\n") +
          footer,
      );
    });

  // ── Feed (unified) ──

  space
    .command("feed")
    .description("List the unified feed (posts and replies, newest first) in a space.")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (opts: { limit: string; cursor?: string }) => {
      const spaceSlug = resolveSpaceSlug(space);
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      const resp = (await apiGet(`/spaces/${spaceSlug}/feed`, params)) as Record<string, unknown>;

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
        console.log("No items found.");
        return;
      }
      const lines = items.map(formatFeedLine);
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Feed (${items.length} items, newest first):\n` + lines.join("\n") + footer,
      );
    });

  // ── Posts (get, list, create, edit, delete) ──

  space
    .command("get-post <postId>")
    .description("Get a post with its ancestors and replies (paginated).")
    .option("--limit <number>", "Replies per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(
      async (postId: string, opts: { limit: string; cursor?: string }) => {
        const spaceSlug = resolveSpaceSlug(space);
        const params: Record<string, unknown> = {
          limit: parseInt(opts.limit, 10),
        };
        if (opts.cursor) params.cursor = opts.cursor;
        const [postResp, ancestorsResp] = await Promise.all([
          apiGet(`/spaces/${spaceSlug}/posts/${postId}`, params) as Promise<Record<string, unknown>>,
          apiGet(`/spaces/${spaceSlug}/posts/${postId}/ancestors`) as Promise<Record<string, unknown>>,
        ]);
        const data = unwrapResp(postResp) as Record<string, unknown>;
        const pagination = (postResp.pagination || {}) as Record<string, unknown>;
        const mentions = (postResp.mentions || {}) as Record<string, unknown>;
        const ancestorsData = unwrapResp(ancestorsResp) as Record<string, unknown>;
        const ancestors = ((ancestorsData.ancestors as unknown[]) || []) as Record<string, unknown>[];

        if (isJsonMode(space)) {
          jsonOut({ ...data, ancestors, pagination, mentions });
          return;
        }

        const post = (data.thread || data) as Record<string, unknown>;
        const replies = ((data.items as unknown[]) || []) as Record<
          string,
          unknown
        >[];

        const author =
          ((post.author as Record<string, unknown>)?.name as string) ||
          `User ${post.authorId}`;

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
          const text = r.content as string;
          const truncated =
            text && text.length > 200 ? text.slice(0, 200) + "…" : text;
          replyLines.push(`  - ${rAuthor}: ${truncated} (${r.createdAt})`);
        }

        const isReplyPost = post.parentPostId != null;
        const heading = isReplyPost
          ? `Reply [r:${post.id}]`
          : `Post: ${post.title || "(no title)"}`;

        const output = [
          heading,
          `By: ${author} on ${post.createdAt}`,
          ...(ancestorLines.length
            ? ["", `Ancestors (${ancestors.length} items, root first):`, ...ancestorLines]
            : []),
          "",
          (post.content as string) || "",
          "",
          `Replies (${replies.length} items):`,
          ...replyLines,
          ...(pagination.hasMore ? [`  Next cursor: ${pagination.nextCursor}`] : []),
        ].join("\n");
        console.log(output);
      },
    );

  space
    .command("list-posts")
    .description("List posts in a space (paginated).")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (opts: { limit: string; cursor?: string }) => {
      const spaceSlug = resolveSpaceSlug(space);
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      const resp = (await apiGet(`/spaces/${spaceSlug}/posts`, params)) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut({
          items: resp.data || [],
          pagination: resp.pagination || {},
          mentions: resp.mentions || {},
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
        lines.push(
          `- [${t.id}] "${t.title}" by ${author} (${t.replyCount} replies, ${t.createdAt})`,
        );
      }
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Posts (${items.length} items):\n` + lines.join("\n") + footer,
      );
    });

  space
    .command("create-post")
    .description("Create a post in a space.")
    .requiredOption("--title <title>", "Title of the post")
    .requiredOption(
      "--content <content>",
      "Post content (markdown supported)",
    )
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before posting (also attributes the post to that vault)",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Attribute the post to this vault (sets authorVaultId). Also used as upload destination for --auto-attachments.",
    )
    .action(
      async (opts: {
        title: string;
        content: string;
        autoAttachments?: boolean;
        vaultSlug?: string;
      }) => {
        const content = readContent(opts.content);
        let authorVaultSlug: string | undefined;
        if (opts.vaultSlug || opts.autoAttachments) {
          authorVaultSlug = resolveVaultSlug(opts);
        }
        if (opts.autoAttachments) {
          const token = await getValidToken();
          const links = extractWikiLinks(content);
          await uploadAttachments(authorVaultSlug!, links, token, { addToSyncfiles: true });
        }
        const spaceSlug = resolveSpaceSlug(space);
        const body: Record<string, unknown> = {
          title: opts.title,
          content,
        };
        if (authorVaultSlug) body.authorVaultSlug = authorVaultSlug;
        const resp = (await apiPost(`/spaces/${spaceSlug}/posts`, body)) as Record<string, unknown>;
        const post = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(space)) {
          jsonOut(post);
          return;
        }

        console.log(
          `Post created!\n` +
            `  ID: ${post.id}\n` +
            `  Title: ${post.title}\n` +
            `  Created: ${post.createdAt}`,
        );
      },
    );

  space
    .command("edit-post <postId>")
    .description("Edit a post. You must be the author.")
    .option("--title <title>", "New title for the post")
    .option(
      "--content <content>",
      "New content for the post (markdown supported)",
    )
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before editing (also attributes the post to that vault)",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Attribute the post to this vault (sets authorVaultId). Also used as upload destination for --auto-attachments. Pass an empty string to detach.",
    )
    .action(
      async (
        postId: string,
        opts: { title?: string; content?: string; autoAttachments?: boolean; vaultSlug?: string },
      ) => {
        const wantsVaultChange = opts.vaultSlug !== undefined || opts.autoAttachments;
        if (!opts.title && !opts.content && !wantsVaultChange) {
          throw new Error(
            "Provide at least --title, --content, or --vault-slug to update.",
          );
        }
        const spaceSlug = resolveSpaceSlug(space);
        let authorVaultSlug: string | undefined;
        if (opts.vaultSlug !== undefined) {
          // Empty string detaches; non-empty resolves through settings fallback.
          authorVaultSlug = opts.vaultSlug === "" ? "" : resolveVaultSlug(opts);
        } else if (opts.autoAttachments) {
          authorVaultSlug = resolveVaultSlug(opts);
        }
        const body: Record<string, unknown> = {};
        if (opts.title != null) body.title = opts.title;
        if (opts.content != null) {
          const content = readContent(opts.content);
          if (opts.autoAttachments) {
            const token = await getValidToken();
            const links = extractWikiLinks(content);
            await uploadAttachments(authorVaultSlug!, links, token, { addToSyncfiles: true });
          }
          body.content = content;
        }
        if (authorVaultSlug !== undefined) body.authorVaultSlug = authorVaultSlug;
        const resp = (await apiPatch(
          `/spaces/${spaceSlug}/posts/${postId}`,
          body,
        )) as Record<string, unknown>;
        const post = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(space)) {
          jsonOut(post);
          return;
        }

        console.log(
          `Post edited!\n` +
            `  ID: ${post.id}\n` +
            `  Title: ${post.title}\n` +
            `  Edited: ${post.editedAt}`,
        );
      },
    );

  space
    .command("delete-post <postId>")
    .description("Delete a post. You must be the author.")
    .action(async (postId: string) => {
      const spaceSlug = resolveSpaceSlug(space);
      await apiDelete(`/spaces/${spaceSlug}/posts/${postId}`);

      if (isJsonMode(space)) {
        jsonOut({ id: postId });
        return;
      }

      console.log(`Post ${postId} deleted.`);
    });

  // ── Replies (create, edit, delete) ──

  space
    .command("create-reply <postId>")
    .description("Create a reply to a post in a space.")
    .requiredOption(
      "--content <content>",
      "Reply content (markdown supported)",
    )
    .action(async (postId: string, opts: { content: string }) => {
      const spaceSlug = resolveSpaceSlug(space);
      const resp = (await apiPost(
        `/spaces/${spaceSlug}/posts/${postId}/replies`,
        { content: readContent(opts.content) },
      )) as Record<string, unknown>;
      const msg = unwrapResp(resp) as Record<string, unknown>;
      const mentions = (resp.mentions || {}) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut({ ...msg, mentions });
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
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before editing",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Vault slug for attachment uploads (overrides .gobi/settings.yaml)",
    )
    .action(async (replyId: string, opts: { content: string; autoAttachments?: boolean; vaultSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space);
      const content = readContent(opts.content);
      if (opts.autoAttachments) {
        const vaultSlug = resolveVaultSlug(opts);
        const token = await getValidToken();
        const links = extractWikiLinks(content);
        await uploadAttachments(vaultSlug, links, token, { addToSyncfiles: true });
      }
      const resp = (await apiPatch(
        `/spaces/${spaceSlug}/replies/${replyId}`,
        { content },
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
