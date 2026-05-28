import { readFileSync } from "fs";
import { Command } from "commander";
import { getSpaceSlug, getVaultSlug } from "./init.js";

// Reads all of stdin synchronously. Uses fd 0 (cross-platform) instead of
// "/dev/stdin", which doesn't exist on Windows.
export function readStdin(): string {
  return readFileSync(0, "utf8");
}

export function isJsonMode(cmd: Command): boolean {
  return !!cmd.parent?.opts().json;
}

export function jsonOut(data: unknown): void {
  console.log(JSON.stringify({ success: true, data }));
}

// Resolves the space slug from (in order): the leaf subcommand's --space-slug
// option, the parent `gobi space` command's --space-slug option, then
// `.gobi/settings.yaml`. Either side of the subcommand works:
//   gobi space --space-slug foo list-posts   (parent-level)
//   gobi space list-posts --space-slug foo   (leaf-level)
export function resolveSpaceSlug(
  parent: Command,
  leafOpts?: { spaceSlug?: string },
): string {
  return leafOpts?.spaceSlug || parent.opts().spaceSlug || getSpaceSlug();
}

export function resolveVaultSlug(opts: { vaultSlug?: string }): string {
  return opts.vaultSlug || getVaultSlug();
}

export function unwrapResp(resp: unknown): unknown {
  if (typeof resp === "object" && resp !== null && "data" in resp) {
    return (resp as Record<string, unknown>).data;
  }
  return resp;
}
