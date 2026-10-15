import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import type { GobiApi } from "./gobi-client.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import { registerGobiPrompts } from "./prompts.js";
import { registerGobiResources } from "./resources.js";
import { registerGobiTools } from "./tools.js";

/** Register tools/resources/prompts on an existing MCP server instance. */
export function configureGobiMcpServer(server: McpServer, api: GobiApi): void {
  registerGobiTools(server, api);
  registerGobiResources(server, api);
  registerGobiPrompts(server);
}

export const SERVER_NAME = "gobi";

export function packageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.1.0";
  }
}

export function createGobiMcpServer(api: GobiApi): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: packageVersion(),
      title: "Gobi",
      description:
        "Read-only Gobi MCP: personal context, notes, activities, and Sense captures. No space or write tools.",
      websiteUrl: "https://gobispace.com",
    },
    { instructions: SERVER_INSTRUCTIONS },
  );
  configureGobiMcpServer(server, api);
  return server;
}
