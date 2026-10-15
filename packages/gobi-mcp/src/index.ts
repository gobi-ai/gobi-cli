#!/usr/bin/env node
/**
 * stdio entry for `npx @gobi-ai/mcp`.
 * Auth: GOBI_API_KEY (bearer or gbi_ connect token) or ~/.gobi/credentials.json.
 */

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { resolveStdioAuth } from "./auth.js";
import { createGobiApi, GobiError } from "./gobi-client.js";
import { createGobiMcpServer } from "./server.js";

async function main(): Promise<void> {
  const { provider } = await resolveStdioAuth();
  const api = createGobiApi({ getToken: () => provider.getToken() });
  serveStdio(() => createGobiMcpServer(api));
}

main().catch((err: unknown) => {
  const message = err instanceof GobiError ? err.message : err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
