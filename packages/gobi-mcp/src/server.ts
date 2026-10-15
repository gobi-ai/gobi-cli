import { McpServer } from "@modelcontextprotocol/server";
import type { GobiApi } from "./gobi-client.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import type { GobiMcpOptions } from "./options.js";
import { registerGobiPrompts } from "./prompts.js";
import { registerGobiResources } from "./resources.js";
import { registerGobiTools } from "./tools.js";
import { packageVersion, SERVER_NAME } from "./version.js";

export { packageVersion, SERVER_NAME };

/** Register tools/resources/prompts on an existing MCP server instance. */
export function configureGobiMcpServer(server: McpServer, api: GobiApi, opts?: GobiMcpOptions): void {
  registerGobiTools(server, api, opts);
  registerGobiResources(server, api);
  registerGobiPrompts(server);
}

export function createGobiMcpServer(api: GobiApi, opts?: GobiMcpOptions): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: packageVersion(),
      title: "Gobi",
      description:
        "Gobi MCP: personal context, notes, activities, Sense captures, notes search and People directory. Space/write tools are opt-in.",
      websiteUrl: "https://gobispace.com",
    },
    { instructions: SERVER_INSTRUCTIONS },
  );
  configureGobiMcpServer(server, api, opts);
  return server;
}
