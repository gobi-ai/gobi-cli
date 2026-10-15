import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import { createGobiHttpHandler } from "./http.js";
import { startMockGobiBackend } from "./mock-backend.js";
import { createOAuthStack } from "./oauth.js";
import { GobiAuthAdapter } from "./oauth/gobi-adapter.js";
import { generateCodeVerifier, s256Challenge } from "./oauth/pkce.js";
import { MemoryOAuthStore } from "./oauth/store.js";
import { listenFetchHandler } from "./test-helpers.js";
import { advertisedToolNames } from "./tools.js";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function oauthAccessToken(origin: string, gobiToken: string): Promise<string> {
  const reg = await fetch(`${origin}/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "e2e", redirect_uris: ["http://localhost/cb"] }),
  });
  assert.equal(reg.status, 201);
  const client = (await reg.json()) as { client_id: string };
  const verifier = generateCodeVerifier();
  const auth = await fetch(`${origin}/oauth/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: client.client_id,
      redirect_uri: "http://localhost/cb",
      code_challenge: s256Challenge(verifier),
      gobi_token: gobiToken,
    }),
  });
  const { code } = (await auth.json()) as { code: string };
  const tok = await fetch(`${origin}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: "http://localhost/cb",
      client_id: client.client_id,
    }),
  });
  const issued = (await tok.json()) as { access_token: string };
  assert.match(issued.access_token, /^gobi_mcp_/);
  return issued.access_token;
}

async function assertReadTools(client: Client): Promise<void> {
  const listed = await client.listTools();
  const names = listed.tools.map((t) => t.name).sort();
  assert.deepEqual(names, advertisedToolNames().sort());
  const who = await client.callTool({ name: "gobi_whoami", arguments: {} });
  assert.equal(who.isError, undefined);
  assert.equal((who.structuredContent as { user: { name: string } }).user.name, "Ada");
  const people = await client.callTool({ name: "gobi_list_people", arguments: {} });
  const body = people.structuredContent as { people?: { name: string }[]; unimplemented?: boolean };
  assert.equal(people.isError, undefined);
  assert.equal(body.unimplemented, undefined);
  assert.equal(body.people?.[0]?.name, "Min");
}

describe("e2e smoke (mocked Gobi backend)", () => {
  it("HTTP: OAuth 2.1 + Streamable MCP + REST /v1", async () => {
    const backend = await startMockGobiBackend();
    const { adapter } = createOAuthStack({ adapter: new GobiAuthAdapter(new MemoryOAuthStore()) });
    const handler = createGobiHttpHandler({ adapter, baseUrl: backend.url });
    const mcpHttp = await listenFetchHandler(handler);
    const client = new Client({ name: "e2e-http", version: "0.0.0" });
    try {
      const prm = await fetch(`${mcpHttp.url}/.well-known/oauth-protected-resource`);
      assert.equal(prm.status, 200);
      const access = await oauthAccessToken(mcpHttp.url, "gobi-access-from-e2e");
      const rest = await fetch(`${mcpHttp.url}/v1/whoami`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      assert.equal(rest.status, 200);
      const whoami = (await rest.json()) as { user: { name: string } };
      assert.equal(whoami.user.name, "Ada");
      const people = await fetch(`${mcpHttp.url}/v1/people`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      const listedPeople = (await people.json()) as { people: { name: string }[] };
      assert.equal(listedPeople.people[0]?.name, "Min");
      const spec = await fetch(`${mcpHttp.url}/v1/openapi.json`);
      assert.equal(spec.status, 200);
      const openapi = (await spec.json()) as { openapi: string };
      assert.equal(openapi.openapi, "3.1.0");

      const transport = new StreamableHTTPClientTransport(new URL(`${mcpHttp.url}/mcp`), {
        authProvider: { token: async () => access },
      });
      await client.connect(transport);
      await assertReadTools(client);
      const pending = await client.callTool({
        name: "gobi_reply_to_post",
        arguments: { postId: "p0123456789", content: "on it" },
      });
      const token = (pending.structuredContent as { confirmToken?: string }).confirmToken;
      assert.match(String(token), /^gobi_cf_/);
      const sent = await client.callTool({
        name: "gobi_reply_to_post",
        arguments: { postId: "p0123456789", content: "on it", confirmToken: token },
      });
      assert.equal((sent.structuredContent as { reply: { id: string } }).reply.id, "r0123456789");
    } finally {
      await client.close().catch(() => undefined);
      await mcpHttp.close();
      await backend.close();
    }
  });

  it("stdio: SDK client against spawned gobi-mcp + mock backend", async () => {
    const backend = await startMockGobiBackend();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(pkgRoot, "dist", "index.js")],
      cwd: pkgRoot,
      stderr: "pipe",
      env: {
        ...getDefaultEnvironment(),
        GOBI_API_KEY: "gobi-access-from-e2e",
        GOBI_BASE_URL: backend.url,
      },
    });
    const client = new Client({ name: "e2e-stdio", version: "0.0.0" });
    try {
      await client.connect(transport);
      await assertReadTools(client);
      const listed = await client.listTools();
      assert.ok(!listed.tools.some((t) => t.name.startsWith("gobi_list_space")));
    } finally {
      await client.close().catch(() => undefined);
      await backend.close();
    }
  });

  it("HTTP: opt-in space tools list posts when GOBI_MCP_SPACE_TOOLS is on", async () => {
    const backend = await startMockGobiBackend();
    const { adapter } = createOAuthStack({ adapter: new GobiAuthAdapter(new MemoryOAuthStore()) });
    const handler = createGobiHttpHandler({
      adapter,
      baseUrl: backend.url,
      enableSpaceTools: true,
      spaceSlug: "demo",
    });
    const mcpHttp = await listenFetchHandler(handler);
    const client = new Client({ name: "e2e-space", version: "0.0.0" });
    try {
      const access = await oauthAccessToken(mcpHttp.url, "gobi-access-from-e2e");
      const transport = new StreamableHTTPClientTransport(new URL(`${mcpHttp.url}/mcp`), {
        authProvider: { token: async () => access },
      });
      await client.connect(transport);
      const listed = await client.listTools();
      assert.ok(listed.tools.some((t) => t.name === "gobi_list_space_posts"));
      const posts = await client.callTool({ name: "gobi_list_space_posts", arguments: {} });
      assert.equal((posts.structuredContent as { posts: { id: string }[] }).posts[0]?.id, "p0123456789");
    } finally {
      await client.close().catch(() => undefined);
      await mcpHttp.close();
      await backend.close();
    }
  });
});
