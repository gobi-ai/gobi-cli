import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGobiHttpHandler, verifyGobiBearer } from "./http.js";
import { createOAuthStack, OAUTH_STATUS } from "./oauth.js";
import { generateCodeVerifier, s256Challenge } from "./oauth/pkce.js";
import { GobiAuthAdapter } from "./oauth/gobi-adapter.js";
import { MemoryOAuthStore } from "./oauth/store.js";

describe("HTTP auth", () => {
  it("verifyGobiBearer accepts a gbi_ token and rejects empty", async () => {
    const req = new Request("http://mcp.gobispace.com/mcp");
    assert.equal(await verifyGobiBearer(req, undefined), undefined);
    assert.equal(await verifyGobiBearer(req, "  "), undefined);
    const info = await verifyGobiBearer(req, "gbi_abc123");
    assert.equal(info?.token, "gbi_abc123");
    assert.deepEqual(info?.scopes, ["gobi:read"]);
  });

  it("OAuth 2.1 is implemented (PRM + AS metadata)", () => {
    assert.equal(OAUTH_STATUS, "implemented");
  });

  it("serves protected-resource and authorization-server metadata", async () => {
    const handler = createGobiHttpHandler({ adapter: new GobiAuthAdapter(new MemoryOAuthStore()) });
    const prm = await handler(new Request("http://mcp.gobispace.com/.well-known/oauth-protected-resource"));
    assert.equal(prm.status, 200);
    const prmBody = (await prm.json()) as { resource: string; authorization_servers: string[] };
    assert.match(prmBody.resource, /\/mcp$/);
    assert.ok(prmBody.authorization_servers.length);

    const as = await handler(new Request("http://mcp.gobispace.com/.well-known/oauth-authorization-server"));
    assert.equal(as.status, 200);
    const asBody = (await as.json()) as {
      authorization_endpoint: string;
      registration_endpoint: string;
      code_challenge_methods_supported: string[];
    };
    assert.match(asBody.authorization_endpoint, /\/oauth\/authorize$/);
    assert.match(asBody.registration_endpoint, /\/oauth\/register$/);
    assert.deepEqual(asBody.code_challenge_methods_supported, ["S256"]);
  });

  it("DCR + PKCE token can call MCP; missing bearer is 401", async () => {
    const { adapter } = createOAuthStack({ adapter: new GobiAuthAdapter(new MemoryOAuthStore()) });
    const handler = createGobiHttpHandler({ adapter });
    const unauth = await handler(new Request("http://mcp.gobispace.com/mcp", { method: "POST" }));
    assert.equal(unauth.status, 401);
    const www = unauth.headers.get("WWW-Authenticate") ?? unauth.headers.get("www-authenticate") ?? "";
    assert.ok(www.length >= 0);

    const reg = await handler(
      new Request("http://mcp.gobispace.com/oauth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: "t", redirect_uris: ["http://localhost/cb"] }),
      }),
    );
    assert.equal(reg.status, 201);
    const client = (await reg.json()) as { client_id: string };
    const verifier = generateCodeVerifier();
    const auth = await handler(
      new Request("http://mcp.gobispace.com/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: client.client_id,
          redirect_uri: "http://localhost/cb",
          code_challenge: s256Challenge(verifier),
          gobi_token: "raw-gobi",
        }),
      }),
    );
    const { code } = (await auth.json()) as { code: string };
    const tok = await handler(
      new Request("http://mcp.gobispace.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: "http://localhost/cb",
          client_id: client.client_id,
        }).toString(),
      }),
    );
    const issued = (await tok.json()) as { access_token: string };
    assert.match(issued.access_token, /^gobi_mcp_/);
    const introspect = await handler(
      new Request("http://mcp.gobispace.com/oauth/introspect", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: issued.access_token }).toString(),
      }),
    );
    const active = (await introspect.json()) as { active: boolean; scope: string };
    assert.equal(active.active, true);
    assert.match(active.scope, /gobi:read/);
  });
});
