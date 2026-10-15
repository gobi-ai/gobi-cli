import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isGbiToken, resolveStdioAuth, staticBearer } from "./auth.js";
import { NotAuthenticatedError } from "./gobi-client.js";

describe("auth", () => {
  it("detects gbi_ connect tokens", () => {
    assert.equal(isGbiToken("gbi_abc"), true);
    assert.equal(isGbiToken("  gbi_abc"), true);
    assert.equal(isGbiToken("eyJhbGciOi"), false);
  });

  it("prefers GOBI_API_KEY as a bearer", async () => {
    const resolved = await resolveStdioAuth({
      env: { GOBI_API_KEY: "access-from-env" } as NodeJS.ProcessEnv,
      home: mkdtempSync(join(tmpdir(), "gobi-mcp-auth-")),
    });
    assert.equal(resolved.source, "env");
    assert.equal(await resolved.provider.getToken(), "access-from-env");
  });

  it("falls back to ~/.gobi/credentials.json", async () => {
    const home = mkdtempSync(join(tmpdir(), "gobi-mcp-creds-"));
    mkdirSync(join(home, ".gobi"));
    writeFileSync(
      join(home, ".gobi", "credentials.json"),
      JSON.stringify({
        accessToken: "cli-access",
        refreshToken: "r",
        expiresAt: Date.now() + 3_600_000,
        user: { email: "a@b.c", name: "A", pictureUrl: null },
      }),
    );
    try {
      const resolved = await resolveStdioAuth({
        env: {} as NodeJS.ProcessEnv,
        home,
      });
      assert.equal(resolved.source, "credentials");
      assert.equal(await resolved.provider.getToken(), "cli-access");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("exchanges a gbi_ connect token at stdio startup", async () => {
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      assert.match(url, /\/auth\/connect-token\/exchange$/);
      const body = JSON.parse(String(init?.body)) as { token: string };
      assert.equal(body.token, "gbi_once");
      return new Response(JSON.stringify({ accessToken: "exchanged-access", user: { name: "Ada" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    const resolved = await resolveStdioAuth({
      env: { GOBI_API_KEY: "gbi_once" } as NodeJS.ProcessEnv,
      fetch: fetchImpl,
      baseUrl: "http://gobi.test",
      home: mkdtempSync(join(tmpdir(), "gobi-mcp-gbi-")),
    });
    assert.equal(resolved.source, "env-connect-token");
    assert.equal(await resolved.provider.getToken(), "exchanged-access");
  });

  it("uses a gbi_ key as bearer when exchange 401s (long-lived API key)", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 401 })) as typeof fetch;
    const resolved = await resolveStdioAuth({
      env: { GOBI_API_KEY: "gbi_live" } as NodeJS.ProcessEnv,
      fetch: fetchImpl,
      baseUrl: "http://gobi.test",
      home: mkdtempSync(join(tmpdir(), "gobi-mcp-gbi2-")),
    });
    assert.equal(resolved.source, "env");
    assert.equal(await resolved.provider.getToken(), "gbi_live");
  });

  it("throws when nothing is configured", async () => {
    const home = mkdtempSync(join(tmpdir(), "gobi-mcp-empty-"));
    try {
      await assert.rejects(
        () => resolveStdioAuth({ env: {} as NodeJS.ProcessEnv, home }),
        NotAuthenticatedError,
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("staticBearer trims", async () => {
    assert.equal(await staticBearer("  tok  ").getToken(), "tok");
  });
});
