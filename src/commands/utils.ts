import { Command } from "commander";
import { getSpaceSlug, getVaultSlug } from "./init.js";

export function isJsonMode(cmd: Command): boolean {
  return !!cmd.parent?.opts().json;
}

export function jsonOut(data: unknown): void {
  console.log(JSON.stringify({ success: true, data }));
}

export function resolveSpaceSlug(cmd: Command): string {
  return cmd.opts().spaceSlug || getSpaceSlug();
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
