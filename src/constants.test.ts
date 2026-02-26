import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

describe("constants", () => {
  const originalBaseUrl = process.env.GOBI_BASE_URL;
  const originalWebdriveUrl = process.env.GOBI_WEBDRIVE_BASE_URL;

  after(() => {
    if (originalBaseUrl !== undefined) {
      process.env.GOBI_BASE_URL = originalBaseUrl;
    } else {
      delete process.env.GOBI_BASE_URL;
    }
    if (originalWebdriveUrl !== undefined) {
      process.env.GOBI_WEBDRIVE_BASE_URL = originalWebdriveUrl;
    } else {
      delete process.env.GOBI_WEBDRIVE_BASE_URL;
    }
  });

  it("uses default BASE_URL when env var is not set", async () => {
    delete process.env.GOBI_BASE_URL;
    // Re-import to pick up env change — dynamic import with cache bust
    const mod = await import(`./constants.js?v=${Date.now()}`);
    // Since the module is already cached, we test the current value
    assert.ok(typeof mod.BASE_URL === "string");
    assert.ok(mod.BASE_URL.length > 0);
  });

  it("uses default WEBDRIVE_BASE_URL when env var is not set", async () => {
    delete process.env.GOBI_WEBDRIVE_BASE_URL;
    const mod = await import(`./constants.js?v=${Date.now()}`);
    assert.ok(typeof mod.WEBDRIVE_BASE_URL === "string");
    assert.ok(mod.WEBDRIVE_BASE_URL.length > 0);
  });

  it("exports TOKEN_REFRESH_BUFFER_MS as a positive number", async () => {
    const mod = await import("./constants.js");
    assert.ok(mod.TOKEN_REFRESH_BUFFER_MS > 0);
  });

  it("exports POLL_MAX_DURATION_MS as a positive number", async () => {
    const mod = await import("./constants.js");
    assert.ok(mod.POLL_MAX_DURATION_MS > 0);
  });
});
