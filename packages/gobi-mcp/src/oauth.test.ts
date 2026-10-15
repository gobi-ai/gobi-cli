import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GobiAuthAdapter } from "./oauth/gobi-adapter.js";
import { createOAuthRouter, createOAuthStack, OAUTH_STATUS, protectedResourceMetadata } from "./oauth/http.js";
import { generateCodeVerifier, s256Challenge } from "./oauth/pkce.js";
import { MemoryOAuthStore } from "./oauth/store.js";
import { WorkOSAdapter } from "./oauth/workos-adapter.js";

describe("OAuth 2.1 AS", () => {
  it("is implemented", () => {
    assert.equal(OAUTH_STATUS, "implemented");
    const prm = protectedResourceMetadata();
    assert.match(String(prm.resource), /\/mcp$/);
    assert.ok(prm.authorization_servers.length);
  });

  it("registers a client, PKCE-authorizes with gobi_token, and swaps a code", async () => {
    const store = new MemoryOAuthStore();
    const adapter = new GobiAuthAdapter(store);
    const client = await adapter.registerClient({
      client_name: "test",
      redirect_uris: ["http://localhost:9999/cb"],
    });
    const verifier = generateCodeVerifier();
    const { code } = await adapter.authorize({
      clientId: client.client_id,
      redirectUri: "http://localhost:9999/cb",
      codeChallenge: s256Challenge(verifier),
      codeChallengeMethod: "S256",
      gobiToken: "access-from-test",
      state: "xyz",
    });
    const token = await adapter.token({
      grantType: "authorization_code",
      code,
      codeVerifier: verifier,
      redirectUri: "http://localhost:9999/cb",
      clientId: client.client_id,
    });
    assert.match(token.accessToken, /^gobi_mcp_/);
    assert.equal(token.gobiAccessToken, "access-from-test");
    const looked = await adapter.introspect(token.accessToken);
    assert.equal(looked?.gobiAccessToken, "access-from-test");
  });

  it("rejects a bad PKCE verifier", async () => {
    const adapter = new GobiAuthAdapter(new MemoryOAuthStore());
    const client = await adapter.registerClient({ redirect_uris: ["http://localhost/cb"] });
    const verifier = generateCodeVerifier();
    const { code } = await adapter.authorize({
      clientId: client.client_id,
      redirectUri: "http://localhost/cb",
      codeChallenge: s256Challenge(verifier),
      codeChallengeMethod: "S256",
      gobiToken: "t",
    });
    await assert.rejects(
      () =>
        adapter.token({
          grantType: "authorization_code",
          code,
          codeVerifier: "not-the-verifier",
          redirectUri: "http://localhost/cb",
          clientId: client.client_id,
        }),
      /PKCE/,
    );
  });

  it("HTTP: DCR + authorize JSON + token form", async () => {
    const { adapter } = createOAuthStack({ adapter: new GobiAuthAdapter(new MemoryOAuthStore()) });
    const router = createOAuthRouter(adapter);
    const reg = await router(
      new Request("http://mcp.gobispace.com/oauth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: "c", redirect_uris: ["http://localhost/cb"] }),
      }),
    );
    assert.equal(reg?.status, 201);
    const client = (await reg!.json()) as { client_id: string };
    const verifier = generateCodeVerifier();
    const auth = await router(
      new Request("http://mcp.gobispace.com/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: client.client_id,
          redirect_uri: "http://localhost/cb",
          code_challenge: s256Challenge(verifier),
          code_challenge_method: "S256",
          gobi_token: "raw-gobi",
        }),
      }),
    );
    const { code } = (await auth!.json()) as { code: string };
    const tok = await router(
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
    const body = (await tok!.json()) as { access_token: string };
    assert.match(body.access_token, /^gobi_mcp_/);
  });

  it("WorkOS adapter maps WorkOS token via /auth/workos/exchange", async () => {
    const store = new MemoryOAuthStore();
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/user_management/authenticate")) {
        return new Response(JSON.stringify({ access_token: "wo_at" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/auth/workos/exchange")) {
        const body = JSON.parse(String(init?.body)) as { workosAccessToken: string };
        assert.equal(body.workosAccessToken, "wo_at");
        return new Response(JSON.stringify({ accessToken: "gobi-from-workos" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("nope", { status: 404 });
    }) as typeof fetch;
    const adapter = new WorkOSAdapter(store, {
      fetch: fetchImpl,
      baseUrl: "http://gobi.test",
      workosApiBase: "https://api.workos.com",
      workosClientId: "wos_id",
      workosApiKey: "sk",
    });
    const client = await adapter.registerClient({ redirect_uris: ["http://localhost/cb"] });
    const verifier = generateCodeVerifier();
    const { code } = await adapter.completeWorkosLogin({
      workosCode: "wo_code",
      codeVerifier: verifier,
      codeChallenge: s256Challenge(verifier),
      clientId: client.client_id,
      redirectUri: "http://localhost/cb",
    });
    const token = await adapter.token({
      grantType: "authorization_code",
      code,
      codeVerifier: verifier,
      redirectUri: "http://localhost/cb",
      clientId: client.client_id,
    });
    assert.equal(token.gobiAccessToken, "gobi-from-workos");
  });
});
