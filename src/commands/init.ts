import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { Command } from "commander";
import inquirer from "inquirer";
import yaml from "js-yaml";
import { apiGet, apiPost } from "../client.js";
import { isAuthenticated } from "../auth/manager.js";
import { runLoginFlow } from "./auth.js";

const SETTINGS_DIR = ".gobi";
const SETTINGS_FILE = "settings.yaml";

function settingsPath(): string {
  return join(process.cwd(), SETTINGS_DIR, SETTINGS_FILE);
}

export function readSettings(): Record<string, unknown> | null {
  const path = settingsPath();
  if (!existsSync(path)) return null;
  const content = readFileSync(path, "utf-8");
  return yaml.load(content) as Record<string, unknown> | null;
}

export function getSpaceSlug(): string {
  const settings = readSettings();
  const slug = settings?.selectedSpaceSlug as string | undefined;
  if (!slug) {
    throw new Error("Space not set. Run 'gobi space warp' first.");
  }
  return slug;
}

export function getVaultSlug(): string {
  const settings = readSettings();
  const vault = settings?.vaultSlug as string | undefined;
  if (!vault) {
    throw new Error("Not initialized. Run 'gobi init' first.");
  }
  return vault;
}

export function printContext(): void {
  const settings = readSettings();
  const vault = settings?.vaultSlug as string | undefined;
  const space = settings?.selectedSpaceSlug as string | undefined;
  if (!vault && !space) {
    console.log("Run 'gobi init' to set up, then 'gobi space warp' to select a space.");
    return;
  }
  if (!vault) {
    console.log("Vault not set. Run 'gobi init' to set up.");
    return;
  }
  if (!space) {
    console.log(`Vault: ${vault} | Space not set. Run 'gobi space warp' to select a space.`);
    return;
  }
  console.log(`Space: ${space} | Vault: ${vault}`);
}

function ensureSettingsDir(): void {
  const dir = join(process.cwd(), SETTINGS_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function writeSetting(key: string, value: string): void {
  ensureSettingsDir();
  const path = settingsPath();
  const existing = readSettings() || {};
  existing[key] = value;
  writeFileSync(path, yaml.dump(existing, { flowLevel: -1 }), "utf-8");
}

export function writeVaultSetting(vaultId: string): void {
  writeSetting("vaultSlug", vaultId);
}

export function writeSpaceSetting(spaceSlug: string): void {
  writeSetting("selectedSpaceSlug", spaceSlug);
}

export async function selectSpace(): Promise<
  { slug: string; name: string } | null
> {
  const resp = (await apiGet("/spaces")) as Record<string, unknown>;
  const spaces = (
    Array.isArray(resp) ? resp : (resp.data as unknown[]) || resp
  ) as Record<string, unknown>[];

  if (!spaces || spaces.length === 0) {
    throw new Error(
      "You are not a member of any spaces. Join or create a space first.",
    );
  }

  const choices = spaces.map((s) => ({
    name: `${s.name} (${s.slug})`,
    value: s,
  }));
  if (choices.length > 1) {
    choices.push({ name: "Go back", value: null as unknown as Record<string, unknown> });
  }

  const { selected } = await inquirer.prompt([
    {
      type: "list",
      name: "selected",
      message: "Select a space:",
      choices,
    },
  ]);

  if (selected === null) return null;
  return { slug: selected.slug as string, name: selected.name as string };
}

async function selectExistingVault(): Promise<
  { vaultId: string; name: string } | null
> {
  const resp = (await apiGet("/vault")) as Record<string, unknown>;
  const vaults = (
    Array.isArray(resp) ? resp : (resp.data as unknown[]) || resp
  ) as Record<string, unknown>[];

  if (!vaults || vaults.length === 0) {
    console.log("You don't have any vaults yet. Let's create one.");
    return createNewVault();
  }

  const choices = vaults.map((v) => ({
    name: `${v.name} (${v.vaultId})`,
    value: v,
  }));
  choices.push({ name: "Go back", value: null as unknown as Record<string, unknown> });

  const { selected } = await inquirer.prompt([
    {
      type: "list",
      name: "selected",
      message: "Select a vault:",
      choices,
    },
  ]);

  if (selected === null) return null;
  return {
    vaultId: selected.vaultId as string,
    name: selected.name as string,
  };
}

async function createNewVault(): Promise<{ vaultId: string; name: string }> {
  let vaultId: string;

  while (true) {
    const { id } = await inquirer.prompt([
      {
        type: "input",
        name: "id",
        message: "Enter a unique vault ID:",
      },
    ]);

    if (!id.trim()) {
      console.log("Vault ID cannot be empty.");
      continue;
    }

    vaultId = id.trim();

    const resp = (await apiGet(`/vault/check/${vaultId}`)) as Record<
      string,
      unknown
    >;
    const available = typeof resp === "object" && resp !== null
      ? resp.available
      : false;
    if (available) {
      console.log(`ID "${vaultId}" is available!`);
      break;
    } else {
      console.log(`ID "${vaultId}" is already taken. Try another.`);
    }
  }

  const { vaultName } = await inquirer.prompt([
    {
      type: "input",
      name: "vaultName",
      message: "Enter vault name:",
    },
  ]);

  const name = vaultName.trim() || vaultId;

  const resp = (await apiPost("/vault", {
    vaultId,
    name,
  })) as Record<string, unknown>;
  const vault = (
    typeof resp === "object" && resp !== null && "data" in resp
      ? resp.data
      : resp
  ) as Record<string, unknown>;
  console.log(`Created vault "${vault.name}" (${vault.vaultId})`);
  return { vaultId: vault.vaultId as string, name: vault.name as string };
}

export async function runInitFlow(): Promise<void> {
  if (!isAuthenticated()) {
    console.log("Not logged in. Starting login flow...\n");
    await runLoginFlow();
    console.log("");
  }

  // Select or create vault
  let vaultId: string;
  let vaultName: string;
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "How would you like to set up your vault?",
        choices: [
          { name: "Select an existing vault", value: "existing" },
          { name: "Create a new vault", value: "new" },
        ],
      },
    ]);

    if (action === "existing") {
      const result = await selectExistingVault();
      if (result === null) continue;
      vaultId = result.vaultId;
      vaultName = result.name;
    } else {
      const result = await createNewVault();
      vaultId = result.vaultId;
      vaultName = result.name;
    }
    break;
  }

  writeVaultSetting(vaultId);
  console.log(`Vault set to "${vaultName}" (${vaultId})`);
  console.log(`Updated ${SETTINGS_DIR}/${SETTINGS_FILE}`);

  // Create default BRAIN.md if it doesn't exist
  const brainPath = join(process.cwd(), "BRAIN.md");
  if (!existsSync(brainPath)) {
    writeFileSync(
      brainPath,
      `---\ntitle: ${vaultName}\ntags: []\ndescription:\nthumbnail:\nprompt:\n---\n`,
      "utf-8",
    );
    console.log("Created BRAIN.md");
  }
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description(
      "Log in (if needed) and select or create the vault for the current directory.",
    )
    .action(async () => {
      await runInitFlow();
    });
}
