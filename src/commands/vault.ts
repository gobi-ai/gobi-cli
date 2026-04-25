import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Command } from "commander";
import { apiGet, apiPost } from "../client.js";
import { WEBDRIVE_BASE_URL } from "../constants.js";
import { getValidToken } from "../auth/manager.js";
import { getVaultSlug } from "./init.js";
import { isJsonMode, jsonOut, unwrapResp } from "./utils.js";

export function registerVaultCommand(program: Command): void {
  const vaultCmd = program
    .command("vault")
    .description("Vault commands. A Vault is your personal knowledge container — search public vaults, ask them questions, and publish your BRAIN.md profile.");

  // ── Search ──

  vaultCmd
    .command("search")
    .description(
      "Search public vaults by text and semantic similarity.",
    )
    .requiredOption("--query <query>", "Search query")
    .action(async (opts: { query: string }) => {
      const resp = (await apiGet(`/vault/public/search`, {
        query: opts.query,
      })) as Record<string, unknown>;
      const results = (
        Array.isArray(resp) ? resp : (resp.data as unknown[]) || resp
      ) as Record<string, unknown>[];

      if (isJsonMode(vaultCmd)) {
        jsonOut(results || []);
        return;
      }

      if (!results || results.length === 0) {
        console.log(`No vaults found matching "${opts.query}".`);
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
      console.log(`Vaults matching "${opts.query}":\n` + lines.join("\n"));
    });

  // ── Ask ──

  vaultCmd
    .command("ask")
    .description(
      "Ask a vault a question. Creates a targeted session (1:1 conversation).",
    )
    .requiredOption(
      "--vault-slug <vaultSlug>",
      "Slug of the vault to ask",
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

        if (isJsonMode(vaultCmd)) {
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
  // Note: file is still named BRAIN.md on webdrive — the post-processing pipeline
  // (gobi-webdrive) hardcodes the filename. Rename the file here once that ships.

  vaultCmd
    .command("publish")
    .description(
      "Upload BRAIN.md to the vault root on webdrive. Triggers post-processing (vault sync, metadata update, Discord notification).",
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

      if (isJsonMode(vaultCmd)) {
        jsonOut({ vaultId });
        return;
      }

      console.log(`Published BRAIN.md to vault "${vaultId}"`);
    });

  // ── Unpublish ──

  vaultCmd
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

      if (isJsonMode(vaultCmd)) {
        jsonOut({ vaultId });
        return;
      }

      console.log(`Deleted BRAIN.md from vault "${vaultId}"`);
    });
}
