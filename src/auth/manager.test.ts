import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// credentials.js resolves ~/.gobi at import time, so HOME must point at a
// scratch dir BEFORE manager.js (→ credentials.js) loads.
const fakeHome = mkdtempSync(join(tmpdir(), "gobi-manager-test-"));
process.env.HOME = fakeHome;

type ManagerModule = typeof import("./manager.js");
type CredsModule = typeof import("./credentials.js");
type ErrorsModule = typeof import("../errors.js");

let manager: ManagerModule;
let creds: CredsModule;
let errors: ErrorsModule;

const credsPath = join(fakeHome, ".gobi", "credentials.json");
const realFetch = globalThis.fetch;

function sample(expiresAt: number) {
  return {
    accessToken: "at",
    refreshToken: "rt-dead",
    expiresAt,
    user: { email: "t@example.com", name: "T", pictureUrl: null },
  };
}

before(async () => {
  mkdirSync(join(fakeHome, ".gobi"), { recursive: true });
  manager = await import("./manager.js");
  creds = await import("./credentials.js");
  errors = await import("../errors.js");
});

after(() => {
  globalThis.fetch = realFetch;
  rmSync(fakeHome, { recursive: true, force: true });
});

beforeEach(async () => {
  globalThis.fetch = realFetch;
  // Fresh expired credentials so getValidToken always refreshes.
  writeFileSync(credsPath, JSON.stringify(sample(Date.now() - 60_000)));
  await manager.initCredentials();
});

describe("performRefresh auth rejection", () => {
  it("clears credentials on HTTP 401 and leaves disk empty", async () => {
    globalThis.fetch = (async () =>
      new Response("unauthorized", { status: 401 })) as typeof fetch;

    await assert.rejects(
      () => manager.getValidToken(),
      (err: Error) => {
        assert.equal(err.name, "TokenRefreshError");
        return true;
      },
    );

    assert.equal(manager.isAuthenticated(), false);
    assert.equal(await creds.loadCredentials(), null);
    assert.equal(existsSync(credsPath), false);

    // Subsequent calls ask for login instead of retrying refresh forever.
    await assert.rejects(
      () => manager.getValidToken(),
      (err: Error) => err instanceof errors.NotAuthenticatedError,
    );
  });

  it("keeps credentials on non-401 failures (e.g. 503)", async () => {
    globalThis.fetch = (async () =>
      new Response("upstream sad", { status: 503 })) as typeof fetch;

    await assert.rejects(
      () => manager.getValidToken(),
      (err: Error) => {
        assert.equal(err.name, "TokenRefreshError");
        return true;
      },
    );

    assert.equal(manager.isAuthenticated(), true);
    const loaded = await creds.loadCredentials();
    assert.ok(loaded);
    assert.equal(loaded.refreshToken, "rt-dead");
  });
});
