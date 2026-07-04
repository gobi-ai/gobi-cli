import { createRequire } from "module";
import { Command } from "commander";
import { initCredentials } from "./auth/manager.js";
import { ApiError, GobiError } from "./errors.js";
import { registerAuthCommand } from "./commands/auth.js";
import {
  commandRequiresSpace,
  commandRequiresVault,
  readSettings,
} from "./commands/init.js";
import { registerSpaceCommand } from "./commands/space.js";
import { registerGlobalCommand } from "./commands/global.js";
import { registerPersonalCommand } from "./commands/personal.js";
import { registerVaultCommand } from "./commands/vault.js";
import { registerUpdateCommand } from "./commands/update.js";
import { registerMediaCommand } from "./commands/media.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

function hasParentOption(cmd: Command, key: string): boolean {
  let cur: Command | null | undefined = cmd;
  while (cur) {
    const v = (cur.opts() as Record<string, unknown>)[key];
    if (v !== undefined && v !== "" && v !== false) return true;
    cur = cur.parent;
  }
  return false;
}

function maybePrintRequirementWarnings(actionCommand: Command): void {
  const needsVault = commandRequiresVault(actionCommand);
  const needsSpace = commandRequiresSpace(actionCommand);
  if (!needsVault && !needsSpace) return;

  const settings = readSettings();
  const hasVault = !!settings?.vaultSlug;
  const hasSpace = !!settings?.selectedSpaceSlug;
  const vaultOverride = hasParentOption(actionCommand, "vaultSlug");
  const spaceOverride = hasParentOption(actionCommand, "spaceSlug");

  const warnings: string[] = [];
  if (needsVault && !hasVault && !vaultOverride) {
    warnings.push("Vault not set. Run 'gobi vault init' first, or pass --vault-slug.");
  }
  if (needsSpace && !hasSpace && !spaceOverride) {
    warnings.push(
      "Space not set. Run 'gobi space warp' first, or pass --space-slug.",
    );
  }
  if (warnings.length) {
    for (const w of warnings) console.log(w);
    console.log("");
  }
}

export async function cli(): Promise<void> {
  const program = new Command();

  program
    .name("gobi")
    .version(version)
    .description("CLI client for the Gobi collaborative knowledge platform")
    .option("--json", "Output results as JSON instead of human-readable text")
    .configureHelp({ helpWidth: process.stdout.columns || 200 });

  // Register all command groups
  registerAuthCommand(program);
  registerSpaceCommand(program);
  registerGlobalCommand(program);
  registerPersonalCommand(program);
  registerVaultCommand(program);
  registerUpdateCommand(program);
  registerMediaCommand(program);
  // Artifact, activities, and conversations subcommands live under `gobi space`
  // and `gobi personal` (registered by those groups), not as top-level groups.

  // Propagate helpWidth to all subcommands
  const helpWidth = process.stdout.columns || 200;
  for (const cmd of program.commands) {
    cmd.configureHelp({ helpWidth });
    for (const sub of cmd.commands) {
      sub.configureHelp({ helpWidth });
    }
  }

  // Hook into the pre-action to init credentials and show requirement warnings
  program.hook("preAction", async (_thisCommand, actionCommand) => {
    await initCredentials();

    if (!program.opts().json) {
      maybePrintRequirementWarnings(actionCommand);
    }
  });

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const isJson = program.opts().json;
    if (err instanceof ApiError) {
      if (isJson) {
        console.log(JSON.stringify({ success: false, error: `API error (HTTP ${err.status}): ${err.message}` }));
        process.exit(1);
      }
      let hint = "";
      if (err.status === 403) {
        hint = " You may not have permission to perform this action.";
      } else if (err.status === 404) {
        hint = " The requested resource was not found.";
      }
      console.error(`Error: API error (HTTP ${err.status}): ${err.message}${hint}`);
      process.exit(1);
    } else if (err instanceof GobiError) {
      if (isJson) {
        console.log(JSON.stringify({ success: false, error: err.message }));
        process.exit(1);
      }
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (isJson) {
      console.log(JSON.stringify({ success: false, error: msg }));
    } else {
      console.error(`Error: ${msg}`);
    }
    process.exit(1);
  }
}
