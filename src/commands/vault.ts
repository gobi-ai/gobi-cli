import { existsSync, readFileSync } from "fs";
import { join, resolve as pathResolve } from "path";
import { Command } from "commander";
import { WEB_BASE_URL, WEBDRIVE_BASE_URL } from "../constants.js";
import { getValidToken } from "../auth/manager.js";
import { GobiError } from "../errors.js";
import { apiDelete, apiGet, apiPatch, apiPost } from "../client.js";
import { getVaultSlug, requireVault, runVaultInitFlow } from "./init.js";
import { isJsonMode, jsonOut, unwrapResp } from "./utils.js";
import { runSync, ConflictStrategy } from "./sync.js";

export const PUBLISH_FILENAME = "PUBLISH.md";

export function registerVaultCommand(program: Command): void {
  const vault = program
    .command("vault")
    .description("Vault commands (init, list, publish/unpublish profile, sync files).");

  vault
    .command("init")
    .description(
      "Select or create the vault for the current directory. Writes .gobi/settings.yaml and seeds PUBLISH.md.",
    )
    .action(async () => {
      await runVaultInitFlow();
    });

  vault
    .command("create <slug>")
    .description(
      "Create a new vault. <slug> must be unique (use 'gobi vault list' to see existing slugs); --name sets the display name. Does not change the configured vault — run 'gobi vault init' afterwards if you want to anchor to it.",
    )
    .requiredOption("--name <name>", "Display name for the new vault")
    .action(async (slug: string, opts: { name: string }) => {
      const resp = (await apiPost("/vault", {
        vaultId: slug,
        name: opts.name,
      })) as Record<string, unknown>;
      const v = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(vault)) {
        jsonOut(v);
        return;
      }

      console.log(`Created vault "${v.name}" [${v.vaultId}].`);
    });

  vault
    .command("rename <newName>")
    .description(
      "Rename a vault. Defaults to the configured vault (.gobi/settings.yaml); pass --vault-slug to target another. Does not affect PUBLISH.md frontmatter (which controls the public profile title) — this is the local display name only.",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Vault slug to rename (defaults to .gobi/settings.yaml)",
    )
    .action(async (newName: string, opts: { vaultSlug?: string }) => {
      const slug = opts.vaultSlug ?? getVaultSlug();
      const resp = (await apiPatch(`/vault/${slug}`, {
        name: newName,
      })) as Record<string, unknown>;
      const v = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(vault)) {
        jsonOut(v);
        return;
      }

      console.log(`Renamed vault [${slug}] to "${v.name}".`);
    });

  vault
    .command("delete <slug>")
    .description(
      "Delete a vault. Irreversible. Slug must be passed explicitly (no .gobi fallback). The API will reject if the vault still owns content; clean up posts, members, and files first.",
    )
    .action(async (slug: string) => {
      await apiDelete(`/vault/${slug}`);

      if (isJsonMode(vault)) {
        jsonOut({ vaultSlug: slug });
        return;
      }

      console.log(`Deleted vault [${slug}].`);
    });

  vault
    .command("list")
    .description("List vaults you own.")
    .action(async () => {
      const resp = (await apiGet("/vaults")) as unknown;
      const items = (
        Array.isArray(resp)
          ? resp
          : Array.isArray((resp as Record<string, unknown>)?.data)
            ? ((resp as Record<string, unknown>).data as unknown[])
            : []
      ) as Record<string, unknown>[];

      if (isJsonMode(vault)) {
        jsonOut(items);
        return;
      }

      if (!items.length) {
        console.log("No vaults found.");
        return;
      }

      const lines: string[] = [];
      for (const v of items) {
        const slug = (v.vaultId || v.slug) as string;
        lines.push(`- [${slug}] ${v.name}`);
      }
      console.log(`Vaults (${items.length}):\n` + lines.join("\n"));
    });

  const statusCmd = vault
    .command("status")
    .description(
      "Show the configured vault's publish state and metadata (use before authoring a markdown artifact with --auto-attachments to confirm the vault is public).",
    )
    .option(
      "--vault-slug <vaultSlug>",
      "Vault slug to inspect (defaults to .gobi/settings.yaml)",
    )
    .action(async (opts: { vaultSlug?: string }) => {
      const slug = opts.vaultSlug ?? getVaultSlug();
      const resp = (await apiGet("/vaults")) as unknown;
      const items = (
        Array.isArray(resp)
          ? resp
          : Array.isArray((resp as Record<string, unknown>)?.data)
            ? ((resp as Record<string, unknown>).data as unknown[])
            : []
      ) as Record<string, unknown>[];
      const v = items.find((x) => (x.vaultId || x.slug) === slug);
      if (!v) {
        throw new GobiError(
          `Vault "${slug}" not found among vaults you own.`,
          "VAULT_NOT_FOUND",
        );
      }

      const isPublished = v.public === true;
      const profileUrl = `${WEB_BASE_URL}/@${slug}`;
      const status = {
        vaultSlug: slug,
        name: v.name,
        isPublished,
        title: v.title ?? null,
        description: v.description ?? null,
        tags: v.tags ?? null,
        thumbnailPath: v.thumbnailPath ?? null,
        homepagePath: v.homepagePath ?? null,
        promptPath: v.promptPath ?? null,
        totalNumberOfFiles: v.totalNumberOfFiles ?? 0,
        totalSizeOfFiles: v.totalSizeOfFiles ?? 0,
        lastUpdatedTime: v.lastUpdatedTime ?? null,
        profileUrl: isPublished ? profileUrl : null,
      };

      if (isJsonMode(vault)) {
        jsonOut(status);
        return;
      }

      const lines = [
        `Vault: [${slug}] ${v.name}`,
        `  Published: ${isPublished ? "yes" : "no"}`,
      ];
      if (!isPublished) {
        lines.push(
          `  Note: not yet public. Run 'gobi vault publish' to make it discoverable at ${profileUrl}.`,
        );
      } else {
        lines.push(`  URL: ${profileUrl}`);
      }
      if (v.title) lines.push(`  Title: ${v.title}`);
      if (v.description) lines.push(`  Description: ${v.description}`);
      if (Array.isArray(v.tags) && v.tags.length)
        lines.push(`  Tags: ${(v.tags as string[]).join(", ")}`);
      if (v.thumbnailPath) lines.push(`  Thumbnail: ${v.thumbnailPath}`);
      if (v.homepagePath) lines.push(`  Homepage: ${v.homepagePath}`);
      if (v.promptPath) lines.push(`  Prompt: ${v.promptPath}`);
      lines.push(`  Files: ${v.totalNumberOfFiles ?? 0}`);
      console.log(lines.join("\n"));
    });
  requireVault(statusCmd);

  const publishCmd = vault
    .command("publish")
    .description(
      `Upload ${PUBLISH_FILENAME} to the vault root on webdrive. Triggers post-processing (vault sync, metadata update).`,
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
  requireVault(publishCmd);

  const unpublishCmd = vault
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
  requireVault(unpublishCmd);

  const syncCmd = vault
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
        jsonMode: isJsonMode(vault),
      });
    });
  requireVault(syncCmd);
}
