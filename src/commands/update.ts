import { execSync } from "child_process";
import { createRequire } from "module";
import { Command } from "commander";

const require = createRequire(import.meta.url);
const { version: currentVersion } = require("../../package.json") as {
  version: string;
};

async function fetchLatestVersion(): Promise<string> {
  const res = await fetch("https://registry.npmjs.org/@gobi-ai/cli/latest");
  if (!res.ok) {
    throw new Error(`Failed to check for updates: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { version: string };
  return data.version;
}

// `which` is Unix-only; Windows uses `where`. `where` may print multiple
// matches on separate lines — take the first one.
function locateGobi(): string | null {
  const cmd = process.platform === "win32" ? "where gobi" : "which gobi";
  try {
    const out = execSync(cmd, { encoding: "utf-8" }).trim();
    return out.split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

function detectInstallMethod(): "npm" | "brew" | "unknown" {
  const gobiBin = locateGobi();
  if (gobiBin && (gobiBin.includes("/Cellar/") || gobiBin.includes("/homebrew/"))) {
    return "brew";
  }
  try {
    const npmGlobalDir = execSync("npm root -g", { encoding: "utf-8" }).trim();
    if (gobiBin && gobiBin.includes(npmGlobalDir.replace("/lib/node_modules", ""))) {
      return "npm";
    }
  } catch {
    // ignore
  }
  return "npm"; // default to npm
}

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Update gobi-cli to the latest version.")
    .option("--check", "Only check for updates without installing")
    .action(async (opts: { check?: boolean }) => {
      const latestVersion = await fetchLatestVersion();

      if (currentVersion === latestVersion) {
        console.log(`Already up to date (v${currentVersion}).`);
        return;
      }

      console.log(`Current version: v${currentVersion}`);
      console.log(`Latest version:  v${latestVersion}`);

      if (opts.check) {
        console.log(
          "\nRun 'gobi update' to install the latest version.",
        );
        return;
      }

      const method = detectInstallMethod();
      console.log(`\nUpdating via ${method}...`);

      try {
        if (method === "brew") {
          execSync("brew upgrade gobi", { stdio: "inherit" });
        } else {
          execSync("npm install -g @gobi-ai/cli@latest", {
            stdio: "inherit",
          });
        }
        console.log(`\nSuccessfully updated to v${latestVersion}.`);
      } catch {
        console.error(
          "\nUpdate failed. Try manually:\n" +
            (method === "brew"
              ? "  brew upgrade gobi"
              : "  npm install -g @gobi-ai/cli@latest"),
        );
        process.exit(1);
      }
    });
}
