import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGobiHttpHandler } from "./http.js";
import { fixtureDirectoryRoutes } from "./mock-backend.js";
import { GobiAuthAdapter } from "./oauth/gobi-adapter.js";
import { MemoryOAuthStore } from "./oauth/store.js";
import { fixtureContextRoutes, mockApi } from "./test-helpers.js";

describe("REST /v1", () => {
  it("maps whoami, people, and notes search from the same core", async () => {
    const { api } = mockApi([...fixtureContextRoutes(), ...fixtureDirectoryRoutes()]);
    const handler = createGobiHttpHandler({
      adapter: new GobiAuthAdapter(new MemoryOAuthStore()),
      api,
    });
    const headers = { Authorization: "Bearer test-token" };

    const who = await handler(new Request("http://mcp.gobispace.com/v1/whoami", { headers }));
    assert.equal(who.status, 200);
    assert.equal(((await who.json()) as { user: { name: string } }).user.name, "Ada");

    const people = await handler(new Request("http://mcp.gobispace.com/v1/people?q=Min", { headers }));
    assert.equal(((await people.json()) as { people: { name: string }[] }).people[0]?.name, "Min");

    const search = await handler(
      new Request("http://mcp.gobispace.com/v1/personal/notes/search?query=deck", { headers }),
    );
    assert.equal(((await search.json()) as { notes: { id: string }[] }).notes[0]?.id, "o0123456789");
    const alias = await handler(
      new Request("http://mcp.gobispace.com/v1/personal/notes/search?q=deck", { headers }),
    );
    assert.equal(((await alias.json()) as { notes: { id: string }[] }).notes[0]?.id, "o0123456789");

    const spec = await handler(new Request("http://mcp.gobispace.com/v1/openapi.json", { headers }));
    assert.equal(((await spec.json()) as { openapi: string }).openapi, "3.1.0");
  });

  it("personal reply is two-step; space routes 404 until opted in", async () => {
    const { api } = mockApi([
      ...fixtureContextRoutes(),
      ...fixtureDirectoryRoutes(),
    ]);
    const off = createGobiHttpHandler({
      adapter: new GobiAuthAdapter(new MemoryOAuthStore()),
      api,
    });
    const headers = { Authorization: "Bearer test-token", "Content-Type": "application/json" };
    const missing = await off(
      new Request("http://mcp.gobispace.com/v1/spaces/demo/posts", { headers }),
    );
    assert.equal(missing.status, 404);

    const first = await off(
      new Request("http://mcp.gobispace.com/v1/personal/posts/p0123456789/replies", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "on it" }),
      }),
    );
    const pending = (await first.json()) as { needsConfirmation: boolean; confirmToken: string };
    assert.equal(pending.needsConfirmation, true);
    const second = await off(
      new Request("http://mcp.gobispace.com/v1/personal/posts/p0123456789/replies", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "on it", confirmToken: pending.confirmToken }),
      }),
    );
    assert.equal(second.status, 200);
    assert.equal(((await second.json()) as { reply: { id: string } }).reply.id, "r0123456789");

    const on = createGobiHttpHandler({
      adapter: new GobiAuthAdapter(new MemoryOAuthStore()),
      api,
      enableSpaceTools: true,
      spaceSlug: "demo",
    });
    const listed = await on(new Request("http://mcp.gobispace.com/v1/spaces/demo/posts", { headers }));
    assert.equal(listed.status, 200);
    assert.equal(((await listed.json()) as { posts: { id: string }[] }).posts[0]?.id, "p0123456789");
  });
});
