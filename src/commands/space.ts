import { readFileSync } from "fs";
import { Command } from "commander";
import { apiGet, apiPost, apiPatch, apiDelete } from "../client.js";
import { selectSpace, writeSpaceSetting } from "./init.js";
import { isJsonMode, jsonOut, resolveSpaceSlug, resolveVaultSlug, unwrapResp } from "./utils.js";
import { extractWikiLinks, uploadAttachments } from "../attachments.js";
import { getValidToken } from "../auth/manager.js";

function readContent(value: string): string {
  if (value === "-") return readFileSync("/dev/stdin", "utf8");
  return value;
}

function formatMessageLine(m: Record<string, unknown>): string {
  const isReply = m.parentThreadId != null;
  const id = `[${isReply ? "r" : "t"}:${m.id}]`;
  const kind = isReply ? "reply " : "thread";
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
      "Space commands (threads, replies, members).",
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

  // ── Create / get space ──

  space
    .command("create")
    .description("Create a new space.")
    .requiredOption("--name <name>", "Space name")
    .requiredOption("--slug <slug>", "URL-friendly slug (lowercase letters, digits, hyphens)")
    .option("--description <description>", "Space description")
    .action(async (opts: { name: string; slug: string; description?: string }) => {
      const body: Record<string, unknown> = { name: opts.name, slug: opts.slug };
      if (opts.description != null) body.description = opts.description;
      const resp = (await apiPost(`/spaces`, body)) as Record<string, unknown>;
      const s = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut(s);
        return;
      }

      console.log(
        `Space created!\n` +
          `  ID: ${s.id}\n` +
          `  Slug: ${s.slug}\n` +
          `  Name: ${s.name}`,
      );
    });

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
    .command("list-topic-threads <topicSlug>")
    .description("List threads tagged with a topic in a space (cursor-paginated).")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (topicSlug: string, opts: { limit: string; cursor?: string }) => {
      const spaceSlug = resolveSpaceSlug(space);
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      const resp = (await apiGet(`/spaces/${spaceSlug}/topics/${topicSlug}/threads`, params)) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;
      const pagination = (resp.pagination || {}) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut({ ...data, pagination });
        return;
      }

      const topic = (data.topic || {}) as Record<string, unknown>;
      const threads = (data.threads || []) as Record<string, unknown>[];

      if (!threads.length) {
        console.log(`No threads found for topic "${topic.name || topicSlug}".`);
        return;
      }

      const lines: string[] = [];
      for (const t of threads) {
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
          `Threads (${threads.length} items):\n` +
          lines.join("\n") +
          footer,
      );
    });

  // ── Messages (unified feed) ──

  space
    .command("messages")
    .description("List the unified message feed (threads and replies, newest first) in a space.")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (opts: { limit: string; cursor?: string }) => {
      const spaceSlug = resolveSpaceSlug(space);
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      const resp = (await apiGet(`/spaces/${spaceSlug}/messages`, params)) as Record<string, unknown>;

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
        console.log("No messages found.");
        return;
      }
      const lines = items.map(formatMessageLine);
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Messages (${items.length} items, newest first):\n` + lines.join("\n") + footer,
      );
    });

  // ── Ancestors ──

  space
    .command("ancestors <threadId>")
    .description("Show the ancestor lineage of a thread or reply (root → immediate parent).")
    .action(async (threadId: string) => {
      const spaceSlug = resolveSpaceSlug(space);
      const resp = (await apiGet(
        `/spaces/${spaceSlug}/threads/${threadId}/ancestors`,
      )) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;
      const ancestors = ((data.ancestors as unknown[]) || []) as Record<string, unknown>[];

      if (isJsonMode(space)) {
        jsonOut({ ancestors });
        return;
      }

      if (!ancestors.length) {
        console.log("No ancestors (this is a root thread).");
        return;
      }

      const lines: string[] = [];
      ancestors.forEach((a, i) => {
        lines.push(`${i + 1}. ${formatMessageLine(a)}`);
      });
      console.log(
        `Ancestors (${ancestors.length} items, root first):\n` + lines.join("\n"),
      );
    });

  // ── Threads (get, list, create, edit, delete) ──

  space
    .command("get-thread <threadId>")
    .description("Get a thread and its replies (paginated).")
    .option("--limit <number>", "Replies per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(
      async (threadId: string, opts: { limit: string; cursor?: string }) => {
        const spaceSlug = resolveSpaceSlug(space);
        const params: Record<string, unknown> = {
          limit: parseInt(opts.limit, 10),
        };
        if (opts.cursor) params.cursor = opts.cursor;
        const resp = (await apiGet(
          `/spaces/${spaceSlug}/threads/${threadId}`,
          params,
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
          `Replies (${replies.length} items):`,
          ...replyLines,
          ...(pagination.hasMore ? [`  Next cursor: ${pagination.nextCursor}`] : []),
        ].join("\n");
        console.log(output);
      },
    );

  space
    .command("list-threads")
    .description("List threads in a space (paginated).")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (opts: { limit: string; cursor?: string }) => {
      const spaceSlug = resolveSpaceSlug(space);
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      const resp = (await apiGet(`/spaces/${spaceSlug}/threads`, params)) as Record<string, unknown>;

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
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Threads (${items.length} items):\n` + lines.join("\n") + footer,
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
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before posting",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Vault slug for attachment uploads (overrides .gobi/settings.yaml)",
    )
    .action(
      async (opts: {
        title: string;
        content: string;
        autoAttachments?: boolean;
        vaultSlug?: string;
      }) => {
        const content = readContent(opts.content);
        if (opts.autoAttachments) {
          const vaultSlug = resolveVaultSlug(opts);
          const token = await getValidToken();
          const links = extractWikiLinks(content);
          await uploadAttachments(vaultSlug, links, token, { addToSyncfiles: true });
        }
        const spaceSlug = resolveSpaceSlug(space);
        const resp = (await apiPost(`/spaces/${spaceSlug}/threads`, {
          title: opts.title,
          content,
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
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before editing",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Vault slug for attachment uploads (overrides .gobi/settings.yaml)",
    )
    .action(
      async (
        threadId: string,
        opts: { title?: string; content?: string; autoAttachments?: boolean; vaultSlug?: string },
      ) => {
        if (!opts.title && !opts.content) {
          throw new Error(
            "Provide at least --title or --content to update.",
          );
        }
        const spaceSlug = resolveSpaceSlug(space);
        const body: Record<string, string> = {};
        if (opts.title != null) body.title = opts.title;
        if (opts.content != null) {
          const content = readContent(opts.content);
          if (opts.autoAttachments) {
            const vaultSlug = resolveVaultSlug(opts);
            const token = await getValidToken();
            const links = extractWikiLinks(content);
            await uploadAttachments(vaultSlug, links, token, { addToSyncfiles: true });
          }
          body.content = content;
        }
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
        { content: readContent(opts.content) },
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

  // ── Members ──

  space
    .command("list-members")
    .description("List members of a space (cursor-paginated).")
    .option("--limit <number>", "Items per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .action(async (opts: { limit: string; cursor?: string }) => {
      const spaceSlug = resolveSpaceSlug(space);
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
      };
      if (opts.cursor) params.cursor = opts.cursor;
      const resp = (await apiGet(`/spaces/${spaceSlug}/members`, params)) as Record<string, unknown>;

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
        console.log("No members found.");
        return;
      }
      const lines: string[] = [];
      for (const m of items) {
        const user = (m.user || {}) as Record<string, unknown>;
        const name = (user.name as string) || `User ${m.userId}`;
        const email = user.email ? ` <${user.email}>` : "";
        lines.push(`- [${m.userId}] ${name}${email} (${m.role}, ${m.status})`);
      }
      const footer = pagination.hasMore ? `\n  Next cursor: ${pagination.nextCursor}` : "";
      console.log(
        `Members (${items.length} items):\n` + lines.join("\n") + footer,
      );
    });

  space
    .command("invite-member <email>")
    .description("Invite a user to the space by email (owner only).")
    .action(async (email: string) => {
      const spaceSlug = resolveSpaceSlug(space);
      const resp = (await apiPost(`/spaces/${spaceSlug}/invite`, { email })) as Record<
        string,
        unknown
      >;
      const member = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut(member);
        return;
      }

      console.log(`Invited ${email} to space "${spaceSlug}".`);
    });

  space
    .command("join-space")
    .description("Join a space via invite link.")
    .action(async () => {
      const spaceSlug = resolveSpaceSlug(space);
      const resp = (await apiPost(`/spaces/${spaceSlug}/join`)) as Record<string, unknown>;
      const member = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut(member);
        return;
      }

      console.log(`Joined space "${spaceSlug}" (status: ${member.status}).`);
    });

  space
    .command("request-access")
    .description("Request access to a space.")
    .action(async () => {
      const spaceSlug = resolveSpaceSlug(space);
      const resp = (await apiPost(`/spaces/${spaceSlug}/request-access`)) as Record<
        string,
        unknown
      >;
      const member = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut(member);
        return;
      }

      console.log(`Requested access to space "${spaceSlug}" (status: ${member.status}).`);
    });

  space
    .command("accept-invite")
    .description("Accept an invitation to a space.")
    .action(async () => {
      const spaceSlug = resolveSpaceSlug(space);
      const resp = (await apiPost(`/spaces/${spaceSlug}/accept-invite`)) as Record<
        string,
        unknown
      >;
      const member = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut(member);
        return;
      }

      console.log(`Accepted invite to space "${spaceSlug}" (status: ${member.status}).`);
    });

  space
    .command("approve-member <userId>")
    .description("Approve a pending membership request (owner only).")
    .action(async (userId: string) => {
      const spaceSlug = resolveSpaceSlug(space);
      const resp = (await apiPost(`/spaces/${spaceSlug}/approve/${userId}`)) as Record<
        string,
        unknown
      >;
      const member = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(space)) {
        jsonOut(member);
        return;
      }

      console.log(
        `Approved user ${userId} for space "${spaceSlug}" (status: ${member.status}).`,
      );
    });

  space
    .command("leave-space")
    .description("Leave a space.")
    .action(async () => {
      const spaceSlug = resolveSpaceSlug(space);
      await apiPost(`/spaces/${spaceSlug}/leave`);

      if (isJsonMode(space)) {
        jsonOut({ spaceSlug });
        return;
      }

      console.log(`Left space "${spaceSlug}".`);
    });
}
