import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// The credentials module resolves ~/.gobi at import time, so HOME must point
// at a scratch dir BEFORE client.js (→ auth/manager.js → auth/credentials.js)
// is loaded. That is why every import below is dynamic.
const fakeHome = mkdtempSync(join(tmpdir(), "gobi-client-test-"));
process.env.HOME = fakeHome;

type ClientModule = typeof import("./client.js");
type ManagerModule = typeof import("./auth/manager.js");

let client: ClientModule;
let manager: ManagerModule;

const realFetch = globalThis.fetch;
let calls: Array<{ method: string; signal: AbortSignal | null | undefined }>;
let responses: Array<() => Response>;

function ok(body: unknown = { fine: true }): () => Response {
  return () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

function status(code: number): () => Response {
  return () => new Response("upstream sad", { status: code });
}

function networkFail(): () => Response {
  return () => {
    throw new TypeError("fetch failed");
  };
}

before(async () => {
  mkdirSync(join(fakeHome, ".gobi"), { recursive: true });
  writeFileSync(
    join(fakeHome, ".gobi", "credentials.json"),
    JSON.stringify({
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      user: { email: "t@example.com", name: "T", pictureUrl: null },
    }),
  );
  client = await import("./client.js");
  manager = await import("./auth/manager.js");
  await manager.initCredentials();

  globalThis.fetch = (async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({ method: init?.method ?? "GET", signal: init?.signal });
    const next = responses.shift();
    if (!next) throw new Error("mock fetch: no scripted response left");
    return next();
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = realFetch;
  rmSync(fakeHome, { recursive: true, force: true });
});

beforeEach(() => {
  calls = [];
  responses = [];
});

describe("client request retry policy", () => {
  it("attaches an abort signal to every request", async () => {
    responses = [ok()];
    await client.apiGet("/thing");
    assert.equal(calls.length, 1);
    assert.ok(calls[0].signal instanceof AbortSignal, "fetch got an AbortSignal");
  });

  it("retries a GET once after a network failure", async () => {
    responses = [networkFail(), ok({ hello: 1 })];
    const result = (await client.apiGet("/thing")) as { hello: number };
    assert.equal(calls.length, 2);
    assert.equal(result.hello, 1);
  });

  it("retries a GET once after a gateway 503", async () => {
    responses = [status(503), ok({ hello: 2 })];
    const result = (await client.apiGet("/thing")) as { hello: number };
    assert.equal(calls.length, 2);
    assert.equal(result.hello, 2);
  });

  it("does not retry a GET more than once", async () => {
    responses = [networkFail(), networkFail()];
    await assert.rejects(client.apiGet("/thing"), (err: Error) => {
      assert.match(err.message, /Network error/);
      return true;
    });
    assert.equal(calls.length, 2);
  });

  it("surfaces the second response even when it is still a 5xx", async () => {
    responses = [status(503), status(503)];
    await assert.rejects(client.apiGet("/thing"), (err: { status?: number }) => {
      assert.equal(err.status, 503);
      return true;
    });
    assert.equal(calls.length, 2);
  });

  it("never retries a POST", async () => {
    responses = [networkFail()];
    await assert.rejects(client.apiPost("/thing", { a: 1 }), (err: Error) => {
      assert.match(err.message, /Network error/);
      return true;
    });
    assert.equal(calls.length, 1);
  });

  it("does not retry a POST on a gateway 5xx", async () => {
    responses = [status(503)];
    await assert.rejects(client.apiPost("/thing", { a: 1 }));
    assert.equal(calls.length, 1);
  });

  it("does not retry non-gateway errors", async () => {
    responses = [status(404)];
    await assert.rejects(client.apiGet("/thing"));
    assert.equal(calls.length, 1);
  });
});
