import { Command } from "commander";
import { apiGet, apiPost, apiPatch, apiDelete } from "../client.js";
import {
  fetchDraftSummary,
  isJsonMode,
  jsonOut,
  readStdin,
  resolveVaultSlug,
  unwrapResp,
} from "./utils.js";
import {
  extractWikiLinks,
  uploadAttachments,
  uploadPostAttachments,
  assertPostAttachmentMix,
} from "../attachments.js";
import { getValidToken } from "../auth/manager.js";

function readContent(value: string): string {
  if (value === "-") return readStdin();
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
    .description("List the unified feed (posts and replies, newest first) in the global public feed.")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option("--following", "Only include posts from authors you follow")
    .action(async (opts: { limit: string; cursor?: string; following?: boolean }) => {
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      if (opts.following) params.following = "true";
      const resp = (await apiGet(`/posts/feed`, params)) as Record<string, unknown>;

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
    .option("--limit <number>", "Items per page", "20")
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
          apiGet(`/posts/${postId}`, params) as Promise<Record<string, unknown>>,
          apiGet(`/posts/${postId}/ancestors`) as Promise<Record<string, unknown>>,
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
    .description(
      "Create a post in the global feed. --vault-slug attributes it to a vault you own; defaults to your primary vault.",
    )
    .option("--title <title>", "Title of the post")
    .option("--content <content>", "Post content (markdown supported, use \"-\" for stdin)")
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Attribute the post to this vault (sets authorVaultSlug). Defaults to your primary vault.",
    )
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before posting (also sets authorVaultSlug to that vault)",
    )
    .option(
      "--draft-id <draftId>",
      "Use this draft as the source of title and content (mutually exclusive with --title/--content/--rich-text). On success, links the post back by recording postId on draft.metadata so the client can render an 'Open post' button. The draft's vaultSlug seeds --vault-slug when not given explicitly.",
    )
    .option(
      "--attach <file>",
      "Local media file to attach. Repeatable. X-style mix rule: up to 4 photos OR 1 GIF OR 1 video. Size ceilings: 5MB photos / 15MB GIFs / 512MB video.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .action(async (opts: {
      title?: string;
      content?: string;
      richText?: string;
      vaultSlug?: string;
      autoAttachments?: boolean;
      draftId?: string;
      attach?: string[];
    }) => {
      if (opts.draftId) {
        if (opts.title || opts.content || opts.richText) {
          throw new Error(
            "--draft-id sources title and content from the draft; --title, --content, and --rich-text are not allowed alongside it.",
          );
        }
      } else {
        if (!opts.content && !opts.richText) {
          throw new Error("Provide either --content or --rich-text (or --draft-id).");
        }
        if (opts.content && opts.richText) {
          throw new Error("--content and --rich-text are mutually exclusive.");
        }
      }

      const draft = opts.draftId ? await fetchDraftSummary(opts.draftId) : null;
      const effectiveTitle = draft ? draft.title : opts.title;
      const effectiveContent = draft ? draft.content : opts.content;
      const effectiveVaultSlugOpt = opts.vaultSlug ?? draft?.vaultSlug ?? undefined;

      let authorVaultSlug: string | undefined;
      if (effectiveVaultSlugOpt || opts.autoAttachments) {
        authorVaultSlug = resolveVaultSlug({ vaultSlug: effectiveVaultSlugOpt });
      }
      const body: Record<string, unknown> = {};
      if (effectiveTitle != null) body.title = effectiveTitle;
      if (effectiveContent != null) {
        const content = draft ? effectiveContent! : readContent(effectiveContent!);
        if (opts.autoAttachments && authorVaultSlug) {
          const token = await getValidToken();
          const links = extractWikiLinks(content);
          await uploadAttachments(authorVaultSlug, links, token, { addToSyncfiles: true });
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
      if (authorVaultSlug) body.authorVaultSlug = authorVaultSlug;
      if (opts.attach && opts.attach.length > 0) {
        assertPostAttachmentMix(opts.attach);
        body.attachments = await uploadPostAttachments(opts.attach);
      }
      const resp = (await apiPost(`/posts`, body)) as Record<string, unknown>;
      const post = unwrapResp(resp) as Record<string, unknown>;

      if (opts.draftId && post.id != null) {
        try {
          await apiPatch(`/app/drafts/${opts.draftId}/metadata`, {
            postId: typeof post.id === "number" ? post.id : Number(post.id),
            spaceSlug: null,
          });
        } catch (e) {
          // Don't fail the create if linking fails — the post is live; just
          // surface a warning so the agent can mention it.
          console.error(`Warning: failed to link post to draft ${opts.draftId}: ${(e as Error).message}`);
        }
      }

      if (isJsonMode(global)) {
        jsonOut(post);
        return;
      }

      console.log(
        `Post created!\n` +
          `  ID: ${post.id}\n` +
          (post.title ? `  Title: ${post.title}\n` : "") +
          `  Created: ${post.createdAt}` +
          (opts.draftId ? `\n  Linked to draft: ${opts.draftId}` : ""),
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
    .option(
      "--vault-slug <vaultSlug>",
      "Attribute the post to this vault (sets authorVaultSlug).",
    )
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before editing (uses --vault-slug or .gobi vault)",
    )
    .action(async (
      postId: string,
      opts: {
        title?: string;
        content?: string;
        richText?: string;
        vaultSlug?: string;
        autoAttachments?: boolean;
      },
    ) => {
      const wantsVaultChange = !!(opts.vaultSlug || opts.autoAttachments);
      if (
        opts.title == null &&
        opts.content == null &&
        opts.richText == null &&
        !wantsVaultChange
      ) {
        throw new Error("Provide at least --title, --content, --rich-text, or --vault-slug to update.");
      }
      if (opts.content && opts.richText) {
        throw new Error("--content and --rich-text are mutually exclusive.");
      }
      let authorVaultSlug: string | undefined;
      if (opts.vaultSlug || opts.autoAttachments) {
        authorVaultSlug = resolveVaultSlug(opts);
      }
      const body: Record<string, unknown> = {};
      if (opts.title != null) body.title = opts.title;
      if (opts.content != null) {
        const content = readContent(opts.content);
        if (opts.autoAttachments && authorVaultSlug) {
          const token = await getValidToken();
          const links = extractWikiLinks(content);
          await uploadAttachments(authorVaultSlug, links, token, { addToSyncfiles: true });
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
      if (authorVaultSlug !== undefined) body.authorVaultSlug = authorVaultSlug;
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
    .description("Create a reply to a post in the global feed.")
    .option("--content <content>", "Reply content (markdown supported, use \"-\" for stdin)")
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Attribute the reply to this vault (sets authorVaultSlug). Also used as upload destination for --auto-attachments.",
    )
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before posting (also attributes the reply to that vault)",
    )
    .action(async (postId: string, opts: { content?: string; richText?: string; vaultSlug?: string; autoAttachments?: boolean }) => {
      if (!opts.content && !opts.richText) {
        throw new Error("Provide either --content or --rich-text.");
      }
      if (opts.content && opts.richText) {
        throw new Error("--content and --rich-text are mutually exclusive.");
      }
      let authorVaultSlug: string | undefined;
      if (opts.vaultSlug || opts.autoAttachments) {
        authorVaultSlug = resolveVaultSlug(opts);
      }
      const body: Record<string, unknown> = {};
      if (opts.content != null) {
        const content = readContent(opts.content);
        if (opts.autoAttachments && authorVaultSlug) {
          const token = await getValidToken();
          const links = extractWikiLinks(content);
          await uploadAttachments(authorVaultSlug, links, token, { addToSyncfiles: true });
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
      if (authorVaultSlug) body.authorVaultSlug = authorVaultSlug;
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
    .option(
      "--content <content>",
      "New reply content (markdown supported, use \"-\" for stdin)",
    )
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Attribute the reply to this vault (sets authorVaultSlug). Also used as upload destination for --auto-attachments.",
    )
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before editing (also attributes the reply to that vault)",
    )
    .action(
      async (
        replyId: string,
        opts: { content?: string; richText?: string; autoAttachments?: boolean; vaultSlug?: string },
      ) => {
        const wantsVaultChange = !!(opts.vaultSlug || opts.autoAttachments);
        if (opts.content == null && opts.richText == null && !wantsVaultChange) {
          throw new Error(
            "Provide at least --content, --rich-text, or --vault-slug to update.",
          );
        }
        if (opts.content && opts.richText) {
          throw new Error("--content and --rich-text are mutually exclusive.");
        }
        let authorVaultSlug: string | undefined;
        if (opts.vaultSlug || opts.autoAttachments) {
          authorVaultSlug = resolveVaultSlug(opts);
        }
        const body: Record<string, unknown> = {};
        if (opts.content != null) {
          const content = readContent(opts.content);
          if (opts.autoAttachments && authorVaultSlug) {
            const token = await getValidToken();
            const links = extractWikiLinks(content);
            await uploadAttachments(authorVaultSlug, links, token, { addToSyncfiles: true });
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
        if (authorVaultSlug !== undefined) body.authorVaultSlug = authorVaultSlug;
        const resp = (await apiPatch(`/posts/replies/${replyId}`, body)) as Record<string, unknown>;
        const reply = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(global)) {
          jsonOut(reply);
          return;
        }

        console.log(
          `Reply edited!\n  ID: ${reply.id}\n  Edited: ${reply.editedAt ?? reply.updatedAt}`,
        );
      },
    );

  global
    .command("delete-reply <replyId>")
    .description("Delete a reply you authored in the global feed.")
    .action(async (replyId: string) => {
      await apiDelete(`/posts/replies/${replyId}`);

      if (isJsonMode(global)) {
        jsonOut({ id: replyId });
        return;
      }

      console.log(`Reply ${replyId} deleted.`);
    });
}
