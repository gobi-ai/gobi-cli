import type { GobiApi } from "./gobi-client.js";
import {
  HttpNoteSearch,
  HttpPeopleDirectory,
  type NoteSearch,
  type PeopleDirectory,
} from "./directory.js";

export interface GobiMcpOptions {
  people?: PeopleDirectory;
  noteSearch?: NoteSearch;
  enableSpaceTools?: boolean;
  enableWrites?: boolean;
  spaceSlug?: string;
}

export function resolveDirectories(api: GobiApi, opts?: GobiMcpOptions): {
  people: PeopleDirectory;
  noteSearch: NoteSearch;
} {
  return {
    people: opts?.people ?? new HttpPeopleDirectory(api),
    noteSearch: opts?.noteSearch ?? new HttpNoteSearch(api),
  };
}

export function spaceToolsEnabled(opts?: GobiMcpOptions): boolean {
  if (opts?.enableSpaceTools != null) return opts.enableSpaceTools;
  return process.env.GOBI_MCP_SPACE_TOOLS === "1" || process.env.GOBI_MCP_SPACE_TOOLS === "true";
}

export function writesEnabled(opts?: GobiMcpOptions): boolean {
  if (opts?.enableWrites != null) return opts.enableWrites;
  return process.env.GOBI_MCP_WRITES === "1" || process.env.GOBI_MCP_WRITES === "true";
}
