import { Command } from "commander";
import { WEB_BASE_URL } from "../constants.js";
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "../client.js";
import {
  requireSpace,
  selectSpace,
  setSpaceRequirement,
  writeSpaceSetting,
} from "./init.js";
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
  resolveSpaceSlug,
  unwrapResp,
} from "./utils.js";
import {
  uploadPostAttachments,
  assertPostAttachmentMix,
} from "../attachments.js";
import { registerArtifactSubcommands } from "./artifact.js";
import {
  registerActivitiesSubcommands,
  registerConversationsSubcommands,
  SenseScope,
} from "./sense.js";

function readContent(value: string): string {
  if (value === "-") return readStdin();
  return value;
}

// Channel lane chip for feed/list output: "#channelName" when a post lives in a
// channel, "" for main-feed rows (channel null/absent). The backend attaches a
// `channel: {id, name, isPublic}` object to each post/reply.
function channelChip(m: Record<string, unknown>): string {
  const ch = m.channel as Record<string, unknown> | null | undefined;
  const name = ch?.name as string | undefined;
  return name ? `#${name}` : "";
}

function formatFeedLine(
  m: Record<string, unknown>,
  mentions?: MentionMap,
): string {
  const isReply = m.parentPostId != null;
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
  const chan = channelChip(m);
  return (
    `${id} ${kind} ${author}  "${label}"  ${m.createdAt}` +
    (chan ? `  ${chan}` : "") +
    (attachSummary ? `  ${attachSummary}` : "") +
    (chips ? `  ${chips}` : "")
  );
}

function parseChannelIdOption(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("--channel must be a positive integer channel id.");
  }
  return n;
}

export function registerSpaceCommand(program: Command): void {
  const space = program
    .command("space")
    .description(
      "Space commands (posts, replies). Space and member admin is web-UI only.",
    )
    .option(
      "--space-slug <spaceSlug>",
      "Space slug (overrides .gobi/settings.yaml)",
    );
  // Default: every space subcommand needs a configured space (or --space-slug).
  // `list`, `warp`, and `get` opt out below.
  requireSpace(space);

  // ── List spaces ──

  const listCmd = space
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
        lines.push(`- [${s.slug}] ${s.name}`);
        if (s.description) lines.push(`    Description: ${s.description}`);
        if (s.rules) lines.push(`    Rules: ${s.rules}`);
      }
      console.log(`Spaces (${items.length}):\n` + lines.join("\n"));
    });
  setSpaceRequirement(listCmd, false);

  // ── Get space ──

  const getCmd = space
    .command("get [spaceSlug]")
    .description(
      "Get details for a space. Pass a slug or omit to use the current space (from .gobi/settings.yaml or --space-slug).",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (spaceSlug: string | undefined, opts: { spaceSlug?: string }) => {
      const slug = spaceSlug || resolveSpaceSlug(space, opts);
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
  // `get [spaceSlug]` accepts a positional arg; treat as not requiring space
  // config so the no-arg case falls through to the action's own error.
  setSpaceRequirement(getCmd, false);

  // ── Warp (space selection) ──

  const warpCmd = space
    .command("warp [spaceSlug]")
    .description("Select the active space. Pass a slug to warp directly, or omit for interactive selection.")
    .action(async (spaceSlug?: string) => {
      if (spaceSlug) {
        writeSpaceSetting(spaceSlug);

        if (isJsonMode(space)) {
          jsonOut({ spaceSlug, spaceName: null });
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
  setSpaceRequirement(warpCmd, false);

  // ── Topics ──

  space
    .command("list-topics")
    .description("List topics in a space, ordered by most recent content linkage.")
    .option("--limit <number>", "Items per page", "20")
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (opts: { limit: string; spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
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
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (topicSlug: string, opts: { limit: string; cursor?: string; spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
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

      const mentions = buildMentionMap(resp);
      const lines: string[] = [];
      for (const t of posts) {
        const author =
          ((t.author as Record<string, unknown>)?.name as string) || "Unknown";
        const spaceName =
          ((t.space as Record<string, unknown>)?.name as string) || "";
        lines.push(
          `- [${t.id}] "${formatPostLabel(t, mentions)}" by ${author} in ${spaceName} (${t.replyCount} replies, ${t.createdAt})`,
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
    .option(
      "--channel <channelId>",
      "Channel id to read instead of the main feed (see `list-channels`). Omit for the main feed.",
    )
    .option(
      "--all-channels",
      "Read across the main feed AND every channel visible to you (all public channels + any you belong to). Overrides --channel.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (opts: { limit: string; cursor?: string; channel?: string; allChannels?: boolean; spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      // all-channels (main + every visible channel) wins over a single --channel lane.
      if (opts.allChannels) params.allChannels = true;
      else params.channelId = parseChannelIdOption(opts.channel);
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
      const mentions = buildMentionMap(resp);
      const lines = items.map((m) => formatFeedLine(m, mentions));
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Feed (${items.length} items, newest first):\n` + lines.join("\n") + footer,
      );
    });

  // ── Search ──

  space
    .command("search-posts <query>")
    .description(
      "Search a space's posts and replies (newest first). The query supports keywords " +
        'plus from:<name> and topic:<tag> operators (quote multi-word values, e.g. from:"Jane Doe"). ' +
        "Each result is an individual post or reply, not a whole thread.",
    )
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option(
      "--channel <channelId>",
      "Restrict results to one channel (see `list-channels`). Omit to search the main feed and all channels visible to you.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (query: string, opts: { limit: string; cursor?: string; channel?: string; spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const params: Record<string, unknown> = {
        q: query,
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      params.channelId = parseChannelIdOption(opts.channel);
      const resp = (await apiGet(`/spaces/${spaceSlug}/search`, params)) as Record<string, unknown>;

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

  // ── Posts (get, list, create, edit, delete) ──

  space
    .command("get-post <postId>")
    .description("Get a post with its ancestors and replies (paginated).")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option("--full", "Show full reply content without truncation")
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(
      async (postId: string, opts: { limit: string; cursor?: string; full?: boolean; spaceSlug?: string }) => {
        const spaceSlug = resolveSpaceSlug(space, opts);
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

        const post = (data.post || data.thread || data) as Record<string, unknown>;
        const replies = ((data.items as unknown[]) || []) as Record<
          string,
          unknown
        >[];

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
          const body =
            opts.full || !text || text.length <= 200
              ? text
              : text.slice(0, 200) + "…";
          const rChips = formatReactionChips(r);
          const rAttach = formatAttachmentSummary(r);
          replyLines.push(
            `  - [r:${r.id}] ${rAuthor}: ${body} (${r.createdAt})${rAttach ? `  ${rAttach}` : ""}${rChips ? `  ${rChips}` : ""}`,
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
    .option(
      "--channel <channelId>",
      "Channel id to read instead of the main feed (see `list-channels`). Omit for the main feed.",
    )
    .option(
      "--all-channels",
      "Read across the main feed AND every channel visible to you (all public channels + any you belong to). Overrides --channel.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (opts: { limit: string; cursor?: string; channel?: string; allChannels?: boolean; spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      // all-channels (main + every visible channel) wins over a single --channel lane.
      if (opts.allChannels) params.allChannels = true;
      else params.channelId = parseChannelIdOption(opts.channel);
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
      const mentions = buildMentionMap(resp);
      const lines: string[] = [];
      for (const t of items) {
        const author =
          ((t.author as Record<string, unknown>)?.name as string) ||
          `User ${t.authorId}`;
        const chan = channelChip(t);
        lines.push(
          `- [${t.id}] "${formatPostLabel(t, mentions)}" by ${author} (${t.replyCount} replies, ${t.createdAt})${chan ? `  ${chan}` : ""}`,
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

  space
    .command("create-post")
    .description("Create a post in a space.")
    .option("--title <title>", "Title of the post")
    .option(
      "--content <content>",
      "Post content (markdown supported, use \"-\" for stdin)",
    )
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .option(
      "--artifact <artifactId>",
      "Attach an existing artifact to the post (repeatable). Create artifacts with `gobi space artifact create`.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
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
    .option(
      "--channel <channelId>",
      "Channel id to post into (see `list-channels`). Omit to post to the space's main feed. You must be able to see the channel (member, space owner/admin, or the space agent on an agent-enabled channel).",
    )
    .action(
      async (opts: {
        title?: string;
        content?: string;
        richText?: string;
        artifact?: string[];
        spaceSlug?: string;
        attach?: string[];
        repostPostId?: string;
        channel?: string;
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
          const n = Number(opts.repostPostId);
          if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
            throw new Error("--repost-post-id must be a positive integer.");
          }
          body.repostPostId = n;
        }
        const channelId = parseChannelIdOption(opts.channel);
        if (channelId != null) body.channelId = channelId;
        const spaceSlug = resolveSpaceSlug(space, opts);
        const resp = (await apiPost(`/spaces/${spaceSlug}/posts`, body)) as Record<string, unknown>;
        const post = unwrapResp(resp) as Record<string, unknown>;

        const shareUrl = `${WEB_BASE_URL}/spaces/${spaceSlug}/posts/${post.id}`;

        if (isJsonMode(space)) {
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
      },
    );

  space
    .command("edit-post <postId>")
    .description("Edit a post you authored in a space.")
    .option("--title <title>", "New title for the post")
    .option(
      "--content <content>",
      "New content for the post (markdown supported, use \"-\" for stdin)",
    )
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .option(
      "--attach <file>",
      "Replace the post's media attachments with the given files (existing attachments are removed). Repeatable. Mix rule: up to 4 photos + up to 4 document files (pdf/md/txt/csv) OR 1 GIF OR 1 video. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files. Omit to leave attachments unchanged.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option(
      "--artifact <artifactId>",
      "Replace the post's artifact attachments with the given artifact(s) (existing artifact attachments are removed). Repeatable. Omit to leave them unchanged. Create artifacts with `gobi space artifact create`.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .action(
      async (
        postId: string,
        opts: { title?: string; content?: string; richText?: string; spaceSlug?: string; attach?: string[]; artifact?: string[] },
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
          throw new Error(
            "Provide at least --title, --content, --rich-text, --attach, or --artifact to update.",
          );
        }
        if (opts.content && opts.richText) {
          throw new Error("--content and --rich-text are mutually exclusive.");
        }
        const spaceSlug = resolveSpaceSlug(space, opts);
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
            (post.title ? `  Title: ${post.title}\n` : "") +
            `  Edited: ${post.editedAt}`,
        );
      },
    );

  space
    .command("delete-post <postId>")
    .description("Delete a post you authored in a space.")
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (postId: string, opts: { spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
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
    .option(
      "--content <content>",
      "Reply content (markdown supported, use \"-\" for stdin)",
    )
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .option(
      "--attach <file>",
      "Local media or document file to attach to this reply. Repeatable. Mix rule: up to 4 photos + up to 4 document files (pdf/md/txt/csv) OR 1 GIF OR 1 video. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .action(async (postId: string, opts: { content?: string; richText?: string; spaceSlug?: string; attach?: string[] }) => {
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
      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiPost(
        `/spaces/${spaceSlug}/posts/${postId}/replies`,
        body,
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
    .description("Edit a reply you authored in a space.")
    .option(
      "--content <content>",
      "New content for the reply (markdown supported, use \"-\" for stdin)",
    )
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (replyId: string, opts: { content?: string; richText?: string; spaceSlug?: string }) => {
      if (opts.content == null && opts.richText == null) {
        throw new Error(
          "Provide at least --content or --rich-text to update.",
        );
      }
      if (opts.content && opts.richText) {
        throw new Error("--content and --rich-text are mutually exclusive.");
      }
      const spaceSlug = resolveSpaceSlug(space, opts);
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
      const resp = (await apiPatch(
        `/spaces/${spaceSlug}/replies/${replyId}`,
        body,
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
    .description("Delete a reply you authored in a space.")
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (replyId: string, opts: { spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      await apiDelete(`/spaces/${spaceSlug}/replies/${replyId}`);

      if (isJsonMode(space)) {
        jsonOut({ id: replyId });
        return;
      }

      console.log(`Reply ${replyId} deleted.`);
    });

  // ── Reactions (react, unreact) ──

  space
    .command("react <postId> <emoji>")
    .description(
      "Add an emoji reaction to a post or reply (idempotent). <postId> is the numeric id of a post OR a reply — the [p:N]/[r:N] ids shown in feed output.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (postId: string, emoji: string, opts: { spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiPut(
        `/spaces/${spaceSlug}/posts/${postId}/reactions`,
        { emoji },
      )) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut(data);
        return;
      }

      const chips = formatReactionChips(data);
      console.log(
        `Reacted ${emoji} to ${postId}.` + (chips ? `\n  Now: ${chips}` : ""),
      );
    });

  space
    .command("unreact <postId> <emoji>")
    .description(
      "Remove your emoji reaction from a post or reply. <postId> is the numeric id of a post OR a reply.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (postId: string, emoji: string, opts: { spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiDelete(
        `/spaces/${spaceSlug}/posts/${postId}/reactions/${encodeURIComponent(emoji)}`,
      )) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut(data);
        return;
      }

      const chips = formatReactionChips(data);
      console.log(
        `Removed ${emoji} reaction from ${postId}.` +
          (chips ? `\n  Now: ${chips}` : ""),
      );
    });

  // ── Channels (read-only; channel admin is web-UI only) ──
  //
  // Private member-gated sub-feeds inside a space. The main feed is virtual
  // (no channel row): feed/list-posts/create-post without --channel target
  // it. Members see their channels; space owners/admins see all; the space
  // agent sees agent-enabled channels only. Create/rename/delete and roster
  // management are deliberately not exposed here — like space and member
  // admin, that's web-UI territory.

  space
    .command("list-channels")
    .description(
      "List channels visible to you in a space (members: yours; space owner/admin: all). The main feed is not a channel — read it by omitting --channel on `feed`.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (opts: { spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiGet(`/spaces/${spaceSlug}/channels`)) as Record<string, unknown>;
      const items = (resp.data || []) as Record<string, unknown>[];

      if (isJsonMode(space)) {
        jsonOut(items);
        return;
      }

      if (!items.length) {
        console.log("No channels found.");
        return;
      }

      const lines: string[] = [];
      for (const c of items) {
        const flags = [
          `${c.memberCount} member${c.memberCount === 1 ? "" : "s"}`,
          c.isMember ? "member: you" : "member: no",
          c.agentAccess ? "agent: on" : "agent: off",
        ].join(", ");
        lines.push(`- [${c.id}] #${c.name} (${flags})`);
        if (c.description) lines.push(`    Description: ${c.description}`);
      }
      console.log(`Channels (${items.length}):\n` + lines.join("\n"));
    });

  space
    .command("get-channel <channelId>")
    .description("Get one channel (channel members, space owner/admin, or the agent on agent-enabled channels).")
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (channelId: string, opts: { spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiGet(`/spaces/${spaceSlug}/channels/${channelId}`)) as Record<string, unknown>;
      const c = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut(c);
        return;
      }

      const desc = c.description ? `\n  Description: ${c.description}` : "";
      console.log(
        `Channel [${c.id}] #${c.name}${desc}\n` +
          `  Agent access: ${c.agentAccess ? "on" : "off"}\n` +
          `  Created: ${c.createdAt}`,
      );
    });

  space
    .command("list-channel-members <channelId>")
    .description("List the members of a channel.")
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (channelId: string, opts: { spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiGet(
        `/spaces/${spaceSlug}/channels/${channelId}/members`,
      )) as Record<string, unknown>;
      const items = (resp.data || []) as Record<string, unknown>[];

      if (isJsonMode(space)) {
        jsonOut(items);
        return;
      }

      if (!items.length) {
        console.log("No members found.");
        return;
      }

      const lines: string[] = [];
      for (const m of items) {
        const user = (m.user || {}) as Record<string, unknown>;
        lines.push(
          `- [${m.userId}] ${user.name || "Unknown"} (joined ${m.createdAt})`,
        );
      }
      console.log(`Channel members (${items.length}):\n` + lines.join("\n"));
    });

  // ── Artifacts (scoped to this space) ──

  registerArtifactSubcommands(
    space,
    { resolve: () => ({ spaceSlug: resolveSpaceSlug(space) }) },
    "Versioned creations attached to posts, scoped to this space (visible to its " +
      "members). Kinds: image | video | gif | markdown | note. Always " +
      "human-owned; revisions form a draft/published tree (one published per artifact).",
  );

  // ── Sense: activities + conversations (scoped to this space) ──
  //
  // The conversations list endpoint spans all the user's scopes (returns the caller's recent
  // conversations across all scopes, each tagged with spaceId), so the scope
  // resolves this space's numeric id — via GET /spaces/:slug — to filter it.
  const senseScope: SenseScope = {
    label: "space",
    listActivities: async (params) => {
      const q: Record<string, unknown> = { limit: params.limit, before: params.before };
      if (params.mine) q.mine = true;
      const resp = (await apiGet(
        `/spaces/${resolveSpaceSlug(space)}/activities`,
        q,
      )) as Record<string, unknown>;
      return {
        items: ((resp.activities as unknown[]) || []) as Record<string, unknown>[],
        pagination: resp.pagination as { hasMore?: boolean; nextCursor?: string } | undefined,
      };
    },
    listConversations: async (params) => {
      const q: Record<string, unknown> = { limit: params.limit, before: params.before };
      if (params.mine) q.mine = true;
      const resp = (await apiGet(
        `/spaces/${resolveSpaceSlug(space)}/conversations`,
        q,
      )) as Record<string, unknown>;
      return {
        items: ((resp.conversations as unknown[]) || []) as Record<string, unknown>[],
        pagination: resp.pagination as { hasMore?: boolean; nextCursor?: string } | undefined,
      };
    },
  };

  registerActivitiesSubcommands(
    space,
    senseScope,
    "This space's Sense activities — every member's, attributed to each recorder " +
      "(browse-only). Use `gobi space --space-slug <slug> activities …` or set the " +
      "active space with `gobi space warp`.",
  );

  registerConversationsSubcommands(
    space,
    senseScope,
    "This space's Sense conversations — every member's, attributed to each recorder " +
      "(browse-only; transcript/audio stay owner-only). Use `gobi space --space-slug " +
      "<slug> conversations …` or set the active space with `gobi space warp`.",
  );
}
