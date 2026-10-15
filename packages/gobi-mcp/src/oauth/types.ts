/**
 * Pluggable OAuth 2.1 authorization-server surface for the remote MCP.
 *
 * GobiAuthAdapter implements this with local DCR/PKCE plus Gobi's existing
 * connect-token / refresh /auth/me endpoints.
 * WorkOSAdapter delegates authorize+token to WorkOS User Management, then
 * maps the WorkOS user onto a Gobi token via POST /auth/workos/exchange
 * (documented TODO — mocked in tests).
 */

export interface RegisteredClient {
  client_id: string;
  client_secret?: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  createdAt: number;
}

export interface AuthorizationCode {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  gobiAccessToken: string;
  gobiRefreshToken?: string;
  scope: string;
  expiresAt: number;
}

export interface IssuedToken {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  scope: string;
  gobiAccessToken: string;
  gobiRefreshToken?: string;
  clientId: string;
  expiresAt: number;
}

export interface AuthorizeRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  state?: string;
  scope?: string;
  /** Headless proof of a Gobi session (gbi_ connect token or access token). */
  gobiToken?: string;
  resource?: string;
}

export interface TokenRequest {
  grantType: "authorization_code" | "refresh_token";
  code?: string;
  codeVerifier?: string;
  redirectUri?: string;
  refreshToken?: string;
  clientId: string;
  clientSecret?: string;
}

export interface AuthServerAdapter {
  readonly id: "gobi" | "workos";
  registerClient(input: {
    client_name?: string;
    redirect_uris: string[];
    token_endpoint_auth_method?: string;
    grant_types?: string[];
    response_types?: string[];
  }): Promise<RegisteredClient>;
  authorize(req: AuthorizeRequest): Promise<{ code: string; state?: string }>;
  token(req: TokenRequest): Promise<IssuedToken>;
  introspect(token: string): Promise<IssuedToken | null>;
}

export function mcpPublicUrl(): string {
  return (process.env.GOBI_MCP_PUBLIC_URL || "https://mcp.gobispace.com").replace(/\/$/, "");
}

export function mcpResourceUrl(): string {
  return `${mcpPublicUrl()}/mcp`;
}

export function oauthIssuer(): string {
  return mcpPublicUrl();
}
