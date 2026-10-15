/**
 * Streamable HTTP transport for Vercel (`mcp-handler`), meant to be mounted
 * at mcp.gobispace.com/mcp. Auth is bearer `gbi_` (or any Gobi access token)
 * for phase 0–1. OAuth is a later phase — see oauth.ts.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { staticBearer, type TokenProvider } from "./auth.js";
import { createGobiApi, NotAuthenticatedError } from "./gobi-client.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import { OAUTH_STATUS } from "./oauth.js";
import { configureGobiMcpServer, packageVersion, SERVER_NAME } from "./server.js";

export { OAUTH_STATUS };

const requestAuth = new AsyncLocalStorage<TokenProvider>();

function requestBoundApi() {
  return createGobiApi({
    async getToken() {
      const provider = requestAuth.getStore();
      if (!provider) throw new NotAuthenticatedError();
      return provider.getToken();
    },
  });
}

export async function verifyGobiBearer(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  const token = bearerToken?.trim();
  if (!token) return undefined;
  return {
    token,
    clientId: "gobi-bearer",
    scopes: ["gobi:read"],
  };
}

/**
 * Fetch handler for Streamable HTTP. Missing/invalid bearer tokens 401.
 * The request's bearer is threaded into Gobi API calls via AsyncLocalStorage.
 */
export function createGobiHttpHandler() {
  const api = requestBoundApi();
  const mcp = createMcpHandler(
    (server) => {
      configureGobiMcpServer(server, api);
    },
    {
      instructions: SERVER_INSTRUCTIONS,
      serverInfo: {
        name: SERVER_NAME,
        version: packageVersion(),
      },
    },
  );

  const authed = withMcpAuth(mcp, verifyGobiBearer, {
    required: true,
    requiredScopes: ["gobi:read"],
    // TODO(phase 2): serve real protected-resource metadata when OAuth lands.
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
  });

  return async (req: Request): Promise<Response> => {
    const header = req.headers.get("authorization");
    const token = header?.replace(/^Bearer\s+/i, "").trim() ?? "";
    return requestAuth.run(staticBearer(token), () => authed(req));
  };
}
