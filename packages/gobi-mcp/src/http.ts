/**
 * Streamable HTTP + OAuth 2.1 + REST /v1 for Vercel.
 * Default URL: https://mcp.gobispace.com/mcp
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { staticBearer, type TokenProvider } from "./auth.js";
import { createGobiApi, NotAuthenticatedError } from "./gobi-client.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import {
  createOAuthRouter,
  createOAuthStack,
  OAUTH_STATUS,
  verifyBearerWithAdapter,
} from "./oauth.js";
import type { AuthServerAdapter } from "./oauth/types.js";
import type { GobiMcpOptions } from "./options.js";
import { createRestRouter } from "./rest.js";
import { configureGobiMcpServer, SERVER_NAME } from "./server.js";
import { packageVersion } from "./version.js";

export { OAUTH_STATUS };

const requestAuth = new AsyncLocalStorage<TokenProvider>();

export interface HttpHandlerOptions extends GobiMcpOptions {
  adapter?: AuthServerAdapter;
  api?: ReturnType<typeof createGobiApi>;
  /** Gobi API origin (tests inject the mock backend). */
  baseUrl?: string;
  fetch?: typeof fetch;
}

function requestBoundApi(opts?: { baseUrl?: string; fetch?: typeof fetch }) {
  return createGobiApi({
    async getToken() {
      const provider = requestAuth.getStore();
      if (!provider) throw new NotAuthenticatedError();
      return provider.getToken();
    },
    baseUrl: opts?.baseUrl,
    fetch: opts?.fetch,
  });
}

export async function verifyGobiBearer(req: Request, bearerToken?: string) {
  const { adapter } = getStack();
  return verifyBearerWithAdapter(adapter, bearerToken);
}

let stack: ReturnType<typeof createOAuthStack> | null = null;

function getStack(opts?: HttpHandlerOptions) {
  if (opts?.adapter) return createOAuthStack({ adapter: opts.adapter });
  stack ??= createOAuthStack();
  return stack;
}

/**
 * Fetch handler: OAuth well-known + /oauth/*, REST /v1, MCP /mcp.
 */
export function createGobiHttpHandler(opts?: HttpHandlerOptions) {
  const { adapter } = getStack(opts);
  const api = opts?.api ?? requestBoundApi({ baseUrl: opts?.baseUrl, fetch: opts?.fetch });
  const oauth = createOAuthRouter(adapter);
  const rest = createRestRouter(api, opts);

  const mcp = createMcpHandler(
    (server) => {
      configureGobiMcpServer(server, api, opts);
    },
    {
      instructions: SERVER_INSTRUCTIONS,
      serverInfo: {
        name: SERVER_NAME,
        version: packageVersion(),
      },
    },
  );

  const authedMcp = withMcpAuth(mcp, (req, token) => verifyBearerWithAdapter(adapter, token), {
    required: true,
    requiredScopes: ["gobi:read"],
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
  });

  return async (req: Request): Promise<Response> => {
    const oauthRes = await oauth(req);
    if (oauthRes) return oauthRes;

    const header = req.headers.get("authorization");
    const raw = header?.replace(/^Bearer\s+/i, "").trim() ?? "";
    const info = await verifyBearerWithAdapter(adapter, raw || undefined);
    const gobiToken = info?.token ?? raw;

    return requestAuth.run(staticBearer(gobiToken), async () => {
      const restRes = await rest(req);
      if (restRes) return restRes;
      return authedMcp(req);
    });
  };
}

let singleton: ((req: Request) => Promise<Response>) | null = null;

export function getGobiHttpHandler(): (req: Request) => Promise<Response> {
  singleton ??= createGobiHttpHandler();
  return singleton;
}
