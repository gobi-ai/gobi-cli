import { Command } from "commander";
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "../client.js";
import {
  buildMentionMap,
  feedChip,
  isReplyId,
  parseChannelIdentifier,
  formatAttachmentLines,
  formatAttachmentSummary,
  displayChannelId,
  displayPostId,
  formatAuthorName,
  formatPostLabel,
  formatPostRef,
  formatReactionChips,
  formatReplyLine,
  parseDmIdentifier,
  parsePostIdentifier,
  isJsonMode,
  jsonOut,
  MentionMap,
  postBodyText,
  NO_LINK_PREVIEWS_OPTION_HELP,
  RATIONALE_OPTION_HELP,
  readStdin,
  unwrapResp,
} from "./utils.js";
import {
  uploadPostAttachments,
  assertPostAttachmentMix,
} from "../attachments.js";
import { registerArtifactSubcommands } from "./artifact.js";
import {
  registerActivitiesSubcommands,
  registerNotesSubcommands,
  listPersonalActivities,
  listPersonalNotes,
  ActivityScope,
  NoteScope,
} from "./capture.js";
import { registerContextCommand } from "./context.js";

function readContent(value: string): string {
  if (value === "-") return readStdin();
  return value;
}

function parseFeedIdOption(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  return parseChannelIdentifier(value, "--feed");
}

function formatFeedLine(
  m: Record<string, unknown>,
  mentions?: MentionMap,
): string {
  // Detect replies via parentPostPublicId (or type === "post-reply"); type
  // alone misses a reply the personal feed didn't label.
  const isReply =
    m.parentPostPublicId != null ||
    m.type === "post-reply";
  const id = formatPostRef(m);
  const kind = isReply ? "reply" : "post ";
  const author = formatAuthorName(m);
  let label: string;
  if (isReply) {
    const text = postBodyText(m, mentions).replace(/\s+/g, " ").trim();
    label = text.length > 80 ? text.slice(0, 80) + "…" : text;
  } else {
    label = formatPostLabel(m, mentions);
  }
  const chips = formatReactionChips(m);
  const attachSummary = formatAttachmentSummary(m);
  const chan = feedChip(m);
  return (
    `${id} ${kind} ${author}  "${label}"  ${m.createdAt}` +
    (chan ? `  ${chan}` : "") +
    (attachSummary ? `  ${attachSummary}` : "") +
    (chips ? `  ${chips}` : "")
  );
}

export function registerPersonalCommand(program: Command): void {
  const personal = program
    .command("personal")
    .description(
      "Personal-space commands (private posts, replies, and DMs with your personal bots). " +
        "Posts/replies live in the same data model as space posts, scoped via " +
        "personalSpaceUserId so they never surface on the public feed.",
    );

  // ── Posts and replies ──
  //
  // A reply is a post with a parent: `get` / `edit` / `delete` / `react` take
  // either id (p… / r…), and `reply` writes one.

  const posts = personal
    .command("posts")
    .description("Your private personal-space posts and replies. Every command that takes an id accepts a post (p…) or a reply (r…).");

  posts
    .command("recent")
    .description(
      "List your personal-space posts and replies together, newest first. Only you can see these rows.",
    )
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option(
      "--feed <feedId>",
      "Feed publicId (c…) to read instead of the main feed (see `feeds list`). Omit for the main feed.",
    )
    .option(
      "--all-feeds",
      "Read across the main feed AND every one of your feeds. Overrides --feed.",
    )
    .action(async (opts: { limit: string; cursor?: string; feed?: string; allFeeds?: boolean }) => {
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      if (opts.allFeeds) params.allChannels = true;
      else params.channelId = parseFeedIdOption(opts.feed);
      const resp = (await apiGet(`/posts/personal-space`, params)) as Record<string, unknown>;

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
        console.log("No items in your personal space yet.");
        return;
      }
      const mentions = buildMentionMap(resp);
      const lines = items.map((m) => formatFeedLine(m, mentions));
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Personal-space feed (${items.length} items, newest first):\n` +
          lines.join("\n") +
          footer,
      );
    });


  posts
    .command("search <query>")
    .description(
      "Search your personal-space posts and replies (newest first). The query supports keywords " +
        "plus a from:<name> operator (quote multi-word values). " +
        "Each result is an individual post or reply, not a whole thread.",
    )
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option(
      "--feed <feedId>",
      "Restrict results to one of your feeds (c…) (see `feeds list`). Omit to search the whole personal space.",
    )
    .action(async (query: string, opts: { limit: string; cursor?: string; feed?: string }) => {
      const params: Record<string, unknown> = {
        q: query,
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      params.channel = parseFeedIdOption(opts.feed);
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
      const mentions = buildMentionMap(resp);
      const lines = items.map((m) => formatFeedLine(m, mentions));
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

  posts
    .command("list")
    .description(
      "List root posts (no replies) in your personal space. Filters the personal feed client-side; pagination cursor advances through the underlying feed page.",
    )
    .option("--limit <number>", "Items per page (applied to the underlying feed page)", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option(
      "--feed <feedId>",
      "Feed publicId (c…) to read instead of the main feed (see `feeds list`). Omit for the main feed.",
    )
    .option(
      "--all-feeds",
      "Read across the main feed AND every one of your feeds. Overrides --feed.",
    )
    .action(async (opts: { limit: string; cursor?: string; feed?: string; allFeeds?: boolean }) => {
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      if (opts.allFeeds) params.allChannels = true;
      else params.channelId = parseFeedIdOption(opts.feed);
      const resp = (await apiGet(`/posts/personal-space`, params)) as Record<string, unknown>;

      const allItems = ((resp.data || []) as Record<string, unknown>[]);
      const items = allItems.filter(
        (t) => t.type !== "post-reply" && t.parentPostPublicId == null,
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
      const mentions = buildMentionMap(resp);
      // The personal feed returns posts and replies as a flat list; group the
      // replies under their root post so they can be nested. Falls back to an
      // embedded `replies` array if the endpoint provides one.
      const repliesByRoot = new Map<unknown, Record<string, unknown>[]>();
      for (const it of allItems) {
        if (it.type === "post-reply" || it.parentPostPublicId != null) {
          const root = it.rootPostPublicId ?? it.parentPostPublicId;
          // A reply whose root didn't resolve can't nest under anything —
          // grouping it under null would only hide it behind an unmatchable key.
          if (root == null) continue;
          const arr = repliesByRoot.get(root) || [];
          arr.push(it);
          repliesByRoot.set(root, arr);
        }
      }
      const lines: string[] = [];
      for (const t of items) {
        lines.push(
          `- ${formatPostRef(t)} "${formatPostLabel(t, mentions)}" (${t.replyCount ?? 0} replies, ${t.createdAt})`,
        );
        for (const line of formatAttachmentLines(t, "    ", "📎")) {
          lines.push(line);
        }
        const replies =
          (t.replies as Record<string, unknown>[]) ||
          repliesByRoot.get(t.publicId) ||
          [];
        for (const r of replies) {
          lines.push(formatReplyLine(r, mentions));
        }
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
  // The shared `/posts/:id` and `/posts/:id/ancestors` routes — the server
  // gates these by `viewerUserId`, so private rows resolve for the owner and
  // 404 for everyone else. Personal-space and public posts share this
  // endpoint without ambiguity.

  posts
    .command("get <postId>")
    .description(
      "Get a personal-space post or reply with its ancestors and replies (paginated). <postId> is a publicId (p… / r…). Only the owner can resolve a private id.",
    )
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option("--full", "Show full reply content without truncation")
    .action(
      async (
        postId: string,
        opts: { limit: string; cursor?: string; full?: boolean },
      ) => {
        postId = parsePostIdentifier(postId);
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

        const mentionMap = buildMentionMap(postResp);
        const author = formatAuthorName(post);

        const ancestorLines: string[] = [];
        if (ancestors.length) {
          ancestors.forEach((a, i) => {
            ancestorLines.push(`  ${i + 1}. ${formatFeedLine(a, mentionMap)}`);
          });
        }

        const replyLines: string[] = [];
        for (const r of replies) {
          const rAuthor = formatAuthorName(r);
          const text = postBodyText(r, mentionMap);
          const truncated =
            opts.full || text.length <= 200 ? text : text.slice(0, 200) + "…";
          const rChips = formatReactionChips(r);
          const rAttach = formatAttachmentSummary(r);
          replyLines.push(
            `  - ${formatPostRef(r)} ${rAuthor}: ${truncated} (${r.createdAt})${rAttach ? `  ${rAttach}` : ""}${rChips ? `  ${rChips}` : ""}`,
          );
        }

        const isReplyPost = post.parentPostPublicId != null;
        const heading = isReplyPost
          ? `Reply ${formatPostRef(post)} (private)`
          : `Post ${formatPostRef(post)}: ${post.title || "(no title)"} (private)`;

        const postChips = formatReactionChips(post);
        const attachmentLines = formatAttachmentLines(post);
        const output = [
          heading,
          `By: ${author} on ${post.createdAt}`,
          ...(post.rationale ? [`Rationale: ${post.rationale}`] : []),
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
  //
  // Targets `POST /posts/personal-space`, the only endpoint that stamps
  // `personalSpaceUserId` on the row. Body shape is identical to the public
  // `POST /posts` create (same CreatePostDto). The server skips the
  // agent mention dispatch and the notification fan-out for this lane —
  // private posts have no audience.

  posts
    .command("create")
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
      "Attach an existing artifact to the post (repeatable). Create one with `gobi personal artifacts create`.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option(
      "--attach <file>",
      "Local media or document file to attach. Repeatable. Up to 8 attachments per post; photos, GIFs, videos and document files mix freely. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option(
      "--repost-post-id <postId>",
      "Wrap an existing top-level post as the embedded card on this new private post. Pass the post publicId (p… / r…) from feed output. The referenced post must be visible to you (your own personal-space post, a public post, or a post in a space you're a member of). Reposting someone else's personal-space post returns 404.",
    )
    .option(
      "--feed <feedId>",
      "One of your feeds (c…) to post into (see `feeds list`). Omit to post to your personal space's main feed.",
    )
    .option("--rationale <rationale>", RATIONALE_OPTION_HELP)
    .option("--no-link-previews", NO_LINK_PREVIEWS_OPTION_HELP)
    .action(async (opts: {
      title?: string;
      feed?: string;
      content?: string;
      richText?: string;
      artifact?: string[];
      attach?: string[];
      repostPostId?: string;
      rationale?: string;
      linkPreviews?: boolean;
    }) => {
      // A post is substantive if it has a text body OR carries an attachment
      // (artifact card / media) OR embeds a repost. Only block the truly empty
      // case — this is what lets an artifact-only post (e.g. an activity-end
      // meeting summary) be created with no content.
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
        body.repostPostId = parsePostIdentifier(
          opts.repostPostId,
          "--repost-post-id",
        );
      }
      const feedId = parseFeedIdOption(opts.feed);
      if (feedId != null) body.channelId = feedId;
      if (opts.rationale != null) body.rationale = readContent(opts.rationale);
      if (opts.linkPreviews === false) body.suppressLinkPreviews = true;
      const resp = (await apiPost(`/posts/personal-space`, body)) as Record<string, unknown>;
      const post = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(personal)) {
        jsonOut(post);
        return;
      }

      console.log(
        `Personal-space post created!\n` +
          `  ID: ${displayPostId(post)}\n` +
          (post.title ? `  Title: ${post.title}\n` : "") +
          `  Created: ${post.createdAt}\n` +
          `  Visibility: private (only you can see this)`,
      );
    });

  // ── Edit post ──
  //
  // The shared `PATCH /posts/:postId` route — the server gates on
  // `authorId === userId` and the read-path guard runs first, so a non-owner
  // can't edit (or even discover) a private post.

  posts
    .command("edit <postId>")
    .description(
      "Edit a post or reply you authored in your personal space. <postId> is a publicId (p… post / r… reply). A reply has no --title, --attach or --artifact.",
    )
    .option("--title <title>", "New title")
    .option("--content <content>", "New content (markdown supported, use \"-\" for stdin)")
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .option(
      "--attach <file>",
      "Replace the post's media attachments with the given files (existing attachments are removed). Repeatable. Up to 8 attachments per post; photos, GIFs, videos and document files mix freely. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files. Omit to leave attachments unchanged.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option(
      "--artifact <artifactId>",
      "Replace the post's artifact attachments with the given artifact(s) (existing artifact attachments are removed). Repeatable. Omit to leave them unchanged. Create one with `gobi personal artifacts create`.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option("--rationale <rationale>", `${RATIONALE_OPTION_HELP} Pass "" to clear it.`)
    .option("--no-link-previews", NO_LINK_PREVIEWS_OPTION_HELP)
    .action(async (
      postId: string,
      opts: {
        title?: string;
        content?: string;
        richText?: string;
        attach?: string[];
        artifact?: string[];
        rationale?: string;
        linkPreviews?: boolean;
      },
    ) => {
      postId = parsePostIdentifier(postId);
      const reply = isReplyId(postId);
      const wantsAttachChange = !!(opts.attach && opts.attach.length > 0);
      const wantsArtifactChange = !!(opts.artifact && opts.artifact.length > 0);
      if (reply && (opts.title != null || wantsAttachChange || wantsArtifactChange)) {
        throw new Error("A reply has no --title, --attach or --artifact.");
      }
      if (
        opts.title == null &&
        opts.content == null &&
        opts.richText == null &&
        !wantsAttachChange &&
        !wantsArtifactChange &&
        opts.rationale == null && opts.linkPreviews !== false
      ) {
        throw new Error(
          "Provide at least --title, --content, --rich-text, --attach, --artifact, --rationale, or --no-link-previews to update.",
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
      if (opts.attach && opts.attach.length > 0) {
        assertPostAttachmentMix(opts.attach);
        body.attachments = await uploadPostAttachments(opts.attach);
      }
      if (opts.artifact && opts.artifact.length > 0) body.artifactIds = opts.artifact;
      if (opts.rationale != null) body.rationale = readContent(opts.rationale);
      if (opts.linkPreviews === false) body.suppressLinkPreviews = true;
      const resp = (await apiPatch(
        reply ? `/posts/replies/${postId}` : `/posts/${postId}`,
        body,
      )) as Record<string, unknown>;
      const post = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(personal)) {
        jsonOut(post);
        return;
      }

      console.log(
        `${reply ? "Reply" : "Post"} edited!\n  ID: ${displayPostId(post)}\n  Edited: ${post.editedAt ?? post.updatedAt}`,
      );
    });

  // ── Delete post ──

  posts
    .command("delete <postId>")
    .description(
      "Delete a post or reply you authored in your personal space. <postId> is a publicId (p… post / r… reply).",
    )
    .action(async (postId: string) => {
      postId = parsePostIdentifier(postId);
      const reply = isReplyId(postId);
      await apiDelete(reply ? `/posts/replies/${postId}` : `/posts/${postId}`);

      if (isJsonMode(personal)) {
        jsonOut({ id: postId });
        return;
      }

      console.log(`${reply ? "Reply" : "Post"} ${postId} deleted.`);
    });

  posts
    .command("react <postId> <emoji>")
    .description(
      "Add an emoji reaction to a personal-space post or reply (idempotent). <postId> is a publicId (p… / r…).",
    )
    .action(async (postId: string, emoji: string) => {
      postId = parsePostIdentifier(postId);
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

  posts
    .command("unreact <postId> <emoji>")
    .description(
      "Remove your emoji reaction from a personal-space post or reply. <postId> is a publicId (p… / r…).",
    )
    .action(async (postId: string, emoji: string) => {
      postId = parsePostIdentifier(postId);
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

  // ── Reply ──
  //
  // `POST /posts/:postId/replies` inherits scope from the parent on the
  // server — reply to a personal-space parent → reply is scoped to that
  // personal space. The same server route backs space and personal replies;
  // we expose it here for discoverability under `gobi personal`.

  posts
    .command("reply <postId>")
    .description(
      "Reply to a personal-space post. The reply inherits the parent's private scope automatically. <postId> is a publicId (p…).",
    )
    .option("--content <content>", "Reply content (markdown supported, use \"-\" for stdin)")
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .option(
      "--attach <file>",
      "Local media or document file to attach to this reply. Repeatable. Up to 8 attachments per post; photos, GIFs, videos and document files mix freely. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option("--rationale <rationale>", RATIONALE_OPTION_HELP)
    .option("--no-link-previews", NO_LINK_PREVIEWS_OPTION_HELP)
    .action(async (postId: string, opts: { content?: string; richText?: string; attach?: string[]; rationale?: string; linkPreviews?: boolean }) => {
      postId = parsePostIdentifier(postId);
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
      if (opts.rationale != null) body.rationale = readContent(opts.rationale);
      if (opts.linkPreviews === false) body.suppressLinkPreviews = true;
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
        `Reply created!\n  ID: ${displayPostId(reply)}\n  Created: ${reply.createdAt}`,
      );
    });

  // ── Feeds (read-only; feed admin is web/app only) ──
  //
  // Your personal space's named feeds — `channel` rows on the wire, owned by
  // you alone, so there is no member roster. The main feed has no row.

  const feeds = personal
    .command("feeds")
    .description("Your personal space's named feeds, besides its main feed (read-only).");

  feeds
    .command("list")
    .description("List your feeds. The main feed is not listed — read it by omitting --feed.")
    .action(async () => {
      const resp = (await apiGet(`/me/channels`)) as Record<string, unknown>;
      const items = (resp.data || []) as Record<string, unknown>[];

      if (isJsonMode(personal)) {
        jsonOut(items);
        return;
      }
      if (!items.length) {
        console.log("No feeds found.");
        return;
      }
      const lines: string[] = [];
      for (const c of items) {
        lines.push(`- [${displayChannelId(c)}] #${c.name} (agent: ${c.agentAccess ? "on" : "off"})`);
        if (c.description) lines.push(`    Description: ${c.description}`);
      }
      console.log(`Feeds (${items.length}):\n` + lines.join("\n"));
    });

  feeds
    .command("get <feedId>")
    .description("Get one of your feeds. <feedId> is a publicId (c…).")
    .action(async (feedId: string) => {
      const id = parseChannelIdentifier(feedId, "<feedId>");
      const resp = (await apiGet(`/me/channels/${id}`)) as Record<string, unknown>;
      const c = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(personal)) {
        jsonOut(c);
        return;
      }
      const desc = c.description ? `\n  Description: ${c.description}` : "";
      console.log(
        `Feed [${displayChannelId(c)}] #${c.name}${desc}\n` +
          `  Agent access: ${c.agentAccess ? "on" : "off"}\n` +
          `  Created: ${c.createdAt}`,
      );
    });

  // ── Direct messages (personal core — your personal bots) ──
  //
  // The other party is one of the caller's personal bots. Omit --agent for
  // the oldest one. Optional --agent <botId> picks one. No --user.
  // Space members and space bots live under `gobi space dms`.

  const dms = personal
    .command("dms")
    .description("Your direct-message conversations with your personal bots.");

  dms
    .command("list")
    .description(
      "List your direct-message conversations in the personal core, most recent first. You can DM your personal bots here.",
    )
    .action(async () => {
      const resp = (await apiGet(`/personal/dms`)) as Record<string, unknown>;
      const items = (resp.data || []) as Record<string, unknown>[];

      if (isJsonMode(personal)) {
        jsonOut(items);
        return;
      }
      if (!items.length) {
        console.log("No conversations yet.");
        return;
      }

      const lines: string[] = [];
      for (const d of items) {
        const agent = d.agent as Record<string, unknown> | null;
        const people = (d.participants || []) as Record<string, unknown>[];
        const who = agent
          ? `${agent.name} (agent)`
          : people.map((p) => p.name).join(", ") || "(empty)";
        const unread = Number(d.unreadCount || 0);
        const flags = [unread > 0 ? `${unread} unread` : "read", `${d.notificationLevel}`].join(
          ", ",
        );
        lines.push(`- [${displayChannelId(d)}] ${who} (${flags})`);
      }
      console.log(`Conversations (${items.length}):\n` + lines.join("\n"));
    });

  dms
    .command("open")
    .description(
      "Open (or create) a conversation with a personal bot and print its id. Idempotent — safe to call before every send. Omit --agent for your oldest bot.",
    )
    .option(
      "--agent <botId>",
      "Personal bot to talk to. Omit for your oldest bot.",
    )
    .action(async (opts: { agent?: string }) => {
      const body: Record<string, unknown> = {};
      if (opts.agent != null) body.agent = opts.agent;
      const resp = (await apiPost(
        `/personal/dms`,
        Object.keys(body).length ? body : undefined,
      )) as Record<string, unknown>;
      const dm = (resp.data || {}) as Record<string, unknown>;

      if (isJsonMode(personal)) {
        jsonOut(dm);
        return;
      }
      console.log(`Conversation id: ${displayChannelId(dm)}`);
    });

  dms
    .command("send <dmId>")
    .description(
      "Send a message to a conversation (see `dms open` / `dms list`). <dmId> is a publicId (d…). Mentions need --rich-text: a bare @name in --content renders as plain text and notifies nobody.",
    )
    .option("--content <content>", 'Message text (markdown supported, use "-" for stdin)')
    .option(
      "--rich-text <richText>",
      'Rich-text JSON array, mutually exclusive with --content. Mix {"type":"text","text":"…"} with {"type":"user","userId":"u…"} to actually ping someone. Only use a publicId you read from a tool result — a guessed id tags an unrelated real person.',
    )
    .option(
      "--attach <file>",
      "Local media or document file to attach. Repeatable — same mix rules as `posts create`.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option("--rationale <rationale>", RATIONALE_OPTION_HELP)
    .option("--no-link-previews", NO_LINK_PREVIEWS_OPTION_HELP)
    .action(
      async (
        dmId: string,
        opts: { content?: string; richText?: string; attach?: string[]; rationale?: string; linkPreviews?: boolean },
      ) => {
        const channelId = parseDmIdentifier(dmId, "<dmId>");
        const hasAttachments = (opts.attach?.length ?? 0) > 0;
        if (!opts.content && !opts.richText && !hasAttachments) {
          throw new Error("Provide --content, --rich-text, or --attach.");
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
        if (hasAttachments) {
          assertPostAttachmentMix(opts.attach!);
          body.attachments = await uploadPostAttachments(opts.attach!);
        }
        if (opts.rationale != null) body.rationale = readContent(opts.rationale);
        if (opts.linkPreviews === false) body.suppressLinkPreviews = true;
        const resp = (await apiPost(
          `/personal/dms/${channelId}/messages`,
          body,
        )) as Record<string, unknown>;
        const post = (resp.data || {}) as Record<string, unknown>;

        if (isJsonMode(personal)) {
          jsonOut(post);
          return;
        }
        console.log(`Sent (message id ${displayPostId(post)}).`);
      },
    );

  dms
    .command("messages <dmId>")
    .description(
      "Read a conversation's transcript. Returned NEWEST-FIRST for paging. Read before writing — it is how you know what you have already said. <dmId> is a publicId (d…). A chat with a bot holds several sessions; without --session this reads the newest (see `dms sessions`).",
    )
    .option("--limit <limit>", "How many messages to fetch (default 30)")
    .option("--cursor <cursor>", "Page cursor from a previous call")
    .option("--session <sessionId>", "Read this session (a p… id from `dms sessions`) instead of the newest")
    .action(async (dmId: string, opts: { limit?: string; cursor?: string; session?: string }) => {
      const channelId = parseDmIdentifier(dmId, "<dmId>");
      const params: Record<string, string> = {};
      if (opts.limit != null) params.limit = opts.limit;
      if (opts.cursor != null) params.cursor = opts.cursor;
      if (opts.session != null) params.rootPostId = opts.session;
      const resp = (await apiGet(
        `/personal/dms/${channelId}/messages`,
        params,
      )) as Record<string, unknown>;

      if (isJsonMode(personal)) {
        jsonOut(resp);
        return;
      }
      const items = (resp.data || []) as Record<string, unknown>[];
      if (!items.length) {
        console.log("No messages yet.");
        return;
      }
      // A mention-carrying message stores its words in richText with an empty
      // `content`, so the body needs the same live resolution the feed uses.
      const mentions = buildMentionMap(resp);
      const lines: string[] = [];
      // Oldest-first for reading, though the wire ships newest-first for paging.
      for (const m of [...items].reverse()) {
        const author = (m.author || {}) as Record<string, unknown>;
        lines.push(`[${m.createdAt}] ${author.name ?? "?"}: ${postBodyText(m, mentions)}`);
      }
      console.log(lines.join("\n"));
    });

  dms
    .command("sessions <dmId>")
    .description(
      "List a conversation's sessions, newest first (id, started, last activity, preview). Pass an id to `dms messages --session` to read that session. <dmId> is a publicId (d…).",
    )
    .action(async (dmId: string) => {
      const channelId = parseDmIdentifier(dmId, "<dmId>");
      const resp = (await apiGet(`/personal/dms/${channelId}/sessions`)) as Record<string, unknown>;

      if (isJsonMode(personal)) {
        jsonOut(resp);
        return;
      }
      const items = (resp.data || []) as Record<string, unknown>[];
      if (!items.length) {
        console.log("No sessions yet.");
        return;
      }
      console.log(
        items
          .map((s) => `${s.publicId}  started ${s.createdAt}  last ${s.updatedAt}  ${s.preview ?? ""}`.trimEnd())
          .join("\n"),
      );
    });

  // ── Bots (thin list / add / remove — not a settings editor) ──

  const agents = personal
    .command("agents")
    .description("Your personal bots: list, add, remove.");

  agents
    .command("list")
    .description("List your personal bots (botId, name).")
    .action(async () => {
      const resp = (await apiGet(`/personal/agents`)) as Record<string, unknown>;
      const items = ((resp.data || []) as Record<string, unknown>[]).map((a) => ({
        botId: (a.botId as string) ?? "",
        name: (a.name as string) ?? null,
      }));

      if (isJsonMode(personal)) {
        jsonOut(items);
        return;
      }
      if (!items.length) {
        console.log("No bots yet.");
        return;
      }
      const lines = items.map((a) => `- [${a.botId}] ${a.name ?? ""}`.trimEnd());
      console.log(`Bots (${items.length}):\n` + lines.join("\n"));
    });

  agents
    .command("add")
    .description("Add a personal bot.")
    .option("--id <botId>", "Bot id (lowercase slug). Omit to auto-generate.")
    .option("--name <name>", "Display name.")
    .action(async (opts: { id?: string; name?: string }) => {
      const body: Record<string, unknown> = {};
      if (opts.id != null) body.botId = opts.id;
      if (opts.name != null) body.name = opts.name;
      const resp = (await apiPost(`/personal/agents`, body)) as Record<string, unknown>;
      const agent = unwrapResp(resp) as Record<string, unknown>;
      const botId = (agent.botId as string) || opts.id || "";
      const name = (agent.name as string) ?? opts.name ?? null;

      if (isJsonMode(personal)) {
        jsonOut({ botId, name });
        return;
      }
      console.log(
        `Bot added!\n  ID: ${botId}` + (name ? `\n  Name: ${name}` : ""),
      );
    });

  agents
    .command("remove <botId>")
    .description("Remove a personal bot.")
    .action(async (botId: string) => {
      await apiDelete(`/personal/agents/${encodeURIComponent(botId)}`);

      if (isJsonMode(personal)) {
        jsonOut({ botId });
        return;
      }
      console.log(`Bot ${botId} removed.`);
    });

  // ── Artifacts (your personal core) ──

  registerArtifactSubcommands(
    personal,
    { resolve: () => ({}) },
    "Artifacts are for SHARING outside a lane: a versioned document or media " +
      "item made for an audience — posted to a space or the feed, emailed, or " +
      "opened from a link. (Notes and activities are records that stay in their " +
      "lane; a note is shared by making it an artifact.) Kinds: image | video | " +
      "gif | markdown | note | html. Always human-owned; revisions form a history " +
      "tree whose newest node is what the artifact reads as. Attach one to a post " +
      "with `gobi space posts create --artifact <artifactId>`. A space's own " +
      "artifacts are under `gobi space artifacts`.",
  );

  // ── Compact snapshot for assistant agents (personal lane only) ──

  registerContextCommand(personal);

  // ── Records: notes + activities (your personal space) ──

  const activityScope: ActivityScope = {
    label: "personal",
    listActivities: (params) => listPersonalActivities(params),
  };

  const noteScope: NoteScope = {
    label: "personal",
    // `/app/conversations` is the personal space's notes only (space_id 0),
    // newest first, with the same `limit` / `before` keyset paging as a
    // space's list. A space's notes are listed under `gobi space notes`.
    listNotes: ({ limit, before }) => listPersonalNotes({ limit, before }),
  };

  registerActivitiesSubcommands(
    personal,
    activityScope,
    "Your personal space's activities: what you were doing over a stretch of " +
      "time (traveling, working, talking…), detected by Sense. Like notes, they " +
      "are records that belong to their lane — your personal space here, a space " +
      "under `gobi space activities` — and are never shared directly.",
  );

  registerNotesSubcommands(
    personal,
    noteScope,
    "Your personal space's notes. A note is a record of one captured moment, " +
      "made from an audio log (phone, watch or desktop), a video log, a meeting, " +
      "an imported recording, a conversation Sense detected, or text you wrote; " +
      "each has a title, a summary and, when there was speech, a transcript. " +
      "Notes and activities are records that belong to their lane — your personal " +
      "space here, a space under `gobi space notes` — and are never shared " +
      "directly: to share one outside its lane, make it an artifact.",
  );
}
