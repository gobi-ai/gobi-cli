import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Command } from "commander";
import { apiGet, apiPost, apiPatch, apiDelete } from "../client.js";
import { WEBDRIVE_BASE_URL } from "../constants.js";
import { getValidToken } from "../auth/manager.js";
import { getVaultSlug } from "./init.js";
import { isJsonMode, jsonOut, resolveVaultSlug, unwrapResp } from "./utils.js";
import { extractWikiLinks, uploadAttachments } from "../attachments.js";

export function registerBrainCommand(program: Command): void {
  const brain = program
    .command("brain")
    .description("Brain commands (search, ask, publish, unpublish, updates).");

  // ── Search ──

  brain
    .command("search")
    .description(
      "Search public brains by text and semantic similarity.",
    )
    .requiredOption("--query <query>", "Search query")
    .action(async (opts: { query: string }) => {
      const resp = (await apiGet(`/vault/public/search`, {
        query: opts.query,
      })) as Record<string, unknown>;
      const results = (
        Array.isArray(resp) ? resp : (resp.data as unknown[]) || resp
      ) as Record<string, unknown>[];

      if (isJsonMode(brain)) {
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
        const spaceSlug = (entry.spaceSlug || vault.spaceSlug || "") as string;
        const vaultSlug = (vault.slug || vault.vaultSlug || vault.id || "N/A") as string;
        lines.push(
          `- ${vault.name || vault.title || "N/A"} (vault: ${vaultSlug}, space: ${spaceSlug || "N/A"})${ownerName}${sim}`,
        );
      }
      console.log(`Brains matching "${opts.query}":\n` + lines.join("\n"));
    });

  // ── Ask ──

  brain
    .command("ask")
    .description(
      "Ask a brain a question. Creates a targeted session (1:1 conversation).",
    )
    .requiredOption(
      "--vault-slug <vaultSlug>",
      "Slug of the brain/vault to ask",
    )
    .option(
      "--question <question>",
      "The question to ask (markdown supported)",
    )
    .option(
      "--rich-text <richText>",
      "Rich-text JSON array (e.g. [{\"type\":\"text\",\"text\":\"hello\"}])",
    )
    .option("--mode <mode>", 'Session mode: "auto" or "manual"')
    .action(
      async (opts: {
        vaultSlug: string;
        question?: string;
        richText?: string;
        mode?: string;
      }) => {
        if (!opts.question && !opts.richText) {
          throw new Error("Provide either --question or --rich-text.");
        }
        if (opts.question && opts.richText) {
          throw new Error("--question and --rich-text are mutually exclusive.");
        }
        const body: Record<string, unknown> = {
          vaultSlug: opts.vaultSlug,
        };
        if (opts.question != null) body.question = opts.question;
        if (opts.richText != null) {
          let parsed: unknown;
          try { parsed = JSON.parse(opts.richText); } catch { throw new Error("Invalid --rich-text JSON."); }
          body.richText = parsed;
        }
        if (opts.mode != null) body.mode = opts.mode;
        const resp = (await apiPost(`/chat/targeted`,
          body,
        )) as Record<string, unknown>;
        const data = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(brain)) {
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

  // ── Publish ──

  brain
    .command("publish")
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
      const url = `${WEBDRIVE_BASE_URL}/api/v1/vaults/${vaultId}/file/BRAIN.md`;
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

      if (isJsonMode(brain)) {
        jsonOut({ vaultId });
        return;
      }

      console.log(`Published BRAIN.md to vault "${vaultId}"`);
    });

  // ── Unpublish ──

  brain
    .command("unpublish")
    .description("Delete BRAIN.md from the vault on webdrive.")
    .action(async () => {
      const vaultId = getVaultSlug();
      const token = await getValidToken();
      const url = `${WEBDRIVE_BASE_URL}/api/v1/vaults/${vaultId}/file/BRAIN.md`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(
          `Delete failed: HTTP ${res.status}: ${(await res.text()) || "(no body)"}`,
        );
      }

      if (isJsonMode(brain)) {
        jsonOut({ vaultId });
        return;
      }

      console.log(`Deleted BRAIN.md from vault "${vaultId}"`);
    });

  // ── Updates (post, edit, delete) ──

  brain
    .command("post-update")
    .description(
      "Post a brain update for a vault.",
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
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before posting",
    )
    .action(async (opts: { vaultSlug?: string; title: string; content: string; autoAttachments?: boolean }) => {
      const vaultSlug = resolveVaultSlug(opts);
      if (opts.autoAttachments) {
        const token = await getValidToken();
        const links = extractWikiLinks(opts.content);
        await uploadAttachments(vaultSlug, links, token, { addToSyncfiles: true });
      }
      const resp = (await apiPost(`/brain-updates/vault/${vaultSlug}`, {
        title: opts.title,
        content: opts.content,
      })) as Record<string, unknown>;
      const u = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(brain)) {
        jsonOut(u);
        return;
      }

      console.log(
        `Brain update posted!\n` +
          `  ID: ${u.id}\n` +
          `  Title: ${u.title}\n` +
          `  Vault: ${u.vaultSlug || vaultSlug}\n` +
          `  Created: ${u.createdAt}`,
      );
    });

  brain
    .command("edit-update <updateId>")
    .description("Edit a published brain update. You must be the author.")
    .option("--title <title>", "New title for the update")
    .option(
      "--content <content>",
      "New content for the update (markdown supported)",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Vault slug for attachment uploads (overrides .gobi/settings.yaml)",
    )
    .option(
      "--auto-attachments",
      "Upload wiki-linked [[files]] to webdrive before editing",
    )
    .action(
      async (
        updateId: string,
        opts: { title?: string; content?: string; vaultSlug?: string; autoAttachments?: boolean },
      ) => {
        if (!opts.title && !opts.content) {
          throw new Error(
            "Provide at least --title or --content to update.",
          );
        }
        if (opts.autoAttachments && opts.content) {
          const vaultSlug = resolveVaultSlug(opts);
          const token = await getValidToken();
          const links = extractWikiLinks(opts.content);
          await uploadAttachments(vaultSlug, links, token, { addToSyncfiles: true });
        }
        const body: Record<string, string> = {};
        if (opts.title != null) body.title = opts.title;
        if (opts.content != null) body.content = opts.content;
        const resp = (await apiPatch(
          `/brain-updates/${updateId}`,
          body,
        )) as Record<string, unknown>;
        const u = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(brain)) {
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

  brain
    .command("delete-update <updateId>")
    .description(
      "Delete a published brain update. You must be the author.",
    )
    .action(async (updateId: string) => {
      await apiDelete(`/brain-updates/${updateId}`);

      if (isJsonMode(brain)) {
        jsonOut({ id: updateId });
        return;
      }

      console.log(`Brain update ${updateId} deleted.`);
    });

  // ── Update Replies (get-update, reply-to-update, edit-update-reply, delete-update-reply) ──

  brain
    .command("get-update <updateId>")
    .description("Get a brain update and its replies (paginated).")
    .option("--limit <number>", "Replies per page", "20")
    .option("--cursor <string>", "Pagination cursor from previous response")
    .option("--full", "Show full reply content without truncation")
    .action(
      async (updateId: string, opts: { limit: string; cursor?: string; full?: boolean }) => {
        const params: Record<string, unknown> = {
          limit: parseInt(opts.limit, 10),
        };
        if (opts.cursor) params.cursor = opts.cursor;
        const resp = (await apiGet(
          `/brain-updates/${updateId}`,
          params,
        )) as Record<string, unknown>;
        const data = unwrapResp(resp) as Record<string, unknown>;
        const pagination = (resp.pagination || {}) as Record<string, unknown>;

        if (isJsonMode(brain)) {
          jsonOut({ ...data, pagination });
          return;
        }

        const update = (data.update || data) as Record<string, unknown>;
        const replies = ((data.replies as unknown[]) || []) as Record<string, unknown>[];

        const author =
          ((update.author as Record<string, unknown>)?.name as string) ||
          `User ${update.authorId}`;
        const vault =
          ((update.vault as Record<string, unknown>)?.vaultSlug as string) || "?";

        const replyLines: string[] = [];
        for (const r of replies) {
          const rAuthor =
            ((r.author as Record<string, unknown>)?.name as string) ||
            `User ${r.authorId}`;
          const text = r.content as string;
          const truncated =
            opts.full || text.length <= 200 ? text : text.slice(0, 200) + "\u2026";
          replyLines.push(`  - ${rAuthor}: ${truncated} (${r.createdAt})`);
        }

        const output = [
          `Brain Update: ${update.title || "(no title)"}`,
          `By: ${author} (vault: ${vault}) on ${update.createdAt}`,
          "",
          update.content as string,
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

  brain
    .command("reply-to-update <updateId>")
    .description("Reply to a brain update.")
    .requiredOption(
      "--content <content>",
      'Reply content (markdown supported, use "-" for stdin)',
    )
    .action(async (updateId: string, opts: { content: string }) => {
      const content = opts.content === "-" ? readFileSync("/dev/stdin", "utf8") : opts.content;
      const resp = (await apiPost(
        `/brain-updates/${updateId}/replies`,
        { content },
      )) as Record<string, unknown>;
      const reply = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(brain)) {
        jsonOut(reply);
        return;
      }

      console.log(
        `Reply created!\n  ID: ${reply.id}\n  Created: ${reply.createdAt}`,
      );
    });

  brain
    .command("edit-update-reply <replyId>")
    .description("Edit a brain update reply. You must be the author.")
    .requiredOption(
      "--content <content>",
      "New content for the reply (markdown supported)",
    )
    .action(async (replyId: string, opts: { content: string }) => {
      const resp = (await apiPatch(
        `/brain-updates/replies/${replyId}`,
        { content: opts.content },
      )) as Record<string, unknown>;
      const reply = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(brain)) {
        jsonOut(reply);
        return;
      }

      console.log(
        `Reply edited!\n  ID: ${reply.id}\n  Edited: ${reply.editedAt}`,
      );
    });

  brain
    .command("delete-update-reply <replyId>")
    .description("Delete a brain update reply. You must be the author.")
    .action(async (replyId: string) => {
      await apiDelete(`/brain-updates/replies/${replyId}`);

      if (isJsonMode(brain)) {
        jsonOut({ replyId });
        return;
      }

      console.log(`Brain update reply ${replyId} deleted.`);
    });
}
