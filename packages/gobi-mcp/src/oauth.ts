/**
 * OAuth 2.1 for the remote MCP (phase 2).
 * See src/oauth/* and docs/BACKEND_ENDPOINTS.md.
 */

export { OAUTH_STATUS, createOAuthStack, createOAuthRouter, protectedResourceMetadata, authorizationServerMetadata, verifyBearerWithAdapter } from "./oauth/http.js";
export { GobiAuthAdapter, OAuthError } from "./oauth/gobi-adapter.js";
export { WorkOSAdapter } from "./oauth/workos-adapter.js";
export { MemoryOAuthStore } from "./oauth/store.js";
export { generateCodeVerifier, s256Challenge, verifyS256 } from "./oauth/pkce.js";
export type { AuthServerAdapter, AuthorizeRequest, IssuedToken, RegisteredClient } from "./oauth/types.js";
