import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Command } from "commander";
import { apiGet, apiPost, apiPatch, apiDelete } from "../client.js";
import { WEBDRIVE_BASE_URL } from "../constants.js";
import { getValidToken } from "../auth/manager.js";
import { getSpaceSlug, getVaultSlug, selectSpace, writeSpaceSetting } from "./init.js";

function isJsonMode(cmd: Command): boolean {
  return !!cmd.parent?.opts().json;
}

function jsonOut(data: unknown): void {
  console.log(JSON.stringify({ success: true, data }));
}

function resolveSpaceSlug(cmd: Command): string {
  return cmd.opts().spaceSlug || getSpaceSlug();
}

function resolveVaultSlug(opts: { vaultSlug?: string }): string {
  return opts.vaultSlug || getVaultSlug();
}

function unwrapResp(resp: unknown): unknown {
  if (typeof resp === "object" && resp !== null && "data" in resp) {
    return (resp as Record<string, unknown>).data;
  }
  return resp;
}

export function registerAstraCommand(program: Command): void {
  const astra = program
    .command("astra")
    .description(
      "Astra commands (posts, sessions, brains, brain updates).",
    )
    .option(
      "--space-slug <slug>",
      "Space slug (overrides .gobi/settings.yaml)",
    );

  // ── Warp (space selection) ──

  astra
    .command("warp")
    .description("Select the active space for astra commands.")
    .action(async () => {
      const result = await selectSpace();
      if (result === null) {
        console.log("No space selected.");
        return;
      }
      writeSpaceSetting(result.slug);

      if (isJsonMode(astra)) {
        jsonOut({ spaceSlug: result.slug, spaceName: result.name });
        return;
      }

      console.log(`Warped to space "${result.name}" (${result.slug})`);
    });

  // ── Brains ──

  astra
    .command("search-brain")
    .description(
      "Search brains (second brains/vaults) in a space using text and semantic search.",
    )
    .requiredOption("--query <query>", "Search query")
    .action(async (opts: { query: string }) => {
      const spaceSlug = resolveSpaceSlug(astra);
      const resp = (await apiGet(`/spaces/${spaceSlug}/brains`, {
        query: opts.query,
      })) as Record<string, unknown>;
      const results = (
        Array.isArray(resp) ? resp : (resp.data as unknown[]) || resp
      ) as Record<string, unknown>[];

      if (isJsonMode(astra)) {
        jsonOut(results || []);
        return;
      }

      if (!results || results.length === 0) {
        console.log(`No brains found matching "${opts.query}".`);
        return;
      }
      const lines: string[] = [];
      for (const entry of results) {
        const vault = (entry.vault || entry) as Record<string, unknown>;
        const owner = (entry.owner || {}) as Record<string, unknown>;
        const ownerName = owner.name ? ` by ${owner.name}` : "";
        const sim =
          entry.similarity != null
            ? ` [similarity: ${(entry.similarity as number).toFixed(3)}]`
            : "";
        lines.push(
          `- ${vault.name || vault.title || "N/A"} (ID: ${vault.vaultId || vault.id || "N/A"})${ownerName}${sim}`,
        );
      }
      console.log(`Brains matching "${opts.query}":\n` + lines.join("\n"));
    });

  astra
    .command("ask-brain")
    .description(
      "Ask a brain a question. Creates a targeted session (1:1 conversation).",
    )
    .requiredOption(
      "--vault-slug <vaultSlug>",
      "Slug of the brain/vault to ask",
    )
    .requiredOption(
      "--question <question>",
      "The question to ask (markdown supported)",
    )
    .option("--mode <mode>", 'Session mode: "auto" or "manual"')
    .action(
      async (opts: {
        vaultSlug: string;
        question: string;
        mode?: string;
      }) => {
        const spaceSlug = resolveSpaceSlug(astra);
        const body: Record<string, string> = {
          vaultSlug: opts.vaultSlug,
          spaceSlug,
          question: opts.question,
        };
        if (opts.mode != null) body.mode = opts.mode;
        const resp = (await apiPost(`/session/targeted`,
          body,
        )) as Record<string, unknown>;
        const data = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(astra)) {
          jsonOut(data);
          return;
        }

        const session = (data.session || {}) as Record<string, unknown>;
        const members = (data.members || []) as unknown[];
        console.log(
          `Session created!\n` +
            `  Session ID: ${session.id}\n` +
            `  Mode: ${session.mode}\n` +
            `  Members: ${members.length}\n` +
            `  Question sent.`,
        );
      },
    );

  astra
    .command("publish-brain")
    .description(
      "Upload BRAIN.md to the vault root on webdrive. Triggers post-processing (brain sync, metadata update, Discord notification).",
    )
    .action(async () => {
      const vaultId = getVaultSlug();
      const filePath = join(process.cwd(), "BRAIN.md");
      if (!existsSync(filePath)) {
        throw new Error(`BRAIN.md not found in ${process.cwd()}`);
      }

      const content = readFileSync(filePath, "utf-8");
      const token = await getValidToken();
      const url = `${WEBDRIVE_BASE_URL}/api/v1/vaults/${vaultId}/files/BRAIN.md`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "text/markdown",
        },
        body: content,
      });

      if (!res.ok) {
        throw new Error(
          `Upload failed: HTTP ${res.status}: ${(await res.text()) || "(no body)"}`,
        );
      }

      if (isJsonMode(astra)) {
        jsonOut({ vaultId });
        return;
      }

      console.log(`Published BRAIN.md to vault "${vaultId}"`);
    });

  astra
    .command("unpublish-brain")
    .description("Delete BRAIN.md from the vault on webdrive.")
    .action(async () => {
      const vaultId = getVaultSlug();
      const token = await getValidToken();
      const url = `${WEBDRIVE_BASE_URL}/api/v1/vaults/${vaultId}/files/BRAIN.md`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(
          `Delete failed: HTTP ${res.status}: ${(await res.text()) || "(no body)"}`,
        );
      }

      if (isJsonMode(astra)) {
        jsonOut({ vaultId });
        return;
      }

      console.log(`Deleted BRAIN.md from vault "${vaultId}"`);
    });

  // ── Posts (get, list, create, edit, delete) ──

  astra
    .command("get-post <postId>")
    .description("Get a post and its replies (paginated).")
    .option("--limit <number>", "Replies per page", "20")
    .option("--offset <number>", "Offset for reply pagination", "0")
    .action(
      async (postId: string, opts: { limit: string; offset: string }) => {
        const spaceSlug = resolveSpaceSlug(astra);
        const resp = (await apiGet(
          `/spaces/${spaceSlug}/posts/${postId}`,
          {
            limit: parseInt(opts.limit, 10),
            offset: parseInt(opts.offset, 10),
          },
        )) as Record<string, unknown>;
        const data = unwrapResp(resp) as Record<string, unknown>;
        const pagination = (resp.pagination || {}) as Record<string, unknown>;

        if (isJsonMode(astra)) {
          jsonOut({ ...data, pagination });
          return;
        }

        const msg = (data.post || data) as Record<string, unknown>;
        const replies = ((data.items as unknown[]) || []) as Record<
          string,
          unknown
        >[];
        const totalReplies =
          (pagination.total as number) ||
          (msg.replyCount as number) ||
          0;

        const author =
          ((msg.author as Record<string, unknown>)?.name as string) ||
          `User ${msg.authorId}`;
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
          `Post: ${msg.title}`,
          `By: ${author} on ${msg.createdAt}`,
          "",
          msg.content as string,
          "",
          `Replies (${replies.length} of ${totalReplies}):`,
          ...replyLines,
        ].join("\n");
        console.log(output);
      },
    );

  astra
    .command("list-posts")
    .description("List posts in a space (paginated).")
    .option("--limit <number>", "Items per page", "20")
    .option("--offset <number>", "Offset for pagination", "0")
    .action(async (opts: { limit: string; offset: string }) => {
      const spaceSlug = resolveSpaceSlug(astra);
      const resp = (await apiGet(`/spaces/${spaceSlug}/posts`, {
        limit: parseInt(opts.limit, 10),
        offset: parseInt(opts.offset, 10),
      })) as Record<string, unknown>;

      if (isJsonMode(astra)) {
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
      for (const msg of items) {
        const author =
          ((msg.author as Record<string, unknown>)?.name as string) ||
          `User ${msg.authorId}`;
        lines.push(
          `- [${msg.id}] "${msg.title}" by ${author} (${msg.replyCount} replies, ${msg.createdAt})`,
        );
      }
      const total = (pagination.total as number) || items.length;
      console.log(
        `Posts (${items.length} of ${total}):\n` + lines.join("\n"),
      );
    });

  astra
    .command("create-post")
    .description("Create a post in a space.")
    .requiredOption("--title <title>", "Title of the post")
    .requiredOption(
      "--content <content>",
      "Post content (markdown supported)",
    )
    .action(
      async (opts: {
        title: string;
        content: string;
      }) => {
        const spaceSlug = resolveSpaceSlug(astra);
        const resp = (await apiPost(`/spaces/${spaceSlug}/posts`, {
          title: opts.title,
          content: opts.content,
        })) as Record<string, unknown>;
        const msg = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(astra)) {
          jsonOut(msg);
          return;
        }

        console.log(
          `Post created!\n` +
            `  ID: ${msg.id}\n` +
            `  Title: ${msg.title}\n` +
            `  Created: ${msg.createdAt}`,
        );
      },
    );

  astra
    .command("edit-post <postId>")
    .description("Edit a post. You must be the author.")
    .option("--title <title>", "New title for the post")
    .option(
      "--content <content>",
      "New content for the post (markdown supported)",
    )
    .action(
      async (
        postId: string,
        opts: { title?: string; content?: string },
      ) => {
        if (!opts.title && !opts.content) {
          throw new Error(
            "Provide at least --title or --content to update.",
          );
        }
        const spaceSlug = resolveSpaceSlug(astra);
        const body: Record<string, string> = {};
        if (opts.title != null) body.title = opts.title;
        if (opts.content != null) body.content = opts.content;
        const resp = (await apiPatch(
          `/spaces/${spaceSlug}/posts/${postId}`,
          body,
        )) as Record<string, unknown>;
        const msg = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(astra)) {
          jsonOut(msg);
          return;
        }

        console.log(
          `Post edited!\n` +
            `  ID: ${msg.id}\n` +
            `  Title: ${msg.title}\n` +
            `  Edited: ${msg.editedAt}`,
        );
      },
    );

  astra
    .command("delete-post <postId>")
    .description("Delete a post. You must be the author.")
    .action(async (postId: string) => {
      const spaceSlug = resolveSpaceSlug(astra);
      await apiDelete(`/spaces/${spaceSlug}/posts/${postId}`);

      if (isJsonMode(astra)) {
        jsonOut({ id: postId });
        return;
      }

      console.log(`Post ${postId} deleted.`);
    });

  // ── Replies (create, edit, delete) ──

  astra
    .command("create-reply <postId>")
    .description("Create a reply to a post in a space.")
    .requiredOption(
      "--content <content>",
      "Reply content (markdown supported)",
    )
    .action(async (postId: string, opts: { content: string }) => {
      const spaceSlug = resolveSpaceSlug(astra);
      const resp = (await apiPost(
        `/spaces/${spaceSlug}/posts/${postId}/replies`,
        { content: opts.content },
      )) as Record<string, unknown>;
      const msg = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(astra)) {
        jsonOut(msg);
        return;
      }

      console.log(
        `Reply created!\n  ID: ${msg.id}\n  Created: ${msg.createdAt}`,
      );
    });

  astra
    .command("edit-reply <replyId>")
    .description("Edit a reply. You must be the author.")
    .requiredOption(
      "--content <content>",
      "New content for the reply (markdown supported)",
    )
    .action(async (replyId: string, opts: { content: string }) => {
      const spaceSlug = resolveSpaceSlug(astra);
      const resp = (await apiPatch(
        `/spaces/${spaceSlug}/replies/${replyId}`,
        { content: opts.content },
      )) as Record<string, unknown>;
      const msg = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(astra)) {
        jsonOut(msg);
        return;
      }

      console.log(
        `Reply edited!\n  ID: ${msg.id}\n  Edited: ${msg.editedAt}`,
      );
    });

  astra
    .command("delete-reply <replyId>")
    .description("Delete a reply. You must be the author.")
    .action(async (replyId: string) => {
      const spaceSlug = resolveSpaceSlug(astra);
      await apiDelete(`/spaces/${spaceSlug}/replies/${replyId}`);

      if (isJsonMode(astra)) {
        jsonOut({ replyId });
        return;
      }

      console.log(`Reply ${replyId} deleted.`);
    });

  // ── Sessions (get, list, reply) ──

  astra
    .command("get-session <sessionId>")
    .description("Get a session and its messages (paginated).")
    .option("--limit <number>", "Messages per page", "20")
    .option("--offset <number>", "Offset for message pagination", "0")
    .action(
      async (sessionId: string, opts: { limit: string; offset: string }) => {
        const resp = (await apiGet(`/session/${sessionId}`, {
          limit: parseInt(opts.limit, 10),
          offset: parseInt(opts.offset, 10),
        })) as Record<string, unknown>;
        const data = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(astra)) {
          jsonOut(data);
          return;
        }

        const session = (data.session || data) as Record<string, unknown>;
        const messages = ((data.messages as unknown[]) || []) as Record<
          string,
          unknown
        >[];
        const pagination = (data.pagination || {}) as Record<string, unknown>;
        const totalMessages =
          (pagination.total as number) || messages.length;

        const msgLines: string[] = [];
        for (const m of messages) {
          const author =
            ((m.author as Record<string, unknown>)?.name as string) ||
            (m.source as string) ||
            `User ${m.authorId}`;
          const text = m.content as string;
          const truncated =
            text.length > 200 ? text.slice(0, 200) + "\u2026" : text;
          msgLines.push(`  - ${author}: ${truncated} (${m.createdAt})`);
        }

        const output = [
          `Session: ${session.title}`,
          `  ID: ${session.id}`,
          `  Mode: ${session.mode}`,
          `  Last activity: ${session.lastMessageAt}`,
          "",
          `Messages (${messages.length} of ${totalMessages}):`,
          ...msgLines,
        ].join("\n");
        console.log(output);
      },
    );

  astra
    .command("list-sessions")
    .description("List all sessions you are part of, sorted by most recent activity.")
    .option("--limit <number>", "Items per page", "20")
    .option("--offset <number>", "Offset for pagination", "0")
    .action(async (opts: { limit: string; offset: string }) => {
      const spaceSlug = resolveSpaceSlug(astra);
      const limit = parseInt(opts.limit, 10);
      const offset = parseInt(opts.offset, 10);

      const resp = (await apiGet(`/session/my-sessions`, {
        spaceSlug,
        limit,
        offset,
      })) as Record<string, unknown>;

      const items = ((resp.data as unknown[]) || []) as Record<string, unknown>[];
      const pagination = (resp.pagination || {}) as Record<string, unknown>;
      const total = (pagination.total as number) ?? items.length;

      if (isJsonMode(astra)) {
        jsonOut({
          items,
          pagination: resp.pagination || {},
        });
        return;
      }

      if (!items.length) {
        console.log("No sessions found.");
        return;
      }
      const lines: string[] = [];
      for (const s of items) {
        const title = (s.title as string) || "(no title)";
        const members = (s.members as Record<string, unknown>[]) || [];
        const memberCount = (s.memberCount as number) ?? 0;

        let memberInfo = "";
        if (members.length > 0) {
          const names = members.map(
            (m) => (m.vaultName as string) || (m.name as string) || "Unknown",
          );
          const overflow = memberCount - members.length - 1; // -1 for "me"
          memberInfo = ` | with: ${names.join(", ")}`;
          if (overflow > 0) memberInfo += ` +${overflow} more`;
        }

        lines.push(
          `- [${s.id}] "${title}" (mode: ${s.mode}, last activity: ${s.lastMessageAt})${memberInfo}`,
        );
      }
      console.log(
        `Sessions (${items.length} of ${total}):\n` + lines.join("\n"),
      );
    });

  astra
    .command("reply-session <sessionId>")
    .description("Send a human reply to a session you are a member of.")
    .requiredOption(
      "--content <content>",
      "Reply content (markdown supported)",
    )
    .action(async (sessionId: string, opts: { content: string }) => {
      const resp = (await apiPost(`/session/${sessionId}/reply`, {
        content: opts.content,
      })) as Record<string, unknown>;
      const msg = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(astra)) {
        jsonOut(msg);
        return;
      }

      console.log(
        `Reply sent!\n` +
          `  Message ID: ${msg.id}\n` +
          `  Source: ${msg.source}\n` +
          `  Created: ${msg.createdAt}`,
      );
    });

  astra
    .command("update-session <sessionId>")
    .description(
      'Update a session. "auto" lets the AI respond automatically; "manual" requires human replies.',
    )
    .option("--mode <mode>", 'Session mode: "auto" or "manual"')
    .action(async (sessionId: string, opts: { mode?: string }) => {
      if (!opts.mode) {
        throw new Error(
          "Provide at least one option to update (e.g. --mode).",
        );
      }
      const body: Record<string, string> = {};
      if (opts.mode != null) {
        if (opts.mode !== "auto" && opts.mode !== "manual") {
          throw new Error(
            'Invalid mode. Must be "auto" or "manual".',
          );
        }
        body.mode = opts.mode;
      }
      const resp = (await apiPatch(`/session/${sessionId}`, body)) as Record<
        string,
        unknown
      >;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(astra)) {
        jsonOut(data);
        return;
      }

      const session = (data.session || data) as Record<string, unknown>;
      console.log(
        `Session updated!\n` +
          `  ID: ${session.id}\n` +
          `  Mode: ${session.mode}`,
      );
    });

  // ── Brain Updates (list, create, edit, delete) ──

  astra
    .command("list-brain-updates")
    .description("List recent brain updates in a space (paginated).")
    .option("--limit <number>", "Items per page", "20")
    .option("--offset <number>", "Offset for pagination", "0")
    .action(async (opts: { limit: string; offset: string }) => {
      const spaceSlug = resolveSpaceSlug(astra);
      const resp = (await apiGet(`/spaces/${spaceSlug}/brain-updates`, {
        limit: parseInt(opts.limit, 10),
        offset: parseInt(opts.offset, 10),
      })) as Record<string, unknown>;

      if (isJsonMode(astra)) {
        jsonOut({
          items: resp.data || [],
          pagination: resp.pagination || {},
        });
        return;
      }

      const items = (resp.data || []) as Record<string, unknown>[];
      const pagination = (resp.pagination || {}) as Record<string, unknown>;
      if (!items.length) {
        console.log("No brain updates found.");
        return;
      }
      const lines: string[] = [];
      for (const u of items) {
        const author =
          ((u.author as Record<string, unknown>)?.name as string) ||
          `User ${u.authorId}`;
        const vaultSlug =
          ((u.vault as Record<string, unknown>)?.vaultSlug as string) ||
          "?";
        lines.push(
          `- [${u.id}] "${u.title}" by ${author} (vault: ${vaultSlug}, ${u.createdAt})`,
        );
      }
      const total = (pagination.total as number) || items.length;
      console.log(
        `Brain updates (${items.length} of ${total}):\n` + lines.join("\n"),
      );
    });

  astra
    .command("create-brain-update")
    .description(
      "Create a brain update in a space. Uses the vault from settings.",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Vault slug (overrides .gobi/settings.yaml)",
    )
    .requiredOption("--title <title>", "Title of the update")
    .requiredOption(
      "--content <content>",
      "Update content (markdown supported)",
    )
    .action(async (opts: { vaultSlug?: string; title: string; content: string }) => {
      const spaceSlug = resolveSpaceSlug(astra);
      const vaultSlug = resolveVaultSlug(opts);
      const resp = (await apiPost(`/spaces/${spaceSlug}/brain-updates`, {
        vaultSlug,
        title: opts.title,
        content: opts.content,
      })) as Record<string, unknown>;
      const u = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(astra)) {
        jsonOut(u);
        return;
      }

      console.log(
        `Brain update created!\n` +
          `  ID: ${u.id}\n` +
          `  Title: ${u.title}\n` +
          `  Vault: ${u.vaultSlug || vaultSlug}\n` +
          `  Created: ${u.createdAt}`,
      );
    });

  astra
    .command("edit-brain-update <updateId>")
    .description("Edit a published brain update. You must be the author.")
    .option("--title <title>", "New title for the update")
    .option(
      "--content <content>",
      "New content for the update (markdown supported)",
    )
    .action(
      async (
        updateId: string,
        opts: { title?: string; content?: string },
      ) => {
        if (!opts.title && !opts.content) {
          throw new Error(
            "Provide at least --title or --content to update.",
          );
        }
        const spaceSlug = resolveSpaceSlug(astra);
        const body: Record<string, string> = {};
        if (opts.title != null) body.title = opts.title;
        if (opts.content != null) body.content = opts.content;
        const resp = (await apiPatch(
          `/spaces/${spaceSlug}/brain-updates/${updateId}`,
          body,
        )) as Record<string, unknown>;
        const u = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(astra)) {
          jsonOut(u);
          return;
        }

        console.log(
          `Brain update edited!\n` +
            `  ID: ${u.id}\n` +
            `  Title: ${u.title}\n` +
            `  Updated: ${u.updatedAt}`,
        );
      },
    );

  astra
    .command("delete-brain-update <updateId>")
    .description(
      "Delete a published brain update. You must be the author.",
    )
    .action(async (updateId: string) => {
      const spaceSlug = resolveSpaceSlug(astra);
      await apiDelete(`/spaces/${spaceSlug}/brain-updates/${updateId}`);

      if (isJsonMode(astra)) {
        jsonOut({ id: updateId });
        return;
      }

      console.log(`Brain update ${updateId} deleted.`);
    });
}
