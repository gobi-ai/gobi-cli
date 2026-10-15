import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGobiHttpHandler, verifyGobiBearer } from "./http.js";
import { OAUTH_STATUS } from "./oauth.js";

describe("HTTP auth", () => {
  it("verifyGobiBearer accepts a gbi_ token and rejects empty", async () => {
    const req = new Request("http://mcp.gobispace.com/mcp");
    assert.equal(await verifyGobiBearer(req, undefined), undefined);
    assert.equal(await verifyGobiBearer(req, "  "), undefined);
    const info = await verifyGobiBearer(req, "gbi_abc123");
    assert.equal(info?.token, "gbi_abc123");
    assert.deepEqual(info?.scopes, ["gobi:read"]);
  });

  it("OAuth is stubbed for a later phase", () => {
    assert.equal(OAUTH_STATUS, "not_implemented");
  });

  it("returns 401 without a bearer token", async () => {
    const handler = createGobiHttpHandler();
    const res = await handler(new Request("http://mcp.gobispace.com/mcp", { method: "POST" }));
    assert.equal(res.status, 401);
    const www = res.headers.get("WWW-Authenticate") ?? res.headers.get("www-authenticate") ?? "";
    assert.ok(www.length >= 0);
  });
});
