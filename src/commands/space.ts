import { Command } from "commander";
import { WEB_BASE_URL } from "../constants.js";
import {
  registerActivitiesSubcommands,
  registerNotesSubcommands,
  ActivityScope,
  NoteScope,
} from "./capture.js";
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "../client.js";
import {
  requireSpace,
  selectSpace,
  setSpaceRequirement,
  writeSpaceSetting,
} from "./init.js";
import {
  buildMentionMap,
  feedChip,
  isReplyId,
  formatAttachmentLines,
  formatAttachmentSummary,
  displayChannelId,
  displayPostId,
  displayUserId,
  formatAuthorName,
  formatPostLabel,
  formatPostRef,
  formatReactionChips,
  formatReplyLine,
  parseChannelIdentifier,
  parseDmIdentifier,
  parsePostIdentifier,
  parseUserIdentifier,
  isJsonMode,
  jsonOut,
  MentionMap,
  postBodyText,
  readStdin,
  NO_LINK_PREVIEWS_OPTION_HELP,
  RATIONALE_OPTION_HELP,
  resolveSpaceSlug,
  unwrapResp,
} from "./utils.js";
import { registerArtifactSubcommands } from "./artifact.js";
import {
  uploadPostAttachments,
  assertPostAttachmentMix,
} from "../attachments.js";

function readContent(value: string): string {
  if (value === "-") return readStdin();
  return value;
}

function formatFeedLine(
  m: Record<string, unknown>,
  mentions?: MentionMap,
): string {
  const isReply = m.parentPostPublicId != null;
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

function parseFeedIdOption(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  return parseChannelIdentifier(value, "--feed");
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
      const resp = (await apiGet(`/spaces/${encodeURIComponent(slug)}`)) as Record<string, unknown>;
      const s = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut(s);
        return;
      }

      console.log(
        `Space [${s.slug}] ${s.name}\n` +
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

  // ── Create / join (onboarding) ──
  //
  // These two are the ONBOARDING actions — creating your own space, or joining
  // an open one by slug. Ongoing member/settings admin stays web-only; these
  // are just what a new user (or an agent onboarding one) needs to get a space
  // to work in. Neither needs a current space, so both are marked accordingly.
  const createCmd = space
    .command("create")
    .description("Create a new space and become its owner.")
    .requiredOption("--name <name>", "Display name (e.g. \"AI Researchers\")")
    .requiredOption("--slug <slug>", "URL-friendly slug: lowercase letters, digits, hyphens")
    .action(async (opts: { name: string; slug: string }) => {
      if (!/^[a-z0-9-]+$/.test(opts.slug)) {
        console.error("--slug must contain only lowercase letters, digits, and hyphens.");
        process.exitCode = 1;
        return;
      }
      const body: Record<string, unknown> = { name: opts.name, slug: opts.slug };
      const resp = (await apiPost("/spaces", body)) as Record<string, unknown>;
      const data = (resp.data ?? resp) as Record<string, unknown>;
      const slug = (data.slug as string) ?? opts.slug;
      // Land the user in the space they just made, so the next command works.
      writeSpaceSetting(slug);
      if (isJsonMode(space)) {
        jsonOut(data);
        return;
      }
      console.log(`Created space "${data.name ?? opts.name}" (${slug}) — you are the owner.`);
      console.log(`Warped to it. Post with: gobi space posts create --content "…"`);
    });
  setSpaceRequirement(createCmd, false);

  const joinCmd = space
    .command("join <spaceSlug>")
    .description(
      "Join an OPEN space by slug. Invite-only spaces need an invite link (open it on the web).",
    )
    .action(async (spaceSlug: string) => {
      try {
        await apiPost(`/spaces/${encodeURIComponent(spaceSlug)}/join`, {});
      } catch (err: unknown) {
        // The backend 403s a non-open space; translate to an actionable hint.
        const status = (err as { status?: number })?.status;
        if (status === 403) {
          console.error(
            `"${spaceSlug}" is invite-only — ask an admin for its invite link and open it on the web to join.`,
          );
          process.exitCode = 1;
          return;
        }
        throw err;
      }
      writeSpaceSetting(spaceSlug);
      if (isJsonMode(space)) {
        jsonOut({ joined: true, spaceSlug });
        return;
      }
      console.log(`Joined "${spaceSlug}" and warped to it.`);
    });
  setSpaceRequirement(joinCmd, false);

  // ── Posts and replies ──
  //
  // A reply is a post with a parent: `get` / `edit` / `delete` / `react` take
  // either id (p… / r…), and `reply` writes one.

  const posts = space
    .command("posts")
    .description("Posts and replies in a space's feeds. Every command that takes an id accepts a post (p…) or a reply (r…).");

  posts
    .command("recent")
    .description("List posts and replies together, newest first — the space's feed as it reads in the app.")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option(
      "--feed <feedId>",
      "Feed publicId (c…) to read instead of the main feed (see `feeds list`). Omit for the main feed.",
    )
    .option(
      "--all-feeds",
      "Read across the main feed AND every feed visible to you (all public feeds + any you belong to). Overrides --feed.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (opts: { limit: string; cursor?: string; feed?: string; allFeeds?: boolean; spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      if (opts.allFeeds) params.allChannels = true;
      else params.channelId = parseFeedIdOption(opts.feed);
      const resp = (await apiGet(`/spaces/${encodeURIComponent(spaceSlug)}/feed`, params)) as Record<string, unknown>;

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


  posts
    .command("search <query>")
    .description(
      "Search a space's posts and replies (newest first). The query supports keywords " +
        'plus a from:<name> operator (quote multi-word values, e.g. from:"Jane Doe"). ' +
        "Each result is an individual post or reply, not a whole thread.",
    )
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option(
      "--feed <feedId>",
      "Restrict results to one feed publicId (c…) (see `feeds list`). Omit to search the main feed and all feeds visible to you.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (query: string, opts: { limit: string; cursor?: string; feed?: string; spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const params: Record<string, unknown> = {
        q: query,
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      params.channelId = parseFeedIdOption(opts.feed);
      const resp = (await apiGet(`/spaces/${encodeURIComponent(spaceSlug)}/search`, params)) as Record<string, unknown>;

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

  posts
    .command("get <postId>")
    .description(
      "Get a post or reply with its ancestors and replies (paginated). <postId> is a publicId (p… / r…).",
    )
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option("--full", "Show full reply content without truncation")
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(
      async (postId: string, opts: { limit: string; cursor?: string; full?: boolean; spaceSlug?: string }) => {
        postId = parsePostIdentifier(postId);
        const spaceSlug = resolveSpaceSlug(space, opts);
        const params: Record<string, unknown> = {
          limit: parseInt(opts.limit, 10),
        };
        if (opts.cursor) params.cursor = opts.cursor;
        const [postResp, ancestorsResp] = await Promise.all([
          apiGet(`/spaces/${encodeURIComponent(spaceSlug)}/posts/${postId}`, params) as Promise<Record<string, unknown>>,
          apiGet(`/spaces/${encodeURIComponent(spaceSlug)}/posts/${postId}/ancestors`) as Promise<Record<string, unknown>>,
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
          const body =
            opts.full || !text || text.length <= 200
              ? text
              : text.slice(0, 200) + "…";
          const rChips = formatReactionChips(r);
          const rAttach = formatAttachmentSummary(r);
          replyLines.push(
            `  - ${formatPostRef(r)} ${rAuthor}: ${body} (${r.createdAt})${rAttach ? `  ${rAttach}` : ""}${rChips ? `  ${rChips}` : ""}`,
          );
        }

        const isReplyPost = post.parentPostPublicId != null;
        const heading = isReplyPost
          ? `Reply ${formatPostRef(post)}`
          : `Post ${formatPostRef(post)}: ${post.title || "(no title)"}`;

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
          ...(pagination.hasMore ? [`  Next cursor: ${pagination.nextCursor}`] : []),
        ].join("\n");
        console.log(output);
      },
    );

  posts
    .command("list")
    .description("List posts in a space (paginated).")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option(
      "--feed <feedId>",
      "Feed publicId (c…) to read instead of the main feed (see `feeds list`). Omit for the main feed.",
    )
    .option(
      "--all-feeds",
      "Read across the main feed AND every feed visible to you (all public feeds + any you belong to). Overrides --feed.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (opts: { limit: string; cursor?: string; feed?: string; allFeeds?: boolean; spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      if (opts.allFeeds) params.allChannels = true;
      else params.channelId = parseFeedIdOption(opts.feed);
      const resp = (await apiGet(`/spaces/${encodeURIComponent(spaceSlug)}/posts`, params)) as Record<string, unknown>;

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
        const author = formatAuthorName(t);
        const chan = feedChip(t);
        lines.push(
          `- ${formatPostRef(t)} "${formatPostLabel(t, mentions)}" by ${author} (${t.replyCount} replies, ${t.createdAt})${chan ? `  ${chan}` : ""}`,
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

  posts
    .command("create")
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
      "Attach an existing artifact to the post (repeatable). Create one with `gobi space artifacts create` (or `gobi personal artifacts create`).",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .option(
      "--attach <file>",
      "Local media or document file to attach. Repeatable. Up to 8 attachments per post; photos, GIFs, videos and document files mix freely. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option(
      "--repost-post-id <postId>",
      "Wrap an existing top-level post as the embedded card on this new post. Pass the post publicId (p… / r…) from feed output. Composes with --content / --rich-text / --attach (the wrapping author's text + media render above the embedded card). Reposts-of-reposts are collapsed to the transitive root server-side. The referenced post must exist, not be deleted, and not itself be a reply.",
    )
    .option(
      "--feed <feedId>",
      "Feed publicId (c…) to post into (see `feeds list`). Omit to post to the space's main feed. You must be able to see the feed (member, space owner/admin, or the space agent on an agent-enabled feed).",
    )
    .option("--rationale <rationale>", RATIONALE_OPTION_HELP)
    .option("--no-link-previews", NO_LINK_PREVIEWS_OPTION_HELP)
    .action(
      async (opts: {
        title?: string;
        content?: string;
        richText?: string;
        artifact?: string[];
        spaceSlug?: string;
        attach?: string[];
        repostPostId?: string;
        feed?: string;
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
        const spaceSlug = resolveSpaceSlug(space, opts);
        const resp = (await apiPost(`/spaces/${encodeURIComponent(spaceSlug)}/posts`, body)) as Record<string, unknown>;
        const post = unwrapResp(resp) as Record<string, unknown>;

        const shareUrl = `${WEB_BASE_URL}/spaces/${encodeURIComponent(spaceSlug)}/posts/${displayPostId(post)}`;

        if (isJsonMode(space)) {
          jsonOut({ ...post, shareUrl });
          return;
        }

        console.log(
          `Post created!\n` +
            `  ID: ${displayPostId(post)}\n` +
            (post.title ? `  Title: ${post.title}\n` : "") +
            `  Created: ${post.createdAt}\n` +
            `  URL: ${shareUrl}`,
        );
      },
    );

  posts
    .command("edit <postId>")
    .description(
      "Edit a post or reply you authored in a space. <postId> is a publicId (p… post / r… reply). A reply has no --title, --attach or --artifact.",
    )
    .option("--title <title>", "New title for the post")
    .option(
      "--content <content>",
      "New content (markdown supported, use \"-\" for stdin)",
    )
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (mutually exclusive with --content)",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .option(
      "--attach <file>",
      "Replace the post's media attachments with the given files (existing attachments are removed). Repeatable. Up to 8 attachments per post; photos, GIFs, videos and document files mix freely. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files. Omit to leave attachments unchanged.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option(
      "--artifact <artifactId>",
      "Replace the post's artifact attachments with the given artifact(s) (existing artifact attachments are removed). Repeatable. Omit to leave them unchanged. Create one with `gobi space artifacts create` (or `gobi personal artifacts create`).",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option("--rationale <rationale>", `${RATIONALE_OPTION_HELP} Pass "" to clear it.`)
    .option("--no-link-previews", NO_LINK_PREVIEWS_OPTION_HELP)
    .action(
      async (
        postId: string,
        opts: {
          title?: string;
          content?: string;
          richText?: string;
          spaceSlug?: string;
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
        if (wantsAttachChange) {
          assertPostAttachmentMix(opts.attach!);
          body.attachments = await uploadPostAttachments(opts.attach!);
        }
        if (wantsArtifactChange) body.artifactIds = opts.artifact;
        if (opts.rationale != null) body.rationale = readContent(opts.rationale);
        if (opts.linkPreviews === false) body.suppressLinkPreviews = true;
        const resp = (await apiPatch(
          `/spaces/${encodeURIComponent(spaceSlug)}/${reply ? "replies" : "posts"}/${postId}`,
          body,
        )) as Record<string, unknown>;
        const post = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(space)) {
          jsonOut(post);
          return;
        }

        console.log(
          `${reply ? "Reply" : "Post"} edited!\n` +
            `  ID: ${displayPostId(post)}\n` +
            (post.title ? `  Title: ${post.title}\n` : "") +
            `  Edited: ${post.editedAt}`,
        );
      },
    );

  posts
    .command("delete <postId>")
    .description(
      "Delete a post or reply you authored in a space. <postId> is a publicId (p… post / r… reply).",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (postId: string, opts: { spaceSlug?: string }) => {
      postId = parsePostIdentifier(postId);
      const reply = isReplyId(postId);
      const spaceSlug = resolveSpaceSlug(space, opts);
      await apiDelete(`/spaces/${encodeURIComponent(spaceSlug)}/${reply ? "replies" : "posts"}/${postId}`);

      if (isJsonMode(space)) {
        jsonOut({ id: postId });
        return;
      }

      console.log(`${reply ? "Reply" : "Post"} ${postId} deleted.`);
    });

  posts
    .command("react <postId> <emoji>")
    .description(
      "Add an emoji reaction to a post or reply (idempotent). <postId> is a publicId (p… / r…).",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (postId: string, emoji: string, opts: { spaceSlug?: string }) => {
      postId = parsePostIdentifier(postId);
      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiPut(
        `/spaces/${encodeURIComponent(spaceSlug)}/posts/${postId}/reactions`,
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

  posts
    .command("unreact <postId> <emoji>")
    .description(
      "Remove your emoji reaction from a post or reply. <postId> is a publicId (p… / r…).",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (postId: string, emoji: string, opts: { spaceSlug?: string }) => {
      postId = parsePostIdentifier(postId);
      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiDelete(
        `/spaces/${encodeURIComponent(spaceSlug)}/posts/${postId}/reactions/${encodeURIComponent(emoji)}`,
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

  posts
    .command("reply <postId>")
    .description(
      "Reply to a post in a space. <postId> is a publicId (p…).",
    )
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
      "Local media or document file to attach to this reply. Repeatable. Up to 8 attachments per post; photos, GIFs, videos and document files mix freely. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option("--rationale <rationale>", RATIONALE_OPTION_HELP)
    .option("--no-link-previews", NO_LINK_PREVIEWS_OPTION_HELP)
    .action(async (postId: string, opts: { content?: string; richText?: string; spaceSlug?: string; attach?: string[]; rationale?: string; linkPreviews?: boolean }) => {
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
      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiPost(
        `/spaces/${encodeURIComponent(spaceSlug)}/posts/${postId}/replies`,
        body,
      )) as Record<string, unknown>;
      const msg = unwrapResp(resp) as Record<string, unknown>;
      const mentions = (resp.mentions || {}) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut({ ...msg, mentions });
        return;
      }

      console.log(
        `Reply created!\n  ID: ${displayPostId(msg)}\n  Created: ${msg.createdAt}`,
      );
    });

  // ── Feeds (read-only; feed admin is web-UI only) ──
  //
  // Named, member-gated feeds inside a space — `channel` rows on the wire. The
  // main feed is virtual (no row): `posts recent` / `list` / `create`
  // without --feed target it. Members see their feeds; space owners/admins see
  // all; the space agent sees agent-enabled feeds only. Create/rename/delete
  // and roster management are deliberately not exposed here — like space and
  // member admin, that's web-UI territory.

  const feeds = space
    .command("feeds")
    .description("The named feeds in a space, besides its main feed (read-only).");

  feeds
    .command("list")
    .description(
      "List feeds visible to you in a space (members: yours; space owner/admin: all). The main feed is not listed — read it by omitting --feed on `posts recent`.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (opts: { spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiGet(`/spaces/${encodeURIComponent(spaceSlug)}/channels`)) as Record<string, unknown>;
      const items = (resp.data || []) as Record<string, unknown>[];

      if (isJsonMode(space)) {
        jsonOut(items);
        return;
      }

      if (!items.length) {
        console.log("No feeds found.");
        return;
      }

      const lines: string[] = [];
      for (const c of items) {
        const flags = [
          `${c.memberCount} member${c.memberCount === 1 ? "" : "s"}`,
          c.isMember ? "member: you" : "member: no",
          c.agentAccess ? "agent: on" : "agent: off",
        ].join(", ");
        lines.push(`- [${displayChannelId(c)}] #${c.name} (${flags})`);
        if (c.description) lines.push(`    Description: ${c.description}`);
      }
      console.log(`Feeds (${items.length}):\n` + lines.join("\n"));
    });

  feeds
    .command("get <feedId>")
    .description("Get one feed (feed members, space owner/admin, or the agent on agent-enabled feeds). <feedId> is a publicId (c…).")
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (feedId: string, opts: { spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const id = parseChannelIdentifier(feedId, "<feedId>");
      const resp = (await apiGet(`/spaces/${encodeURIComponent(spaceSlug)}/channels/${id}`)) as Record<string, unknown>;
      const c = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
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

  feeds
    .command("members <feedId>")
    .description("List the members of a feed. <feedId> is a publicId (c…).")
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (feedId: string, opts: { spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const id = parseChannelIdentifier(feedId, "<feedId>");
      const resp = (await apiGet(
        `/spaces/${encodeURIComponent(spaceSlug)}/channels/${id}/members`,
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
        const id = displayUserId({
          publicId: user.publicId,
          id: user.id ?? m.userId,
        });
        lines.push(
          `- [${id || "?"}] ${user.name || "Unknown"} (joined ${m.createdAt})`,
        );
      }
      console.log(`Feed members (${items.length}):\n` + lines.join("\n"));
    });

  // ── Direct messages ──
  //
  // A DM is a channel row with kind='dm' and its messages are ordinary posts —
  // that reuse is what gives conversations unread, mute, push and attachments
  // for free. The WRITE path is separate though: `dms send` posts to
  // /spaces/:slug/dms/:dmId/messages, never `posts create --feed <dmId>`.
  //
  // The server keeps DMs out of `feeds list` and `posts recent` (kind guards in
  // ChannelService.listChannels and PostService.applyChannelVisibility, pinned
  // by dm-containment.spec.ts) — that containment is why nothing here filters
  // DMs client-side.
  //
  // A space DM is with space members (humans) or this space's own bots (by
  // botId) — a personal bot is its owner's alone and is never a party to a
  // space. Omit --user and --agent to open the space's own bot — its oldest,
  // when it has several; a space with no bot 404s. `space` is that same
  // alias. --agent <botId> is sent as { agent: botId }.

  const dms = space
    .command("dms")
    .description("Your direct-message conversations in a space, with members or the space's bots.");

  dms
    .command("list")
    .description(
      "List your direct-message conversations in a space, most recent first. DMs never appear in `feeds list` or `posts recent` — this is the only way to see them.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (opts: { spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiGet(`/spaces/${encodeURIComponent(spaceSlug)}/dms`)) as Record<string, unknown>;
      const items = (resp.data || []) as Record<string, unknown>[];

      if (isJsonMode(space)) {
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
      "Open (or create) a conversation and print its id. Idempotent — the same participant set always returns the same conversation, so it is safe to call before every send. As the SPACE AGENT, pass a single --user to reach that member; the conversation you get is the one they already talk to you in, not a new one.",
    )
    .option(
      "--user <userId>",
      "Member to talk to (repeatable — several makes a group conversation). Take the publicId (u…) from a tool result you actually read this run — an `author.publicId` or `mentions.users[]` in `--json posts recent`, or `feeds members`. User ids are opaque: a guessed one reaches an unrelated real person.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option(
      "--agent <botId>",
      "One of this space's bots, by botId. Omit --user and --agent for the space's own bot (its oldest, when it has several). Mutually exclusive with --user.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (opts: {
      user?: string[];
      agent?: string;
      spaceSlug?: string;
    }) => {
      const wantsAgent = opts.agent != null;
      const wantsUsers = (opts.user?.length ?? 0) > 0;
      if (wantsUsers && wantsAgent) {
        throw new Error("--user and --agent are mutually exclusive.");
      }
      const body: Record<string, unknown> = {};
      if (wantsUsers) {
        body.userIds = (opts.user ?? []).map((raw) =>
          parseUserIdentifier(raw, "--user"),
        );
      } else if (wantsAgent) {
        body.agent = opts.agent;
      } else {
        body.agent = "space";
      }

      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiPost(`/spaces/${encodeURIComponent(spaceSlug)}/dms`, body)) as Record<string, unknown>;
      const dm = (resp.data || {}) as Record<string, unknown>;

      if (isJsonMode(space)) {
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
    .option(
      "--reply-to <messageId>",
      "Reply to a message in this conversation (a p… id from `dms send` or `dms messages`), instead of starting a new one. Use it when you are answering something you said or were told earlier — an answer that arrives as a fresh message makes the reader find the question again.",
    )
    .option("--rationale <rationale>", RATIONALE_OPTION_HELP)
    .option("--no-link-previews", NO_LINK_PREVIEWS_OPTION_HELP)
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(
      async (
        dmId: string,
        opts: {
          content?: string;
          richText?: string;
          attach?: string[];
          replyTo?: string;
          spaceSlug?: string;
          rationale?: string;
          linkPreviews?: boolean;
        },
      ) => {
        const channelId = parseDmIdentifier(dmId, "<dmId>");
        const replyToId = opts.replyTo
          ? parsePostIdentifier(opts.replyTo, "--reply-to")
          : null;
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
        const spaceSlug = resolveSpaceSlug(space, opts);
        // The DM write surface, not `posts create --feed <dmId>`. The row is
        // the same either way, but this endpoint's body has no `title`,
        // `--artifact` or repost — feed concepts a conversation can't render.
        const resp = (await apiPost(
          replyToId
            ? `/spaces/${encodeURIComponent(spaceSlug)}/dms/${channelId}/messages/${replyToId}/replies`
            : `/spaces/${encodeURIComponent(spaceSlug)}/dms/${channelId}/messages`,
          body,
        )) as Record<string, unknown>;
        const post = (resp.data || {}) as Record<string, unknown>;

        if (isJsonMode(space)) {
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
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(
      async (
        dmId: string,
        opts: { limit?: string; cursor?: string; session?: string; spaceSlug?: string },
      ) => {
        const channelId = parseDmIdentifier(dmId, "<dmId>");
        const spaceSlug = resolveSpaceSlug(space, opts);
        const params: Record<string, string> = {};
        if (opts.limit != null) params.limit = opts.limit;
        if (opts.cursor != null) params.cursor = opts.cursor;
        if (opts.session != null) params.rootPostId = opts.session;
        const resp = (await apiGet(
          `/spaces/${encodeURIComponent(spaceSlug)}/dms/${channelId}/messages`,
          params,
        )) as Record<string, unknown>;

        if (isJsonMode(space)) {
          jsonOut(resp);
          return;
        }
        const items = (resp.data || []) as Record<string, unknown>[];
        if (!items.length) {
          console.log("No messages yet.");
          return;
        }
        // A mention-carrying message stores its words in richText with an
        // empty `content`, so the body needs the same live resolution the
        // feed uses.
        const mentions = buildMentionMap(resp);
        const lines: string[] = [];
        // Oldest-first for reading, though the wire ships newest-first for paging.
        for (const m of [...items].reverse()) {
          const author = (m.author || {}) as Record<string, unknown>;
          lines.push(`[${m.createdAt}] ${author.name ?? "?"}: ${postBodyText(m, mentions)}`);
        }
        console.log(lines.join("\n"));
      },
    );

  dms
    .command("sessions <dmId>")
    .description(
      "List a conversation's sessions, newest first (id, started, last activity, preview). Pass an id to `dms messages --session` to read that session. <dmId> is a publicId (d…).",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (dmId: string, opts: { spaceSlug?: string }) => {
      const channelId = parseDmIdentifier(dmId, "<dmId>");
      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiGet(
        `/spaces/${encodeURIComponent(spaceSlug)}/dms/${channelId}/sessions`,
      )) as Record<string, unknown>;

      if (isJsonMode(space)) {
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

  const agents = space
    .command("agents")
    .description("This space's bots: list, add, remove.");

  agents
    .command("list")
    .description("List this space's bots (id, botId, name).")
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (opts: { spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const resp = (await apiGet(
        `/spaces/${encodeURIComponent(spaceSlug)}/agents`,
      )) as Record<string, unknown>;

      // The server's order — oldest first, the one an omitted --agent resolves to.
      const items = ((resp.data || []) as Record<string, unknown>[]).map((a) => ({
        id: typeof a.publicId === "string" && a.publicId ? a.publicId : "",
        botId: (a.botId as string) ?? "",
        name: (a.name as string) ?? null,
      }));

      if (isJsonMode(space)) {
        jsonOut(items);
        return;
      }
      if (!items.length) {
        console.log("No bots yet.");
        return;
      }
      const lines = items.map((a) => {
        const head = `- [${a.id || "?"}] [${a.botId}]`;
        return a.name ? `${head} ${a.name}` : head;
      });
      console.log(`Bots (${items.length}):\n` + lines.join("\n"));
    });

  agents
    .command("add")
    .description("Add a space bot.")
    .option("--id <botId>", "Bot id (lowercase slug). Omit to auto-generate.")
    .option("--name <name>", "Display name.")
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (opts: { id?: string; name?: string; spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      const body: Record<string, unknown> = {};
      if (opts.id != null) body.botId = opts.id;
      if (opts.name != null) body.name = opts.name;
      const resp = (await apiPost(
        `/spaces/${encodeURIComponent(spaceSlug)}/agents`,
        body,
      )) as Record<string, unknown>;
      const agent = unwrapResp(resp) as Record<string, unknown>;
      const botId = (agent.botId as string) || opts.id || "";
      const name = (agent.name as string) ?? opts.name ?? null;

      if (isJsonMode(space)) {
        jsonOut({ botId, name });
        return;
      }
      console.log(
        `Bot added!\n  ID: ${botId}` + (name ? `\n  Name: ${name}` : ""),
      );
    });

  agents
    .command("remove <botId>")
    .description("Remove a space bot.")
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (botId: string, opts: { spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
      await apiDelete(`/spaces/${encodeURIComponent(spaceSlug)}/agents/${encodeURIComponent(botId)}`);

      if (isJsonMode(space)) {
        jsonOut({ botId });
        return;
      }
      console.log(`Bot ${botId} removed.`);
    });

  // ── Records: notes + activities (space-scoped) ──
  //
  // A note or activity captured while THIS space was active is filed with the
  // space's id and listed here for every member — notes attributed to each
  // recorder — in the same shape as `gobi personal notes` / `activities`, so the
  // same subcommand trees serve both. A note is readable by its recorder or a
  // member of its space (the backend authorizes off the row, as the person the
  // caller acts for).
  const noteScope: NoteScope = {
    label: "space",
    spaceScoped: true,
    listNotes: async ({ limit, before, mine, spaceSlug }) => {
      const slug = resolveSpaceSlug(space, { spaceSlug });
      const params = new URLSearchParams();
      if (limit != null) params.append("limit", String(limit));
      if (before) params.append("before", before);
      const resp = (await apiGet(
        `/spaces/${slug}/conversations${params.toString() ? `?${params.toString()}` : ""}`,
      )) as Record<string, unknown>;
      let items = ((resp.conversations as unknown[]) || []) as Record<string, unknown>[];
      // The backend ignores a `mine` query param; each row carries a `mine`
      // flag, so honor --mine client-side — unlike the personal scope, where
      // every row is already yours.
      if (mine) items = items.filter((c) => c.mine === true);
      return {
        items,
        pagination: resp.pagination as { hasMore?: boolean; nextCursor?: string } | undefined,
      };
    },
  };

  const activityScope: ActivityScope = {
    label: "space",
    spaceScoped: true,
    listActivities: async ({ limit, before, spaceSlug }) => {
      const slug = resolveSpaceSlug(space, { spaceSlug });
      const resp = (await apiGet(`/spaces/${slug}/activities`, { limit, before })) as Record<
        string,
        unknown
      >;
      return {
        items: ((resp.activities as unknown[]) || []) as Record<string, unknown>[],
        pagination: resp.pagination as { hasMore?: boolean; nextCursor?: string } | undefined,
      };
    },
  };

  registerNotesSubcommands(
    space,
    noteScope,
    "The space's notes — every member's, attributed to each recorder. A note is " +
      "a record of one captured moment, made from an audio log, a video log, a " +
      "meeting, an imported recording, a conversation Sense detected, or text a " +
      "member wrote; each has a title, a summary and, when there was speech, a " +
      "transcript. Notes and activities are records that belong to this space and " +
      "are never shared directly: to share one outside the space, make it an artifact.",
  );

  // ── Artifacts (space-scoped) ──
  //
  // `create` files the artifact in this space and `list` reads this space's;
  // the by-id leaves authorize off the artifact itself.

  registerArtifactSubcommands(
    space,
    { spaceScoped: true, resolve: (opts) => ({ spaceSlug: resolveSpaceSlug(space, opts) }) },
    "The space's artifacts: versioned documents or media made for an audience " +
      "— posted to a feed, emailed, or opened from a link. Kinds: image | video | " +
      "gif | markdown | note | html. Revisions form a history tree whose newest " +
      "node is what the artifact reads as. Attach one to a post with " +
      "`gobi space posts create --artifact <artifactId>`.",
  );

  registerActivitiesSubcommands(
    space,
    activityScope,
    "The space's activities — what members were doing over a stretch of time " +
      "(traveling, working, talking…), detected by Sense while capturing into this " +
      "space. Like notes, they are records that belong to the space and are never " +
      "shared directly. Each row is complete; there is no per-activity `get` here.",
  );
}
