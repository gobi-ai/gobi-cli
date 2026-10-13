import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const GENERATED_START_SUFFIX = ":START -->";
export const GENERATED_END_SUFFIX = ":END -->";

export const AGENTS_COMMAND_INDEX_MARK = "GENERATED-COMMAND-INDEX";
export const MUSE_COMMAND_MAP_MARK = "GENERATED-COMMAND-MAP";

export interface CommandNode {
  name: string;
  description: string;
  children: Record<string, CommandNode>;
}

/** Behavior → CLI path. Descriptions come from `--help` at generate time. */
export const MUSE_COMMAND_MAP: { action: string; argv: string[] }[] = [
  {
    action: "Confirm auth / who you are acting as",
    argv: ["auth", "status"],
  },
  {
    action: "Catch-up and people/time questions: recent notes",
    argv: ["personal", "notes", "list"],
  },
  {
    action: "Open one note (summary, speakerLabel, transcript turns)",
    argv: ["personal", "notes", "get"],
  },
  {
    action: "Catch-up and time questions: recent activities",
    argv: ["personal", "activities", "list"],
  },
  {
    action: "Open one activity",
    argv: ["personal", "activities", "get"],
  },
  {
    action: "Fresh Sense output landing (`capture_note` / `capture_activity`)",
    argv: ["notifications", "list"],
  },
];

export function markerComment(name: string, end = false): string {
  return `<!-- ${name}${end ? GENERATED_END_SUFFIX : GENERATED_START_SUFFIX}`;
}

export function runHelp(gobiBin: string, args: string[]): string {
  const cmd = `node ${gobiBin} ${args.join(" ")} --help`;
  return execSync(cmd, {
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1" },
    timeout: 10_000,
  }).trim();
}

export function parseCommands(helpText: string): { name: string; description: string }[] {
  const commands: { name: string; description: string }[] = [];
  const lines = helpText.split("\n");
  let inCommands = false;

  for (const line of lines) {
    if (line.trim() === "Commands:") {
      inCommands = true;
      continue;
    }
    if (inCommands) {
      // Commander: "  name|alias [options] <arg>   description"
      const match = line.match(
        /^\s{2,}(\S+?)(?:\s+\[[^\]]+\]|\s+<[^>]+>)*\s{2,}(.+)$/,
      );
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

function firstSentence(description: string): string {
  const flat = description.replace(/\s+/g, " ").trim();
  const cut = flat.search(/(?<=\.)\s/);
  return (cut === -1 ? flat : flat.slice(0, cut + 1)).trim();
}

export function collectCommandTree(gobiBin: string): CommandNode {
  if (!existsSync(gobiBin)) {
    throw new Error(`CLI binary not found at ${gobiBin}. Run npm run build first.`);
  }

  const attach = (parent: CommandNode, listedName: string, node: CommandNode) => {
    for (const alias of listedName.split("|").filter(Boolean)) {
      parent.children[alias] = node;
    }
  };

  const walk = (path: string[], primary: string, description: string): CommandNode => {
    const help = runHelp(gobiBin, path);
    const node: CommandNode = { name: primary, description, children: {} };
    for (const child of parseCommands(help)) {
      const childPrimary = child.name.split("|")[0] ?? child.name;
      attach(node, child.name, walk([...path, childPrimary], childPrimary, child.description));
    }
    return node;
  };

  const rootHelp = runHelp(gobiBin, []);
  const root: CommandNode = { name: "gobi", description: "", children: {} };
  for (const child of parseCommands(rootHelp)) {
    const primary = child.name.split("|")[0] ?? child.name;
    attach(root, child.name, walk([primary], primary, child.description));
  }
  return root;
}

export function lookupPath(root: CommandNode, argv: string[]): CommandNode | null {
  let node = root;
  for (const part of argv) {
    const next = node.children[part];
    if (!next) return null;
    node = next;
  }
  return node;
}

export function renderAgentsCommandIndex(root: CommandNode): string {
  const lines: string[] = [
    "Generated from `gobi --help` by `npm run generate-skill-docs`. Do not edit by hand.",
    "",
  ];

  const seenTop = new Set<CommandNode>();
  for (const top of Object.values(root.children)) {
    if (seenTop.has(top)) continue;
    seenTop.add(top);
    lines.push(`### \`gobi ${top.name}\``);
    lines.push("");
    const walk = (node: CommandNode, path: string[]) => {
      const seen = new Set<CommandNode>();
      const children = Object.values(node.children).filter((c) => {
        if (seen.has(c)) return false;
        seen.add(c);
        return true;
      });
      if (children.length === 0) {
        lines.push(`- \`gobi ${path.join(" ")}\` — ${firstSentence(node.description)}`);
        return;
      }
      // Groups that are themselves invokable (agents, notifications, notes).
      if (node.description) {
        lines.push(`- \`gobi ${path.join(" ")}\` — ${firstSentence(node.description)}`);
      }
      for (const child of children) {
        walk(child, [...path, child.name]);
      }
    };
    walk(top, [top.name]);
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function renderMuseCommandMap(root: CommandNode): string {
  const lines: string[] = [
    "Generated from `gobi --help` by `npm run generate-skill-docs`. Do not edit by hand.",
    "",
    "| Action | Command |",
    "|--------|---------|",
  ];

  for (const row of MUSE_COMMAND_MAP) {
    const node = lookupPath(root, row.argv);
    if (!node) {
      throw new Error(
        `MUSE_COMMAND_MAP path does not exist: gobi ${row.argv.join(" ")}`,
      );
    }
    const cmd = `gobi --json ${row.argv.join(" ")}`;
    lines.push(`| ${row.action} | \`${cmd}\` |`);
  }

  return lines.join("\n") + "\n";
}

export function replaceGeneratedSection(
  filePath: string,
  mark: string,
  body: string,
): void {
  const src = readFileSync(filePath, "utf-8");
  const start = markerComment(mark);
  const end = markerComment(mark, true);
  const startIdx = src.indexOf(start);
  const endIdx = src.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`${filePath} is missing ${start} / ${end} markers`);
  }
  const next =
    src.slice(0, startIdx + start.length) +
    "\n\n" +
    body.trimEnd() +
    "\n\n" +
    src.slice(endIdx);
  if (next !== src) writeFileSync(filePath, next);
}

const BOOLEAN_FLAGS = new Set([
  "--json",
  "--full",
  "--mine",
  "--unread",
  "--mentions",
  "--all",
  "--check",
  "--upload-only",
  "--download-only",
  "--dry-run",
  "--execute",
  "--auto-attachments",
  "--no-link-previews",
  "--all-channels",
  "--version",
  "-V",
  "-h",
  "--help",
]);

function tokenizeInvocation(raw: string): string[] {
  return raw
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function isPlaceholder(token: string): boolean {
  return (
    /^<[^>]+>$/.test(token) ||
    /^\[[^\]]+\]$/.test(token) ||
    token === "…" ||
    token === "..." ||
    /^gbi_/.test(token) ||
    /^[porvndcu][0-9a-z]{6,}$/i.test(token)
  );
}

/**
 * Drop `gobi`, flags (and their values), and placeholders. Remaining words
 * are the subcommand path. `foo|bar` expands to one path per side.
 */
export function invocationPaths(raw: string): string[][] {
  const tokens = tokenizeInvocation(raw);
  if (tokens[0] !== "gobi") return [];

  const paths: string[][] = [[]];
  let i = 1;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.startsWith("-")) {
      const flag = t.split("=")[0];
      i += 1;
      if (
        !BOOLEAN_FLAGS.has(flag) &&
        !t.includes("=") &&
        i < tokens.length &&
        !tokens[i].startsWith("-")
      ) {
        i += 1;
      }
      continue;
    }
    if (isPlaceholder(t) || t.startsWith("(") || t.endsWith(")") || t === "|") {
      i += 1;
      continue;
    }
    if (t.includes("|")) {
      const sides = t.split("|").map((s) => s.replace(/^[`'"]+|[`'"]+$/g, ""));
      const next: string[][] = [];
      for (const path of paths) {
        for (const side of sides) {
          if (side && !isPlaceholder(side)) next.push([...path, side]);
        }
      }
      paths.splice(0, paths.length, ...next);
      i += 1;
      continue;
    }
    const word = t.replace(/^[`'"]+|[`'"]+$/g, "").replace(/[.,;:]$/, "");
    if (!word || isPlaceholder(word)) {
      i += 1;
      continue;
    }
    for (const path of paths) path.push(word);
    i += 1;
  }
  return paths;
}

function extractInvocations(markdown: string): string[] {
  const found = new Set<string>();

  for (const m of markdown.matchAll(/`([^`]+)`/g)) {
    const inner = m[1].trim();
    if (inner === "gobi" || inner.startsWith("gobi ")) found.add(inner);
  }

  const fenceRe = /```(?:sh|bash|shell)?\n([\s\S]*?)```/g;
  for (const m of markdown.matchAll(fenceRe)) {
    for (const line of m[1].split("\n")) {
      const trimmed = line.replace(/^\s*(?:\$\s*)?/, "").replace(/\s+#.*$/, "");
      if (/^gobi(?:\s|$)/.test(trimmed)) found.add(trimmed.trim());
    }
  }

  return [...found];
}

export function validateMarkdownCommands(
  markdown: string,
  root: CommandNode,
  fileLabel: string,
): string[] {
  const errors: string[] = [];
  for (const inv of extractInvocations(markdown)) {
    if (inv === "gobi") continue;
    const paths = invocationPaths(inv);
    if (paths.length === 0) continue;
    for (const path of paths) {
      if (path.length === 0) continue; // `gobi --version` / `gobi --json`
      if (path[0] === "…" || path[0] === "...") continue;
      let node: CommandNode | null = root;
      const walked: string[] = [];
      for (const part of path) {
        if (part === "…" || part === "...") {
          node = null;
          break;
        }
        if (!node.children[part]) {
          errors.push(
            `${fileLabel}: unknown command \`gobi ${[...walked, part].join(" ")}\` (from \`${inv}\`)`,
          );
          node = null;
          break;
        }
        walked.push(part);
        node = node.children[part];
      }
    }
  }
  return errors;
}

export function syncAgentCommandDocs(
  projectRoot: string,
  gobiBin: string,
): void {
  const root = collectCommandTree(gobiBin);
  const agentsPath = join(projectRoot, "AGENTS.md");
  const musePath = join(projectRoot, "MUSE.md");

  replaceGeneratedSection(agentsPath, AGENTS_COMMAND_INDEX_MARK, renderAgentsCommandIndex(root));
  replaceGeneratedSection(musePath, MUSE_COMMAND_MAP_MARK, renderMuseCommandMap(root));

  const errors = [
    ...validateMarkdownCommands(readFileSync(agentsPath, "utf-8"), root, "AGENTS.md"),
    ...validateMarkdownCommands(readFileSync(musePath, "utf-8"), root, "MUSE.md"),
  ];
  if (errors.length) {
    throw new Error(
      `Command references do not match \`gobi --help\`:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }
}
