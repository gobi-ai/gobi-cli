import { Command } from "commander";
import { WEB_BASE_URL } from "../constants.js";
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "../client.js";
import {
  buildMentionMap,
  formatAttachmentLines,
  formatAttachmentSummary,
  formatPostLabel,
  formatReactionChips,
  formatReplyLine,
  isJsonMode,
  jsonOut,
  MentionMap,
  postBodyText,
  readStdin,
  unwrapResp,
} from "./utils.js";
import {
  uploadPostAttachments,
  assertPostAttachmentMix,
} from "../attachments.js";

function readContent(value: string): string {
  if (value === "-") return readStdin();
  return value;
}

function buildPersonalPostUrl(post: Record<string, unknown>): string {
  return `${WEB_BASE_URL}/posts/${post.id}`;
}

function formatFeedLine(
  m: Record<string, unknown>,
  mentions?: MentionMap,
): string {
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
    const text = postBodyText(m, mentions).replace(/\s+/g, " ").trim();
    label = text.length > 80 ? text.slice(0, 80) + "…" : text;
  } else {
    label = formatPostLabel(m, mentions);
  }
  const chips = formatReactionChips(m);
  const attachSummary = formatAttachmentSummary(m);
  return (
    `${id} ${kind} ${author}  "${label}"  ${m.createdAt}` +
    (attachSummary ? `  ${attachSummary}` : "") +
    (chips ? `  ${chips}` : "")
  );
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
          mentions: resp.mentions || {},
        });
        return;
      }

      const items = (resp.data || []) as Record<string, unknown>[];
      const pagination = (resp.pagination || {}) as Record<string, unknown>;
      if (!items.length) {
        console.log("No items found.");
        return;
      }
      const mentions = buildMentionMap(resp);
      const lines = items.map((m) => formatFeedLine(m, mentions));
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
    .action(async (opts: { limit: string; cursor?: string; mine?: boolean }) => {
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      if (opts.mine) params.mine = "true";
      const resp = (await apiGet(`/posts`, params)) as Record<string, unknown>;

      if (isJsonMode(global)) {
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
      const mentions = buildMentionMap(resp);
      const lines: string[] = [];
      for (const t of items) {
        const author =
          ((t.author as Record<string, unknown>)?.name as string) ||
          `User ${t.authorId}`;
        lines.push(
          `- [${t.id}] "${formatPostLabel(t, mentions)}" by ${author} (${t.replyCount ?? 0} replies, ${t.createdAt})`,
        );
        for (const line of formatAttachmentLines(t, "    ", "📎")) {
          lines.push(line);
        }
        const replies = (t.replies as Record<string, unknown>[]) || [];
        for (const r of replies) {
          lines.push(formatReplyLine(r, mentions));
        }
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

        const mentionMap = buildMentionMap(postResp);
        const author =
          ((post.author as Record<string, unknown>)?.name as string) ||
          `User ${post.authorId}`;

        const ancestorLines: string[] = [];
        if (ancestors.length) {
          ancestors.forEach((a, i) => {
            ancestorLines.push(`  ${i + 1}. ${formatFeedLine(a, mentionMap)}`);
          });
        }

        const replyLines: string[] = [];
        for (const r of replies) {
          const rAuthor =
            ((r.author as Record<string, unknown>)?.name as string) ||
            `User ${r.authorId}`;
          const text = postBodyText(r, mentionMap);
          const truncated =
            opts.full || text.length <= 200 ? text : text.slice(0, 200) + "…";
          const rChips = formatReactionChips(r);
          const rAttach = formatAttachmentSummary(r);
          replyLines.push(
            `  - [r:${r.id}] ${rAuthor}: ${truncated} (${r.createdAt})${rAttach ? `  ${rAttach}` : ""}${rChips ? `  ${rChips}` : ""}`,
          );
        }

        const isReplyPost = post.parentPostId != null;
        const heading = isReplyPost
          ? `Reply [r:${post.id}]`
          : `Post: ${post.title || "(no title)"}`;

        const postChips = formatReactionChips(post);
        const attachmentLines = formatAttachmentLines(post);
        const output = [
          heading,
          `By: ${author} on ${post.createdAt}`,
          ...(postChips ? [`Reactions: ${postChips}`] : []),
          ...(ancestorLines.length
            ? ["", `Ancestors (${ancestors.length} items, root first):`, ...ancestorLines]
            : []),
          "",
          postBodyText(post, mentionMap),
          ...(attachmentLines.length
            ? ["", `Attachments (${attachmentLines.length}):`, ...attachmentLines]
            : []),
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
      "Create a post in the global feed.",
    )
    .option("--title <title>", "Title of the post")
    .option("--content <content>", "Post content (markdown supported, use \"-\" for stdin)")
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .option(
      "--artifact <artifactId>",
      "Attach an existing artifact to the post (repeatable). Create artifacts with `gobi personal artifact create`.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option(
      "--attach <file>",
      "Local media or document file to attach. Repeatable. Mix rule: up to 4 photos + up to 4 document files (pdf/md/txt/csv) OR 1 GIF OR 1 video. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option(
      "--repost-post-id <postId>",
      "Wrap an existing top-level post as the embedded card on this new post. Composes with --content / --rich-text / --attach (the wrapping author's text + media render above the embedded card). Reposts-of-reposts are collapsed to the transitive root server-side. The referenced post must exist, not be deleted, and not itself be a reply.",
    )
    .action(async (opts: {
      title?: string;
      content?: string;
      richText?: string;
      artifact?: string[];
      attach?: string[];
      repostPostId?: string;
    }) => {
      // A post is substantive if it has a text body OR carries an attachment
      // (artifact card / media) OR embeds a repost. Only block the truly empty
      // case — this is what lets an artifact-only post be created with no content.
      const hasAttachmentPayload =
        (opts.artifact && opts.artifact.length > 0) ||
        (opts.attach && opts.attach.length > 0) ||
        opts.repostPostId != null;
      if (!opts.content && !opts.richText && !hasAttachmentPayload) {
        throw new Error(
          "Provide --content, --rich-text, or an attachment (--artifact / --attach / --repost-post-id).",
        );
      }
      if (opts.content && opts.richText) {
        throw new Error("--content and --rich-text are mutually exclusive.");
      }

      const body: Record<string, unknown> = {};
      if (opts.title != null) body.title = opts.title;
      if (opts.content != null) {
        body.content = readContent(opts.content);
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
      if (opts.artifact && opts.artifact.length > 0) body.artifactIds = opts.artifact;
      if (opts.attach && opts.attach.length > 0) {
        assertPostAttachmentMix(opts.attach);
        body.attachments = await uploadPostAttachments(opts.attach);
      }
      if (opts.repostPostId != null) {
        const n = Number(opts.repostPostId);
        if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
          throw new Error("--repost-post-id must be a positive integer.");
        }
        body.repostPostId = n;
      }
      const resp = (await apiPost(`/posts`, body)) as Record<string, unknown>;
      const post = unwrapResp(resp) as Record<string, unknown>;

      const shareUrl = buildPersonalPostUrl(post);

      if (isJsonMode(global)) {
        jsonOut({ ...post, shareUrl });
        return;
      }

      console.log(
        `Post created!\n` +
          `  ID: ${post.id}\n` +
          (post.title ? `  Title: ${post.title}\n` : "") +
          `  Created: ${post.createdAt}\n` +
          `  URL: ${shareUrl}`,
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
      "--attach <file>",
      "Replace the post's media attachments with the given files (existing attachments are removed). Repeatable. Mix rule: up to 4 photos + up to 4 document files (pdf/md/txt/csv) OR 1 GIF OR 1 video. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files. Omit to leave attachments unchanged.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option(
      "--artifact <artifactId>",
      "Replace the post's artifact attachments with the given artifact(s) (existing artifact attachments are removed). Repeatable. Omit to leave them unchanged. Create artifacts with `gobi personal artifact create`.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .action(async (
      postId: string,
      opts: {
        title?: string;
        content?: string;
        richText?: string;
        attach?: string[];
        artifact?: string[];
      },
    ) => {
      const wantsAttachChange = !!(opts.attach && opts.attach.length > 0);
      const wantsArtifactChange = !!(opts.artifact && opts.artifact.length > 0);
      if (
        opts.title == null &&
        opts.content == null &&
        opts.richText == null &&
        !wantsAttachChange &&
        !wantsArtifactChange
      ) {
        throw new Error("Provide at least --title, --content, --rich-text, --attach, or --artifact to update.");
      }
      if (opts.content && opts.richText) {
        throw new Error("--content and --rich-text are mutually exclusive.");
      }
      const body: Record<string, unknown> = {};
      if (opts.title != null) body.title = opts.title;
      if (opts.content != null) {
        body.content = readContent(opts.content);
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
      if (opts.attach && opts.attach.length > 0) {
        assertPostAttachmentMix(opts.attach);
        body.attachments = await uploadPostAttachments(opts.attach);
      }
      if (opts.artifact && opts.artifact.length > 0) body.artifactIds = opts.artifact;
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
      "--attach <file>",
      "Local media or document file to attach to this reply. Repeatable. Mix rule: up to 4 photos + up to 4 document files (pdf/md/txt/csv) OR 1 GIF OR 1 video. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .action(async (postId: string, opts: { content?: string; richText?: string; attach?: string[] }) => {
      if (!opts.content && !opts.richText) {
        throw new Error("Provide either --content or --rich-text.");
      }
      if (opts.content && opts.richText) {
        throw new Error("--content and --rich-text are mutually exclusive.");
      }
      const body: Record<string, unknown> = {};
      if (opts.content != null) {
        body.content = readContent(opts.content);
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
      if (opts.attach && opts.attach.length > 0) {
        assertPostAttachmentMix(opts.attach);
        body.attachments = await uploadPostAttachments(opts.attach);
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
    .option(
      "--content <content>",
      "New reply content (markdown supported, use \"-\" for stdin)",
    )
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .action(
      async (
        replyId: string,
        opts: { content?: string; richText?: string },
      ) => {
        if (opts.content == null && opts.richText == null) {
          throw new Error(
            "Provide at least --content or --rich-text to update.",
          );
        }
        if (opts.content && opts.richText) {
          throw new Error("--content and --rich-text are mutually exclusive.");
        }
        const body: Record<string, unknown> = {};
        if (opts.content != null) {
          body.content = readContent(opts.content);
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

  // ── Reactions (react, unreact) ──

  global
    .command("react <postId> <emoji>")
    .description(
      "Add an emoji reaction to a global-feed post or reply (idempotent). <postId> is the numeric id of a post OR a reply — the [p:N]/[r:N] ids shown in feed output.",
    )
    .action(async (postId: string, emoji: string) => {
      const resp = (await apiPut(`/posts/${postId}/reactions`, {
        emoji,
      })) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(global)) {
        jsonOut(data);
        return;
      }

      const chips = formatReactionChips(data);
      console.log(
        `Reacted ${emoji} to ${postId}.` + (chips ? `\n  Now: ${chips}` : ""),
      );
    });

  global
    .command("unreact <postId> <emoji>")
    .description(
      "Remove your emoji reaction from a global-feed post or reply. <postId> is the numeric id of a post OR a reply.",
    )
    .action(async (postId: string, emoji: string) => {
      const resp = (await apiDelete(
        `/posts/${postId}/reactions/${encodeURIComponent(emoji)}`,
      )) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(global)) {
        jsonOut(data);
        return;
      }

      const chips = formatReactionChips(data);
      console.log(
        `Removed ${emoji} reaction from ${postId}.` +
          (chips ? `\n  Now: ${chips}` : ""),
      );
    });
}
