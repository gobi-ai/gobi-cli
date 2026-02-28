import { createRequire } from "module";
import { Command } from "commander";
import { initCredentials } from "./auth/manager.js";
import { ApiError, AstraError } from "./errors.js";
import { registerAuthCommand } from "./commands/auth.js";
import { registerInitCommand, printContext } from "./commands/init.js";
import { registerAstraCommand } from "./commands/astra.js";
import { registerBrainCommand } from "./commands/brain.js";
import { registerSessionsCommand } from "./commands/sessions.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const SKIP_BANNER_COMMANDS = new Set(["auth", "init"]);

function shouldShowBanner(): boolean {
  const args = process.argv.slice(2);
  if (args.length === 0) return true;
  return !SKIP_BANNER_COMMANDS.has(args[0]);
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
  registerInitCommand(program);
  registerAstraCommand(program);
  registerBrainCommand(program);
  registerSessionsCommand(program);

  // Propagate helpWidth to all subcommands
  const helpWidth = process.stdout.columns || 200;
  for (const cmd of program.commands) {
    cmd.configureHelp({ helpWidth });
    for (const sub of cmd.commands) {
      sub.configureHelp({ helpWidth });
    }
  }

  // Hook into the pre-action to init credentials and show banner
  program.hook("preAction", async () => {
    await initCredentials();

    if (!program.opts().json && shouldShowBanner()) {
      printContext();
      console.log("");
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
    } else if (err instanceof AstraError) {
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
