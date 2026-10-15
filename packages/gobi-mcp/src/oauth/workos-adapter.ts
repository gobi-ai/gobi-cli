import { gobiBaseUrl } from "../gobi-client.js";
import { GobiAuthAdapter, OAuthError } from "./gobi-adapter.js";
import { randomToken, verifyS256 } from "./pkce.js";
import type { MemoryOAuthStore } from "./store.js";
import type { AuthServerAdapter, AuthorizeRequest, IssuedToken, TokenRequest } from "./types.js";

/**
 * WorkOS User Management adapter.
 *
 * Authorize/token talk to WorkOS when WORKOS_CLIENT_ID / WORKOS_API_KEY are set.
 * Mapping WorkOS → Gobi is POST /auth/workos/exchange (TODO on the Gobi backend);
 * tests inject a mock of that call.
 */
export class WorkOSAdapter implements AuthServerAdapter {
  readonly id = "workos" as const;
  private readonly inner: GobiAuthAdapter;

  constructor(
    readonly store: MemoryOAuthStore,
    readonly opts?: {
      fetch?: typeof fetch;
      baseUrl?: string;
      workosApiBase?: string;
      workosClientId?: string;
      workosApiKey?: string;
      workosClientSecret?: string;
    },
  ) {
    this.inner = new GobiAuthAdapter(store, { fetch: opts?.fetch, baseUrl: opts?.baseUrl });
  }

  registerClient(input: Parameters<AuthServerAdapter["registerClient"]>[0]) {
    return this.inner.registerClient(input);
  }

  async authorize(req: AuthorizeRequest): Promise<{ code: string; state?: string }> {
    // Headless tests / gbi_ still go through Gobi. Browser WorkOS is a redirect
    // the HTTP layer issues when gobi_token is absent and WorkOS is configured.
    if (req.gobiToken) return this.inner.authorize(req);
    throw new OAuthError(
      "login_required",
      "WorkOS authorize requires a browser redirect to WorkOS or a gobi_token for headless clients",
    );
  }

  async token(req: TokenRequest): Promise<IssuedToken> {
    if (req.grantType === "authorization_code" && req.code?.startsWith("workos_")) {
      return this.exchangeWorkosCode(req);
    }
    return this.inner.token(req);
  }

  introspect(token: string) {
    return this.inner.introspect(token);
  }

  workosAuthorizeUrl(params: {
    redirectUri: string;
    state?: string;
    codeChallenge: string;
  }): string {
    const clientId = this.opts?.workosClientId || process.env.WORKOS_CLIENT_ID;
    if (!clientId) {
      throw new OAuthError("server_error", "WORKOS_CLIENT_ID is not configured", 500);
    }
    const base = this.opts?.workosApiBase ?? "https://api.workos.com";
    const url = new URL("/user_management/authorize", base);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("provider", "authkit");
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    if (params.state) url.searchParams.set("state", params.state);
    return url.toString();
  }

  /**
   * After WorkOS returns a code, authenticate with WorkOS then map to Gobi.
   * `code` here is the WorkOS authorization code, not our gobi_ac_ code.
   */
  async completeWorkosLogin(input: {
    workosCode: string;
    codeVerifier: string;
    codeChallenge: string;
    clientId: string;
    redirectUri: string;
    scope?: string;
  }): Promise<{ code: string }> {
    if (!verifyS256(input.codeVerifier, input.codeChallenge)) {
      throw new OAuthError("invalid_grant", "PKCE verification failed");
    }
    const workosToken = await this.authenticateWorkos(input.workosCode, input.codeVerifier);
    const gobiAccessToken = await this.exchangeWorkosForGobi(workosToken);
    return this.inner.authorize({
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: "S256",
      gobiToken: gobiAccessToken,
      scope: input.scope,
    });
  }

  private async exchangeWorkosCode(req: TokenRequest): Promise<IssuedToken> {
    if (!req.code || !req.codeVerifier || !req.redirectUri) {
      throw new OAuthError("invalid_request", "code, code_verifier, redirect_uri required");
    }
    const workosToken = await this.authenticateWorkos(req.code.replace(/^workos_/, ""), req.codeVerifier);
    const gobiAccessToken = await this.exchangeWorkosForGobi(workosToken);
    const client = this.store.getClient(req.clientId);
    if (!client) throw new OAuthError("invalid_client", "unknown client_id");
    const issued: IssuedToken = {
      accessToken: randomToken("gobi_mcp_"),
      refreshToken: randomToken("gobi_rt_"),
      tokenType: "Bearer",
      expiresIn: 3600,
      scope: "gobi:read",
      gobiAccessToken,
      clientId: req.clientId,
      expiresAt: Date.now() + 3600_000,
    };
    this.store.putToken(issued);
    return issued;
  }

  private async authenticateWorkos(code: string, codeVerifier: string): Promise<string> {
    const fetchImpl = this.opts?.fetch ?? globalThis.fetch;
    const base = this.opts?.workosApiBase ?? "https://api.workos.com";
    const res = await fetchImpl(`${base}/user_management/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.opts?.workosApiKey || process.env.WORKOS_API_KEY || ""}`,
      },
      body: JSON.stringify({
        client_id: this.opts?.workosClientId || process.env.WORKOS_CLIENT_ID,
        client_secret: this.opts?.workosClientSecret || process.env.WORKOS_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        code_verifier: codeVerifier,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new OAuthError("invalid_grant", `WorkOS authenticate failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new OAuthError("invalid_grant", "WorkOS returned no access_token");
    return data.access_token;
  }

  /** TODO backend: POST /auth/workos/exchange. Mocked in tests. */
  private async exchangeWorkosForGobi(workosAccessToken: string): Promise<string> {
    const fetchImpl = this.opts?.fetch ?? globalThis.fetch;
    const base = this.opts?.baseUrl ?? gobiBaseUrl();
    const res = await fetchImpl(`${base}/auth/workos/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workosAccessToken }),
    });
    if (!res.ok) {
      throw new OAuthError(
        "server_error",
        `Gobi POST /auth/workos/exchange failed (${res.status}). Backend TODO — see docs/BACKEND_ENDPOINTS.md`,
        502,
      );
    }
    const data = (await res.json()) as { accessToken?: string };
    if (!data.accessToken) throw new OAuthError("server_error", "workos exchange returned no accessToken", 502);
    return data.accessToken;
  }
}
