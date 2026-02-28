import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Command } from "commander";
import { apiGet, apiPost, apiPatch, apiDelete } from "../client.js";
import { WEBDRIVE_BASE_URL } from "../constants.js";
import { getValidToken } from "../auth/manager.js";
import { getVaultSlug } from "./init.js";
import { isJsonMode, jsonOut, resolveVaultSlug, unwrapResp } from "./utils.js";

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
    .requiredOption(
      "--space-slug <spaceSlug>",
      "Space slug where the brain belongs",
    )
    .requiredOption(
      "--question <question>",
      "The question to ask (markdown supported)",
    )
    .option("--mode <mode>", 'Session mode: "auto" or "manual"')
    .action(
      async (opts: {
        vaultSlug: string;
        spaceSlug: string;
        question: string;
        mode?: string;
      }) => {
        const spaceSlug = opts.spaceSlug;
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

      if (isJsonMode(brain)) {
        jsonOut({ vaultId });
        return;
      }

      console.log(`Deleted BRAIN.md from vault "${vaultId}"`);
    });

  // ── Updates (list, post, edit, delete) ──

  brain
    .command("list-updates")
    .description("List recent brain updates for a vault (paginated).")
    .option(
      "--vault-slug <vaultSlug>",
      "Vault slug (overrides .gobi/settings.yaml)",
    )
    .option("--mine", "List only my own brain updates")
    .option("--limit <number>", "Items per page", "20")
    .option("--offset <number>", "Offset for pagination", "0")
    .action(async (opts: { vaultSlug?: string; mine?: boolean; limit: string; offset: string }) => {
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
        offset: parseInt(opts.offset, 10),
      };
      if (opts.mine) params.mine = true;
      if (opts.vaultSlug) params.vaultSlug = opts.vaultSlug;
      const resp = (await apiGet(`/brain-updates`, params)) as Record<string, unknown>;

      if (isJsonMode(brain)) {
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
    .action(async (opts: { vaultSlug?: string; title: string; content: string }) => {
      const vaultSlug = resolveVaultSlug(opts);
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
}
