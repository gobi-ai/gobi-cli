import { Command } from "commander";
import { WEB_BASE_URL } from "../constants.js";
import { apiGet, apiPost, apiPatch, apiDelete } from "../client.js";
import {
  requireSpace,
  selectSpace,
  setSpaceRequirement,
  writeSpaceSetting,
} from "./init.js";
import {
  fetchDraftSummary,
  isJsonMode,
  jsonOut,
  readStdin,
  resolveSpaceSlug,
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
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (opts: { limit: string; cursor?: string; spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
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
          const body =
            opts.full || !text || text.length <= 200
              ? text
              : text.slice(0, 200) + "…";
          replyLines.push(`  - ${rAuthor}: ${body} (${r.createdAt})`);
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
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (opts: { limit: string; cursor?: string; spaceSlug?: string }) => {
      const spaceSlug = resolveSpaceSlug(space, opts);
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
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before posting (also attributes the post to that vault)",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Attribute the post to this vault (sets authorVaultSlug). Also used as upload destination for --auto-attachments.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .option(
      "--draft-id <draftId>",
      "Use this draft as the source of title and content (mutually exclusive with --title/--content/--rich-text). On success, links the post back by recording postId/spaceSlug on draft.metadata so the client can render an 'Open post' button. The draft's vaultSlug seeds --vault-slug when not given explicitly.",
    )
    .option(
      "--attach <file>",
      "Local media file to attach. Repeatable. X-style mix rule: up to 4 photos OR 1 GIF OR 1 video. Size ceilings: 5MB photos / 15MB GIFs / 512MB video.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option(
      "--repost-post-id <postId>",
      "Wrap an existing top-level post as the embedded card on this new post. Composes with --content / --rich-text / --attach (the wrapping author's text + media render above the embedded card). Reposts-of-reposts are collapsed to the transitive root server-side. The referenced post must exist, not be deleted, and not itself be a reply.",
    )
    .action(
      async (opts: {
        title?: string;
        content?: string;
        richText?: string;
        autoAttachments?: boolean;
        vaultSlug?: string;
        spaceSlug?: string;
        draftId?: string;
        attach?: string[];
        repostPostId?: string;
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
          if (opts.autoAttachments) {
            const token = await getValidToken();
            const links = extractWikiLinks(content);
            await uploadAttachments(authorVaultSlug!, links, token, { addToSyncfiles: true });
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
        if (opts.repostPostId != null) {
          const n = Number(opts.repostPostId);
          if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
            throw new Error("--repost-post-id must be a positive integer.");
          }
          body.repostPostId = n;
        }
        const spaceSlug = resolveSpaceSlug(space, opts);
        const resp = (await apiPost(`/spaces/${spaceSlug}/posts`, body)) as Record<string, unknown>;
        const post = unwrapResp(resp) as Record<string, unknown>;

        if (opts.draftId && post.id != null) {
          try {
            await apiPatch(`/app/drafts/${opts.draftId}/metadata`, {
              postId: typeof post.id === "number" ? post.id : Number(post.id),
              spaceSlug,
            });
          } catch (e) {
            // Don't fail the create if linking fails — the post is live; just
            // surface a warning so the agent can mention it.
            console.error(`Warning: failed to link post to draft ${opts.draftId}: ${(e as Error).message}`);
          }
        }

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
            `  URL: ${shareUrl}` +
            (opts.draftId ? `\n  Linked to draft: ${opts.draftId}` : ""),
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
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before editing (also attributes the post to that vault)",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Attribute the post to this vault (sets authorVaultSlug). Also used as upload destination for --auto-attachments.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .option(
      "--attach <file>",
      "Replace the post's media attachments with the given files (existing attachments are removed). Repeatable. X-style mix rule: up to 4 photos OR 1 GIF OR 1 video. Size ceilings: 5MB photos / 15MB GIFs / 512MB video. Omit to leave attachments unchanged.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .action(
      async (
        postId: string,
        opts: { title?: string; content?: string; richText?: string; autoAttachments?: boolean; vaultSlug?: string; spaceSlug?: string; attach?: string[] },
      ) => {
        const wantsVaultChange = !!(opts.vaultSlug || opts.autoAttachments);
        const wantsAttachChange = !!(opts.attach && opts.attach.length > 0);
        if (
          opts.title == null &&
          opts.content == null &&
          opts.richText == null &&
          !wantsVaultChange &&
          !wantsAttachChange
        ) {
          throw new Error(
            "Provide at least --title, --content, --rich-text, --vault-slug, or --attach to update.",
          );
        }
        if (opts.content && opts.richText) {
          throw new Error("--content and --rich-text are mutually exclusive.");
        }
        const spaceSlug = resolveSpaceSlug(space, opts);
        let authorVaultSlug: string | undefined;
        if (opts.vaultSlug || opts.autoAttachments) {
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
        if (opts.attach && opts.attach.length > 0) {
          assertPostAttachmentMix(opts.attach);
          body.attachments = await uploadPostAttachments(opts.attach);
        }
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
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before posting (also attributes the reply to that vault)",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Attribute the reply to this vault (sets authorVaultSlug). Also used as upload destination for --auto-attachments.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .option(
      "--attach <file>",
      "Local media file to attach to this reply. Repeatable. X-style mix rule: up to 4 photos OR 1 GIF OR 1 video. Size ceilings: 5MB photos / 15MB GIFs / 512MB video.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .action(async (postId: string, opts: { content?: string; richText?: string; autoAttachments?: boolean; vaultSlug?: string; spaceSlug?: string; attach?: string[] }) => {
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
        if (opts.autoAttachments) {
          const token = await getValidToken();
          const links = extractWikiLinks(content);
          await uploadAttachments(authorVaultSlug!, links, token, { addToSyncfiles: true });
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
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before editing (also attributes the reply to that vault)",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Attribute the reply to this vault (sets authorVaultSlug). Also used as upload destination for --auto-attachments.",
    )
    .option("--space-slug <spaceSlug>", "Space slug (overrides .gobi/settings.yaml)")
    .action(async (replyId: string, opts: { content?: string; richText?: string; autoAttachments?: boolean; vaultSlug?: string; spaceSlug?: string }) => {
      const wantsVaultChange = !!(opts.vaultSlug || opts.autoAttachments);
      if (opts.content == null && opts.richText == null && !wantsVaultChange) {
        throw new Error(
          "Provide at least --content, --rich-text, or --vault-slug to update.",
        );
      }
      if (opts.content && opts.richText) {
        throw new Error("--content and --rich-text are mutually exclusive.");
      }
      const spaceSlug = resolveSpaceSlug(space, opts);
      let authorVaultSlug: string | undefined;
      if (opts.vaultSlug || opts.autoAttachments) {
        authorVaultSlug = resolveVaultSlug(opts);
      }
      const body: Record<string, unknown> = {};
      if (opts.content != null) {
        const content = readContent(opts.content);
        if (opts.autoAttachments) {
          const token = await getValidToken();
          const links = extractWikiLinks(content);
          await uploadAttachments(authorVaultSlug!, links, token, { addToSyncfiles: true });
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

}
