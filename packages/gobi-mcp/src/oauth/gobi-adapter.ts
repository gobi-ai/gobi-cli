import { exchangeConnectToken, isGbiToken } from "../auth.js";
import { gobiBaseUrl } from "../gobi-client.js";
import { randomToken, verifyS256 } from "./pkce.js";
import type { MemoryOAuthStore } from "./store.js";
import type {
  AuthServerAdapter,
  AuthorizeRequest,
  IssuedToken,
  RegisteredClient,
  TokenRequest,
} from "./types.js";

const CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TTL_S = 3600;

/**
 * Local OAuth 2.1 AS that proves identity against Gobi's existing auth:
 * `gbi_` connect-token exchange, or a raw Gobi access token.
 * DCR, PKCE, and token minting are local until Gobi hosts /auth/oauth/*.
 */
export class GobiAuthAdapter implements AuthServerAdapter {
  readonly id = "gobi" as const;

  constructor(
    readonly store: MemoryOAuthStore,
    readonly opts?: { fetch?: typeof fetch; baseUrl?: string },
  ) {}

  async registerClient(input: {
    client_name?: string;
    redirect_uris: string[];
    token_endpoint_auth_method?: string;
    grant_types?: string[];
    response_types?: string[];
  }): Promise<RegisteredClient> {
    if (!input.redirect_uris?.length) {
      throw new OAuthError("invalid_client_metadata", "redirect_uris required");
    }
    const client: RegisteredClient = {
      client_id: randomToken("gobi_cli_"),
      client_name: input.client_name ?? "MCP client",
      redirect_uris: input.redirect_uris,
      grant_types: input.grant_types ?? ["authorization_code", "refresh_token"],
      response_types: input.response_types ?? ["code"],
      token_endpoint_auth_method: input.token_endpoint_auth_method ?? "none",
      createdAt: Date.now(),
    };
    this.store.putClient(client);
    return client;
  }

  async authorize(req: AuthorizeRequest): Promise<{ code: string; state?: string }> {
    const client = this.store.getClient(req.clientId);
    if (!client) throw new OAuthError("invalid_client", "unknown client_id");
    if (!client.redirect_uris.includes(req.redirectUri)) {
      throw new OAuthError("invalid_request", "redirect_uri mismatch");
    }
    if (req.codeChallengeMethod !== "S256") {
      throw new OAuthError("invalid_request", "code_challenge_method must be S256");
    }
    if (!req.codeChallenge) throw new OAuthError("invalid_request", "code_challenge required");
    if (!req.gobiToken?.trim()) {
      throw new OAuthError("login_required", "gobi_token required until Gobi hosts /auth/oauth/authorize");
    }

    const gobiAccessToken = await this.resolveGobiToken(req.gobiToken.trim());
    const code = randomToken("gobi_ac_");
    this.store.putCode({
      code,
      clientId: req.clientId,
      redirectUri: req.redirectUri,
      codeChallenge: req.codeChallenge,
      codeChallengeMethod: "S256",
      gobiAccessToken,
      scope: req.scope ?? "gobi:read",
      expiresAt: Date.now() + CODE_TTL_MS,
    });
    return { code, state: req.state };
  }

  async token(req: TokenRequest): Promise<IssuedToken> {
    const client = this.store.getClient(req.clientId);
    if (!client) throw new OAuthError("invalid_client", "unknown client_id");

    if (req.grantType === "authorization_code") {
      if (!req.code || !req.codeVerifier || !req.redirectUri) {
        throw new OAuthError("invalid_request", "code, code_verifier, and redirect_uri required");
      }
      const ac = this.store.takeCode(req.code);
      if (!ac || ac.expiresAt < Date.now()) throw new OAuthError("invalid_grant", "code expired or unknown");
      if (ac.clientId !== req.clientId || ac.redirectUri !== req.redirectUri) {
        throw new OAuthError("invalid_grant", "client/redirect mismatch");
      }
      if (!verifyS256(req.codeVerifier, ac.codeChallenge)) {
        throw new OAuthError("invalid_grant", "PKCE verification failed");
      }
      return this.mint(client.client_id, ac.gobiAccessToken, ac.gobiRefreshToken, ac.scope);
    }

    if (req.grantType === "refresh_token") {
      if (!req.refreshToken) throw new OAuthError("invalid_request", "refresh_token required");
      const prev = this.store.takeRefresh(req.refreshToken);
      if (!prev || prev.clientId !== req.clientId) throw new OAuthError("invalid_grant", "unknown refresh_token");
      return this.mint(prev.clientId, prev.gobiAccessToken, prev.gobiRefreshToken, prev.scope);
    }

    throw new OAuthError("unsupported_grant_type", req.grantType);
  }

  async introspect(token: string): Promise<IssuedToken | null> {
    return this.store.getAccess(token) ?? null;
  }

  private mint(
    clientId: string,
    gobiAccessToken: string,
    gobiRefreshToken: string | undefined,
    scope: string,
  ): IssuedToken {
    const issued: IssuedToken = {
      accessToken: randomToken("gobi_mcp_"),
      refreshToken: randomToken("gobi_rt_"),
      tokenType: "Bearer",
      expiresIn: ACCESS_TTL_S,
      scope,
      gobiAccessToken,
      gobiRefreshToken,
      clientId,
      expiresAt: Date.now() + ACCESS_TTL_S * 1000,
    };
    this.store.putToken(issued);
    return issued;
  }

  private async resolveGobiToken(token: string): Promise<string> {
    if (isGbiToken(token)) {
      try {
        const exchanged = await exchangeConnectToken(token, {
          fetch: this.opts?.fetch,
          baseUrl: this.opts?.baseUrl ?? gobiBaseUrl(),
        });
        return exchanged.accessToken;
      } catch {
        // Long-lived gbi_ API key: use as bearer.
        return token;
      }
    }
    return token;
  }
}

export class OAuthError extends Error {
  constructor(
    readonly error: string,
    readonly error_description: string,
    readonly status = 400,
  ) {
    super(`${error}: ${error_description}`);
    this.name = "OAuthError";
  }
}
