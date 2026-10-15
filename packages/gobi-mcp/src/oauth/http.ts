import { GobiAuthAdapter, OAuthError } from "./gobi-adapter.js";
import { MemoryOAuthStore } from "./store.js";
import { WorkOSAdapter } from "./workos-adapter.js";
import { mcpPublicUrl, mcpResourceUrl, oauthIssuer, type AuthServerAdapter } from "./types.js";
import type { AuthInfo } from "@modelcontextprotocol/server";

export const OAUTH_STATUS = "implemented" as const;

export function createOAuthStack(opts?: {
  adapter?: AuthServerAdapter;
  store?: MemoryOAuthStore;
  fetch?: typeof fetch;
  baseUrl?: string;
}): { store: MemoryOAuthStore; adapter: AuthServerAdapter } {
  const store = opts?.store ?? new MemoryOAuthStore();
  if (opts?.adapter) return { store, adapter: opts.adapter };
  const kind = (process.env.GOBI_MCP_AUTH_ADAPTER || "gobi").toLowerCase();
  const adapter =
    kind === "workos"
      ? new WorkOSAdapter(store, { fetch: opts?.fetch, baseUrl: opts?.baseUrl })
      : new GobiAuthAdapter(store, { fetch: opts?.fetch, baseUrl: opts?.baseUrl });
  return { store, adapter };
}

export function protectedResourceMetadata() {
  const resource = mcpResourceUrl();
  const issuer = oauthIssuer();
  return {
    resource,
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: ["gobi:read", "gobi:write"],
    resource_documentation: `${mcpPublicUrl()}/docs`,
  };
}

export function authorizationServerMetadata() {
  const issuer = oauthIssuer();
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    introspection_endpoint: `${issuer}/oauth/introspect`,
    code_challenge_methods_supported: ["S256"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    response_types_supported: ["code"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: ["gobi:read", "gobi:write"],
    dpop_signing_alg_values_supported: [],
    client_id_metadata_document_supported: false,
  };
}

function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  cors(headers);
  return new Response(JSON.stringify(data), { status, headers });
}

function cors(headers: Headers): void {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

export function oauthPreflight(): Response {
  const headers = new Headers();
  cors(headers);
  return new Response(null, { status: 204, headers });
}

async function readBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = (await req.json()) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v != null) out[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
    return out;
  }
  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text));
}

function oauthErrorResponse(err: unknown): Response {
  if (err instanceof OAuthError) {
    return json({ error: err.error, error_description: err.error_description }, err.status);
  }
  const message = err instanceof Error ? err.message : String(err);
  return json({ error: "server_error", error_description: message }, 500);
}

export function createOAuthRouter(adapter: AuthServerAdapter) {
  return async function oauthRouter(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    if (req.method === "OPTIONS" && (path.startsWith("/oauth") || path.startsWith("/.well-known"))) {
      return oauthPreflight();
    }

    if (path === "/.well-known/oauth-protected-resource") {
      return json(protectedResourceMetadata());
    }
    if (path === "/.well-known/oauth-authorization-server") {
      return json(authorizationServerMetadata());
    }

    if (path === "/oauth/register" && req.method === "POST") {
      try {
        const body = (await req.json()) as {
          client_name?: string;
          redirect_uris?: string[];
          token_endpoint_auth_method?: string;
          grant_types?: string[];
          response_types?: string[];
        };
        const client = await adapter.registerClient({
          client_name: body.client_name,
          redirect_uris: body.redirect_uris ?? [],
          token_endpoint_auth_method: body.token_endpoint_auth_method,
          grant_types: body.grant_types,
          response_types: body.response_types,
        });
        return json(client, 201);
      } catch (err) {
        return oauthErrorResponse(err);
      }
    }

    if (path === "/oauth/authorize") {
      try {
        const params =
          req.method === "GET"
            ? Object.fromEntries(url.searchParams)
            : await readBody(req);
        const result = await adapter.authorize({
          clientId: params.client_id || params.clientId,
          redirectUri: params.redirect_uri || params.redirectUri,
          codeChallenge: params.code_challenge || params.codeChallenge,
          codeChallengeMethod: "S256",
          state: params.state,
          scope: params.scope,
          gobiToken: params.gobi_token || params.gobiToken,
          resource: params.resource,
        });
        if (req.method === "GET" && (params.redirect_uri || params.redirectUri)) {
          const redir = new URL(params.redirect_uri || params.redirectUri);
          redir.searchParams.set("code", result.code);
          if (result.state) redir.searchParams.set("state", result.state);
          const headers = new Headers({ Location: redir.toString() });
          cors(headers);
          return new Response(null, { status: 302, headers });
        }
        return json(result);
      } catch (err) {
        if (err instanceof OAuthError && err.error === "login_required" && req.method === "GET") {
          return new Response(loginHtml(url), {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
        return oauthErrorResponse(err);
      }
    }

    if (path === "/oauth/token" && req.method === "POST") {
      try {
        const params = await readBody(req);
        const issued = await adapter.token({
          grantType: (params.grant_type as "authorization_code" | "refresh_token") || "authorization_code",
          code: params.code,
          codeVerifier: params.code_verifier || params.codeVerifier,
          redirectUri: params.redirect_uri || params.redirectUri,
          refreshToken: params.refresh_token || params.refreshToken,
          clientId: params.client_id || params.clientId,
          clientSecret: params.client_secret || params.clientSecret,
        });
        return json({
          access_token: issued.accessToken,
          refresh_token: issued.refreshToken,
          token_type: issued.tokenType,
          expires_in: issued.expiresIn,
          scope: issued.scope,
        });
      } catch (err) {
        return oauthErrorResponse(err);
      }
    }

    if (path === "/oauth/introspect" && req.method === "POST") {
      const params = await readBody(req);
      const token = params.token;
      const issued = token ? await adapter.introspect(token) : null;
      if (!issued) return json({ active: false });
      return json({
        active: true,
        scope: issued.scope,
        client_id: issued.clientId,
        exp: Math.floor(issued.expiresAt / 1000),
        token_type: "Bearer",
      });
    }

    return null;
  };
}

function loginHtml(url: URL): string {
  const qs = url.searchParams.toString();
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Gobi MCP authorize</title></head>
<body>
<h1>Connect Gobi</h1>
<p>Paste a <code>gbi_</code> connect token (or access token) from the Gobi app. OAuth login UI on Gobi is a backend TODO.</p>
<form method="POST" action="/oauth/authorize">
${[...url.searchParams.entries()].map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`).join("\n")}
<label>gobi_token <input name="gobi_token" autocomplete="off"></label>
<button type="submit">Authorize</button>
</form>
<p>GET with <code>?${escapeHtml(qs)}&gobi_token=…</code> also works for headless agents.</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export async function verifyBearerWithAdapter(
  adapter: AuthServerAdapter,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  const token = bearerToken?.trim();
  if (!token) return undefined;
  const issued = await adapter.introspect(token);
  if (issued) {
    return {
      token: issued.gobiAccessToken,
      clientId: issued.clientId,
      scopes: issued.scope.split(/\s+/).filter(Boolean),
      extra: { mcpToken: token },
    };
  }
  // Phase 0-1 compatibility: raw gbi_ / Gobi access token as Bearer.
  return {
    token,
    clientId: "gobi-bearer",
    scopes: ["gobi:read"],
  };
}
