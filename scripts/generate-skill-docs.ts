import { execSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const SKILLS_DIR = join(PROJECT_ROOT, "skills");

// Read version from package.json
const require = createRequire(import.meta.url);
const { version } = require(join(PROJECT_ROOT, "package.json")) as {
  version: string;
};

// Use the built dist/index.js so this works in CI without global install
const GOBI_BIN = join(PROJECT_ROOT, "dist", "index.js");

if (!existsSync(GOBI_BIN)) {
  console.error(
    "Error: dist/index.js not found. Run 'npm run build' first."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Skill → command group mapping
// ---------------------------------------------------------------------------

interface SkillConfig {
  dir: string;
  /** Top-level command names that belong to this skill */
  commands: string[];
  /**
   * For commands where only some subcommands belong to this skill.
   * e.g. "space" has "list" and "warp" in gobi-core, rest in gobi-space.
   */
  subcommands?: Record<string, string[]>;
}

const SKILL_MAP: SkillConfig[] = [
  {
    dir: "gobi-core",
    commands: ["auth", "update"],
    subcommands: {
      space: ["list", "warp"],
    },
  },
  {
    dir: "gobi-space",
    commands: ["global", "personal"],
    subcommands: {
      space: [
        "get",
        "list-topics",
        "list-topic-posts",
        "feed",
        "get-post",
        "list-posts",
        "create-post",
        "edit-post",
        "delete-post",
        "create-reply",
        "edit-reply",
        "delete-reply",
      ],
    },
  },
  {
    dir: "gobi-vault",
    commands: ["vault"],
  },
  {
    dir: "gobi-media",
    commands: ["media"],
  },
  {
    dir: "gobi-sense",
    commands: ["sense"],
  },
  {
    dir: "gobi-artifact",
    commands: ["artifact"],
  },
];

/**
 * Skills that have no command-group ownership but still carry a version field
 * in their frontmatter — version-stamp only, no reference regeneration.
 */
const VERSION_ONLY_SKILLS = ["gobi-homepage"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runHelp(args: string[]): string {
  const cmd = `node ${GOBI_BIN} ${args.join(" ")} --help`;
  return execSync(cmd, {
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1" },
    timeout: 10_000,
  }).trim();
}

interface CommandInfo {
  name: string;
  description: string;
}

function parseCommands(helpText: string): CommandInfo[] {
  const commands: CommandInfo[] = [];
  const lines = helpText.split("\n");
  let inCommands = false;

  for (const line of lines) {
    if (line.trim() === "Commands:") {
      inCommands = true;
      continue;
    }
    if (inCommands) {
      const match = line.match(/^\s{2,}(\S+)\s+.*?\s{2,}(.+)$/);
      if (match) {
        const [, name, desc] = match;
        if (name !== "help") {
          commands.push({ name, description: desc.trim() });
        }
      } else if (line.trim() === "") {
        break;
      } else if (commands.length > 0 && line.match(/^\s{10,}\S/)) {
        commands[commands.length - 1].description += " " + line.trim();
      }
    }
  }

  return commands;
}

/**
 * Filter the `Commands:` section of a `--help` text to only include the named
 * subcommands. Preserves the `help [command]` row. Keeps the rest of the help
 * (Usage, parent-level Options, etc.) intact so partial-owner skills still see
 * the parent flags like `--space-slug`.
 */
function filterCommandsSection(helpText: string, ownedSubs: string[]): string {
  const lines = helpText.split("\n");
  const out: string[] = [];
  let inCommands = false;
  let keepingCurrentRow = false;
  const owned = new Set(ownedSubs);

  for (const line of lines) {
    if (line.trim() === "Commands:") {
      inCommands = true;
      out.push(line);
      continue;
    }
    if (inCommands) {
      if (line.trim() === "") {
        inCommands = false;
        keepingCurrentRow = false;
        out.push(line);
        continue;
      }
      // Continuation line of the row above: deeply indented, no double-space gap.
      const isContinuation = /^\s{10,}\S/.test(line);
      if (isContinuation) {
        if (keepingCurrentRow) out.push(line);
        continue;
      }
      // New row: "  <name>  <description>".
      const rowMatch = line.match(/^\s{2,}(\S+)\s/);
      if (rowMatch) {
        const name = rowMatch[1];
        keepingCurrentRow = name === "help" || owned.has(name);
        if (keepingCurrentRow) out.push(line);
        continue;
      }
    }
    out.push(line);
  }

  return out.join("\n");
}

function generateReferenceDoc(
  commandPath: string[],
  helpText: string,
  subcommands: { name: string; helpText: string }[],
  ownsFullCommand: boolean
): string {
  const lines: string[] = [];
  const fullCommand = ["gobi", ...commandPath].join(" ");

  lines.push(`# ${fullCommand}`);
  lines.push("");
  lines.push("```");
  if (ownsFullCommand) {
    lines.push(helpText);
  } else {
    lines.push(filterCommandsSection(helpText, subcommands.map((s) => s.name)));
  }
  lines.push("```");

  for (const sub of subcommands) {
    lines.push("");
    lines.push(`## ${sub.name}`);
    lines.push("");
    lines.push("```");
    lines.push(sub.helpText);
    lines.push("```");
  }

  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// 1. Get top-level commands
const topHelp = runHelp([]);
const topCommands = parseCommands(topHelp);

// 2. For each top-level command, get its help and subcommands
interface CommandData {
  name: string;
  description: string;
  helpText: string;
  subCommands: CommandInfo[];
  subHelpTexts: { name: string; helpText: string }[];
}

const allCommandData: CommandData[] = [];

for (const cmd of topCommands) {
  let cmdHelp: string;
  try {
    cmdHelp = runHelp([cmd.name]);
  } catch {
    cmdHelp = cmd.description;
  }

  const subCommands = parseCommands(cmdHelp);
  const subHelpTexts: { name: string; helpText: string }[] = [];

  for (const sub of subCommands) {
    try {
      const subHelp = runHelp([cmd.name, sub.name]);
      subHelpTexts.push({ name: sub.name, helpText: subHelp });
    } catch {
      // Skip commands that fail
    }
  }

  allCommandData.push({
    name: cmd.name,
    description: cmd.description,
    helpText: cmdHelp,
    subCommands,
    subHelpTexts,
  });
}

// 3. Generate per-skill reference docs and update SKILL.md
for (const skill of SKILL_MAP) {
  const skillDir = join(SKILLS_DIR, skill.dir);
  const refsDir = join(skillDir, "references");
  const templatePath = join(skillDir, "SKILL.md");

  // Ensure references directory exists and clean it
  if (!existsSync(refsDir)) {
    mkdirSync(refsDir, { recursive: true });
  }
  for (const file of readdirSync(refsDir)) {
    if (file.endsWith(".md")) {
      unlinkSync(join(refsDir, file));
    }
  }

  const commandLines: string[] = [];
  const referenceFiles: { name: string; path: string; title: string }[] = [];

  for (const cmdData of allCommandData) {
    const ownsFullCommand = skill.commands?.includes(cmdData.name);
    const ownsSubcommands = skill.subcommands?.[cmdData.name];

    if (!ownsFullCommand && !ownsSubcommands) continue;

    if (ownsFullCommand) {
      // This skill owns the entire command group
      commandLines.push(
        `- \`gobi ${cmdData.name}\` — ${cmdData.description}`
      );
      for (const sub of cmdData.subHelpTexts) {
        const subInfo = cmdData.subCommands.find((s) => s.name === sub.name);
        if (subInfo) {
          commandLines.push(
            `  - \`gobi ${cmdData.name} ${sub.name}\` — ${subInfo.description}`
          );
        }
      }

      // Write full reference doc
      const refContent = generateReferenceDoc(
        [cmdData.name],
        cmdData.helpText,
        cmdData.subHelpTexts,
        true
      );
      const refFile = `${cmdData.name}.md`;
      writeFileSync(join(refsDir, refFile), refContent);
      referenceFiles.push({
        name: refFile,
        path: `references/${refFile}`,
        title: `gobi ${cmdData.name}`,
      });
    } else if (ownsSubcommands) {
      // This skill owns specific subcommands of this command group
      const filteredSubs = cmdData.subHelpTexts.filter((s) =>
        ownsSubcommands.includes(s.name)
      );

      for (const sub of filteredSubs) {
        const subInfo = cmdData.subCommands.find((s) => s.name === sub.name);
        if (subInfo) {
          commandLines.push(
            `- \`gobi ${cmdData.name} ${sub.name}\` — ${subInfo.description}`
          );
        }
      }

      // Write filtered reference doc
      if (filteredSubs.length > 0) {
        const refContent = generateReferenceDoc(
          [cmdData.name],
          cmdData.helpText,
          filteredSubs,
          false
        );
        const refFile = `${cmdData.name}.md`;
        writeFileSync(join(refsDir, refFile), refContent);
        referenceFiles.push({
          name: refFile,
          path: `references/${refFile}`,
          title: `gobi ${cmdData.name}`,
        });
      }
    }
  }

  // Update SKILL.md — stamp current version, then replace {{VERSION}}, {{COMMANDS}}, {{REFERENCE_TOC}}
  if (existsSync(templatePath)) {
    let template = readFileSync(templatePath, "utf-8");
    // YAML frontmatter: `  version: "X.Y.Z"` → current version
    template = template.replace(
      /^(\s*version:\s*)"[^"]*"/m,
      `$1"${version}"`
    );
    // Inline body version mentions like "(v2.0.9)" or "(v{{VERSION}})" → current
    template = template.replace(
      /\(v\d+\.\d+\.\d+\)/g,
      `(v${version})`
    );
    template = template.replace(/\{\{VERSION\}\}/g, version);

    // Replace the commands section between "## Available Commands" and the next "##"
    // by finding {{COMMANDS}} placeholder if present
    if (template.includes("{{COMMANDS}}")) {
      template = template.replace("{{COMMANDS}}", commandLines.join("\n"));
    }

    if (template.includes("{{REFERENCE_TOC}}")) {
      const refToc = referenceFiles
        .map((ref) => `- [${ref.title}](${ref.path})`)
        .join("\n");
      template = template.replace("{{REFERENCE_TOC}}", refToc);
    }

    writeFileSync(templatePath, template);
  }

  console.log(
    `[${skill.dir}] Generated ${referenceFiles.length} reference files, ${commandLines.length} command entries`
  );
}

for (const skillDir of VERSION_ONLY_SKILLS) {
  const templatePath = join(SKILLS_DIR, skillDir, "SKILL.md");
  if (!existsSync(templatePath)) continue;
  let template = readFileSync(templatePath, "utf-8");
  template = template.replace(
    /^(\s*version:\s*)"[^"]*"/m,
    `$1"${version}"`
  );
  template = template.replace(/\(v\d+\.\d+\.\d+\)/g, `(v${version})`);
  writeFileSync(templatePath, template);
  console.log(`[${skillDir}] Stamped version only`);
}

console.log(`\nDone. Version: v${version}`);
