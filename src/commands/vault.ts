import { existsSync, readFileSync } from "fs";
import { join, resolve as pathResolve } from "path";
import { Command } from "commander";
import { WEBDRIVE_BASE_URL } from "../constants.js";
import { getValidToken } from "../auth/manager.js";
import { GobiError } from "../errors.js";
import { getVaultSlug } from "./init.js";
import { isJsonMode, jsonOut } from "./utils.js";
import { runSync, ConflictStrategy } from "./sync.js";

export const PUBLISH_FILENAME = "PUBLISH.md";

export function registerVaultCommand(program: Command): void {
  const vault = program
    .command("vault")
    .description("Vault commands (publish/unpublish profile, sync files).");

  vault
    .command("publish")
    .description(
      `Upload ${PUBLISH_FILENAME} to the vault root on webdrive. Triggers post-processing (vault sync, metadata update, Discord notification).`,
    )
    .action(async () => {
      const vaultId = getVaultSlug();
      const filePath = join(process.cwd(), PUBLISH_FILENAME);
      if (!existsSync(filePath)) {
        throw new Error(`${PUBLISH_FILENAME} not found in ${process.cwd()}`);
      }

      const content = readFileSync(filePath, "utf-8");
      const token = await getValidToken();
      const url = `${WEBDRIVE_BASE_URL}/api/v1/vaults/${vaultId}/file/${PUBLISH_FILENAME}`;
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

      if (isJsonMode(vault)) {
        jsonOut({ vaultId });
        return;
      }

      console.log(`Published ${PUBLISH_FILENAME} to vault "${vaultId}"`);
    });

  vault
    .command("unpublish")
    .description(`Delete ${PUBLISH_FILENAME} from the vault on webdrive.`)
    .action(async () => {
      const vaultId = getVaultSlug();
      const token = await getValidToken();
      const url = `${WEBDRIVE_BASE_URL}/api/v1/vaults/${vaultId}/file/${PUBLISH_FILENAME}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(
          `Delete failed: HTTP ${res.status}: ${(await res.text()) || "(no body)"}`,
        );
      }

      if (isJsonMode(vault)) {
        jsonOut({ vaultId });
        return;
      }

      console.log(`Deleted ${PUBLISH_FILENAME} from vault "${vaultId}"`);
    });

  vault
    .command("sync")
    .description("Sync local vault files with Gobi Webdrive.")
    .option("--upload-only", "Only upload local changes to server")
    .option("--download-only", "Only download server changes to local")
    .option(
      "--conflict <strategy>",
      "Conflict resolution strategy: ask|server|client|skip",
      "ask",
    )
    .option("--dir <path>", "Local vault directory (default: current directory)")
    .option("--dry-run", "Preview changes without making them")
    .option("--full", "Full sync: ignore cursor and hash cache, re-check every file")
    .option(
      "--path <path>",
      "Restrict sync to a specific file or folder (repeatable)",
      (v: string, prev: string[]) => prev.concat(v),
      [] as string[],
    )
    .option(
      "--plan-file <path>",
      "Write dry-run plan to file (use with --dry-run) or read plan to execute (use with --execute)",
    )
    .option("--execute", "Execute a previously written plan file (requires --plan-file)")
    .option(
      "--conflict-choices <json>",
      "Per-file conflict resolutions as JSON object, e.g. '{\"file.md\":\"server\"}' (use with --execute)",
    )
    .action(async function (
      this: Command,
      opts: {
        uploadOnly?: boolean;
        downloadOnly?: boolean;
        conflict: string;
        dir?: string;
        dryRun?: boolean;
        full?: boolean;
        path?: string[];
        planFile?: string;
        execute?: boolean;
        conflictChoices?: string;
      },
    ) {
      if (opts.uploadOnly && opts.downloadOnly) {
        throw new GobiError(
          "--upload-only and --download-only are mutually exclusive.",
          "INVALID_OPTION",
        );
      }
      if (opts.execute && !opts.planFile) {
        throw new GobiError("--execute requires --plan-file", "INVALID_OPTION");
      }
      const validStrategies = ["ask", "server", "client", "skip"];
      if (!validStrategies.includes(opts.conflict)) {
        throw new GobiError(
          `Invalid --conflict value "${opts.conflict}". Use: ask|server|client|skip`,
          "INVALID_OPTION",
        );
      }
      let conflictChoices: Record<string, "server" | "client"> | undefined;
      if (opts.conflictChoices) {
        try {
          conflictChoices = JSON.parse(opts.conflictChoices);
        } catch {
          throw new GobiError("--conflict-choices must be valid JSON", "INVALID_OPTION");
        }
      }
      const vaultSlug = getVaultSlug();
      const dir = opts.dir ? pathResolve(opts.dir) : process.cwd();

      await runSync({
        vaultSlug,
        dir,
        uploadOnly: !!opts.uploadOnly,
        downloadOnly: !!opts.downloadOnly,
        conflict: opts.conflict as ConflictStrategy,
        dryRun: !!opts.dryRun,
        full: !!opts.full,
        paths: opts.path ?? [],
        planFile: opts.planFile,
        execute: !!opts.execute,
        conflictChoices,
        jsonMode: isJsonMode(this),
      });
    });
}
