/**
 * TODO(phase 2): MCP OAuth for the hosted server at mcp.gobispace.com.
 *
 * Phase 0–1 authenticates Streamable HTTP with a bearer `gbi_` token
 * (`Authorization: Bearer gbi_…`). OAuth (CIMD / protected-resource metadata)
 * is intentionally not wired yet.
 *
 * When OAuth lands:
 *  - Serve RFC 9728 Protected Resource Metadata at
 *    `/.well-known/oauth-protected-resource` via mcp-handler's
 *    `protectedResourceHandler`, listing Gobi's authorization server.
 *  - Point `withMcpAuth` `resourceMetadataPath` at that document.
 *  - Replace `verifyGobiBearer` with JWT / introspection against that AS
 *    (and drop pass-through of raw `gbi_` connect tokens).
 *  - Advertise `client_id_metadata_document_supported` on the AS, not here.
 *
 * Do not add a fake metadata document in the meantime — clients that probe
 * for OAuth should keep using bearer tokens until this module is implemented.
 */

export const OAUTH_STATUS = "not_implemented" as const;

export function oauthNotImplemented(): never {
  throw new Error(
    "OAuth is not implemented yet (phase 2). Use a bearer gbi_ token on Authorization, or GOBI_API_KEY / CLI credentials for stdio.",
  );
}
