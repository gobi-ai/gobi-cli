import { Command } from "commander";
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "../client.js";
import {
  formatAttachmentLines,
  formatAttachmentSummary,
  formatReactionChips,
  isJsonMode,
  jsonOut,
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
  const chips = formatReactionChips(m);
  const attachSummary = formatAttachmentSummary(m);
  return (
    `${id} ${kind} ${author}  "${label}"  ${m.createdAt}` +
    (attachSummary ? `  ${attachSummary}` : "") +
    (chips ? `  ${chips}` : "")
  );
}

export function registerPersonalCommand(program: Command): void {
  const personal = program
    .command("personal")
    .description(
      "Personal-space commands (private posts and replies visible only to you). " +
        "Mirrors the `global` subcommand shape — posts/replies live in the same data " +
        "model, scoped via personalSpaceUserId so they never surface on the public feed.",
    );

  // ── Feed (unified) ──

  personal
    .command("feed")
    .description(
      "List your personal-space feed (posts and replies, newest first). Only you can see these rows.",
    )
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (opts: { limit: string; cursor?: string }) => {
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      const resp = (await apiGet(`/posts/personal-space`, params)) as Record<string, unknown>;

      if (isJsonMode(personal)) {
        jsonOut({
          items: resp.data || [],
          pagination: resp.pagination || {},
        });
        return;
      }

      const items = (resp.data || []) as Record<string, unknown>[];
      const pagination = (resp.pagination || {}) as Record<string, unknown>;
      if (!items.length) {
        console.log("No items in your personal space yet.");
        return;
      }
      const lines = items.map(formatFeedLine);
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Personal-space feed (${items.length} items, newest first):\n` +
          lines.join("\n") +
          footer,
      );
    });

  // ── Search ──

  personal
    .command("search-posts <query>")
    .description(
      "Search your personal-space posts and replies (newest first). The query supports keywords " +
        "plus from:<name> and topic:<tag> operators (quote multi-word values). " +
        "Each result is an individual post or reply, not a whole thread.",
    )
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (query: string, opts: { limit: string; cursor?: string }) => {
      const params: Record<string, unknown> = {
        q: query,
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      const resp = (await apiGet(`/posts/personal-space/search`, params)) as Record<string, unknown>;

      if (isJsonMode(personal)) {
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
        console.log("No results found.");
        return;
      }
      const lines = items.map(formatFeedLine);
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Search results (${items.length} items, newest first):\n` + lines.join("\n") + footer,
      );
    });

  // ── List posts ──
  //
  // No server-side roots-only endpoint exists for the personal-space lane;
  // we fetch the unified feed and filter client-side to `type === 'post'`.
  // The `--limit` then applies to the raw feed page, not the post-only
  // count — callers expecting N roots may need to paginate further.

  personal
    .command("list-posts")
    .description(
      "List root posts (no replies) in your personal space. Filters the personal feed client-side; pagination cursor advances through the underlying feed page.",
    )
    .option("--limit <number>", "Items per page (applied to the underlying feed page)", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (opts: { limit: string; cursor?: string }) => {
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      const resp = (await apiGet(`/posts/personal-space`, params)) as Record<string, unknown>;

      const allItems = ((resp.data || []) as Record<string, unknown>[]);
      const items = allItems.filter(
        (t) => t.type !== "post-reply" && t.parentPostId == null,
      );
      const pagination = (resp.pagination || {}) as Record<string, unknown>;

      if (isJsonMode(personal)) {
        jsonOut({ items, pagination });
        return;
      }

      if (!items.length) {
        console.log("No posts found in your personal space.");
        return;
      }
      const lines: string[] = [];
      for (const t of items) {
        lines.push(
          `- [${t.id}] "${t.title ?? "(no title)"}" (${t.replyCount ?? 0} replies, ${t.createdAt})`,
        );
      }
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Personal-space posts (${items.length} of ${allItems.length} feed items):\n` +
          lines.join("\n") +
          footer,
      );
    });

  // ── Get post (with ancestors and replies) ──
  //
  // Same `/posts/:id` and `/posts/:id/ancestors` routes the global command
  // uses — the server gates these by `viewerUserId`, so private rows
  // resolve for the owner and 404 for everyone else. Personal-space posts
  // and global posts share this endpoint without ambiguity.

  personal
    .command("get-post <postId>")
    .description(
      "Get a personal-space post with its ancestors and replies (paginated). Same endpoint as `gobi global get-post`; only the owner can resolve a private id.",
    )
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

        if (isJsonMode(personal)) {
          jsonOut({ ...data, ancestors, pagination, mentions });
          return;
        }

        const post = (data.update || data.post || data) as Record<string, unknown>;
        const replies = ((data.replies as unknown[]) || []) as Record<string, unknown>[];

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
          const text = (r.content as string) || "";
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
          ? `Reply [r:${post.id}] (private)`
          : `Post: ${post.title || "(no title)"} (private)`;

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
          (post.content as string) || "",
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
  //
  // Targets `POST /posts/personal-space`, the only endpoint that stamps
  // `personalSpaceUserId` on the row. Body shape is identical to the
  // global `POST /posts` create (same CreatePostDto). The server skips the
  // `@gobi` mention dispatch and the notification fan-out for this lane —
  // private posts have no audience.

  personal
    .command("create-post")
    .description(
      "Create a private post in your personal space. Visible only to you.",
    )
    .option("--title <title>", "Title of the post")
    .option("--content <content>", "Post content (markdown supported, use \"-\" for stdin)")
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .option(
      "--artifact <artifactId>",
      "Attach an existing artifact to the post (repeatable). Create artifacts with `gobi artifact create`.",
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
      "Wrap an existing top-level post as the embedded card on this new private post. The referenced post must be visible to you (your own personal-space post, a global-feed post, or a post in a space you're a member of). Reposting someone else's personal-space post returns 404.",
    )
    .action(async (opts: {
      title?: string;
      content?: string;
      richText?: string;
      artifact?: string[];
      attach?: string[];
      repostPostId?: string;
    }) => {
      if (!opts.content && !opts.richText) {
        throw new Error("Provide either --content or --rich-text.");
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
      const resp = (await apiPost(`/posts/personal-space`, body)) as Record<string, unknown>;
      const post = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(personal)) {
        jsonOut(post);
        return;
      }

      console.log(
        `Personal-space post created!\n` +
          `  ID: ${post.id}\n` +
          (post.title ? `  Title: ${post.title}\n` : "") +
          `  Created: ${post.createdAt}\n` +
          `  Visibility: private (only you can see this)`,
      );
    });

  // ── Edit post ──
  //
  // Same `PATCH /posts/:postId` route the global command uses — the server
  // gates on `authorId === userId` and the read-path guard runs first, so
  // a non-owner can't edit (or even discover) a private post.

  personal
    .command("edit-post <postId>")
    .description("Edit a post you authored in your personal space.")
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
      "Replace the post's artifact attachments with the given artifact(s) (existing artifact attachments are removed). Repeatable. Omit to leave them unchanged. Create artifacts with `gobi artifact create`.",
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

      if (isJsonMode(personal)) {
        jsonOut(post);
        return;
      }

      console.log(
        `Post edited!\n  ID: ${post.id}\n  Edited: ${post.editedAt ?? post.updatedAt}`,
      );
    });

  // ── Delete post ──

  personal
    .command("delete-post <postId>")
    .description("Delete a post you authored in your personal space.")
    .action(async (postId: string) => {
      await apiDelete(`/posts/${postId}`);

      if (isJsonMode(personal)) {
        jsonOut({ id: postId });
        return;
      }

      console.log(`Post ${postId} deleted.`);
    });

  // ── Reply ──
  //
  // `POST /posts/:postId/replies` inherits scope from the parent on the
  // server — reply to a personal-space parent → reply is scoped to that
  // personal space. The same command works for global and personal; we
  // expose it here for discoverability/symmetry with `gobi global`.

  personal
    .command("create-reply <postId>")
    .description("Reply to a personal-space post. The reply inherits the parent's private scope automatically.")
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

      if (isJsonMode(personal)) {
        jsonOut(reply);
        return;
      }

      console.log(
        `Reply created!\n  ID: ${reply.id}\n  Created: ${reply.createdAt}`,
      );
    });

  personal
    .command("edit-reply <replyId>")
    .description("Edit a reply you authored in your personal space.")
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

        if (isJsonMode(personal)) {
          jsonOut(reply);
          return;
        }

        console.log(
          `Reply edited!\n  ID: ${reply.id}\n  Edited: ${reply.editedAt ?? reply.updatedAt}`,
        );
      },
    );

  personal
    .command("delete-reply <replyId>")
    .description("Delete a reply you authored in your personal space.")
    .action(async (replyId: string) => {
      await apiDelete(`/posts/replies/${replyId}`);

      if (isJsonMode(personal)) {
        jsonOut({ id: replyId });
        return;
      }

      console.log(`Reply ${replyId} deleted.`);
    });

  // ── Reactions (react, unreact) ──

  personal
    .command("react <postId> <emoji>")
    .description(
      "Add an emoji reaction to a personal-space post or reply (idempotent). <postId> is the numeric id of a post OR a reply.",
    )
    .action(async (postId: string, emoji: string) => {
      const resp = (await apiPut(`/posts/${postId}/reactions`, {
        emoji,
      })) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(personal)) {
        jsonOut(data);
        return;
      }

      const chips = formatReactionChips(data);
      console.log(
        `Reacted ${emoji} to ${postId}.` + (chips ? `\n  Now: ${chips}` : ""),
      );
    });

  personal
    .command("unreact <postId> <emoji>")
    .description(
      "Remove your emoji reaction from a personal-space post or reply. <postId> is the numeric id of a post OR a reply.",
    )
    .action(async (postId: string, emoji: string) => {
      const resp = (await apiDelete(
        `/posts/${postId}/reactions/${encodeURIComponent(emoji)}`,
      )) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(personal)) {
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
