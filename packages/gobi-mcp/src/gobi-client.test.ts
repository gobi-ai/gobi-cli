import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGobiApi, ApiError } from "./gobi-client.js";

describe("Gobi API client", () => {
  it("sends Bearer auth, x-app: mcp, and retries GET on 503", async () => {
    const calls: RequestInit[] = [];
    let n = 0;
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init ?? {});
      n += 1;
      if (n === 1) return new Response("upstream sad", { status: 503 });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const api = createGobiApi({
      getToken: async () => "secret-token",
      fetch: fetchImpl,
      baseUrl: "http://gobi.test",
    });
    const data = (await api.get("/thing")) as { ok: boolean };
    assert.equal(data.ok, true);
    assert.equal(calls.length, 2);
    const headers = new Headers(calls[0]?.headers);
    assert.equal(headers.get("Authorization"), "Bearer secret-token");
    assert.equal(headers.get("x-app"), "mcp");
  });

  it("surfaces API errors", async () => {
    const api = createGobiApi({
      getToken: async () => "t",
      fetch: (async () => new Response(JSON.stringify({ message: "nope" }), { status: 401 })) as typeof fetch,
      baseUrl: "http://gobi.test",
    });
    await assert.rejects(() => api.get("/x"), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 401);
      assert.equal(err.message, "nope");
      return true;
    });
  });
});
