import { readFileSync } from "fs";
import { Command } from "commander";
import { apiGet } from "../client.js";
import { getSpaceSlug, getVaultSlug } from "./init.js";

export interface DraftSummary {
  draftId: string;
  title: string;
  content: string;
  vaultSlug: string | null;
}

// Fetch a draft and return just the fields a post-creation flow needs. Used
// by `space create-post` and `global create-post` when --draft-id is passed:
// title/content come from the draft, vaultSlug seeds the post's authorship
// when the caller did not pass --vault-slug.
export async function fetchDraftSummary(draftId: string): Promise<DraftSummary> {
  const resp = (await apiGet(`/app/drafts/${draftId}`)) as Record<string, unknown>;
  const data = unwrapResp(resp) as Record<string, unknown>;
  return {
    draftId: String(data.draftId ?? draftId),
    title: String(data.title ?? ""),
    content: String(data.content ?? ""),
    vaultSlug: (data.vaultSlug as string | null | undefined) ?? null,
  };
}

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
