import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// The module resolves ~/.gobi at import time, so HOME must point at a scratch
// dir BEFORE it loads — hence the dynamic import.
const fakeHome = mkdtempSync(join(tmpdir(), "gobi-creds-test-"));
process.env.HOME = fakeHome;

type CredsModule = typeof import("./credentials.js");
let creds: CredsModule;

const credsPath = join(fakeHome, ".gobi", "credentials.json");

const sample = {
  accessToken: "at",
  refreshToken: "rt",
  expiresAt: 123,
  user: { email: "t@example.com", name: "T", pictureUrl: null },
};

before(async () => {
  creds = await import("./credentials.js");
});

after(() => {
  rmSync(fakeHome, { recursive: true, force: true });
});

describe("saveCredentials", () => {
  it("writes the file owner-only (0600)", async () => {
    await creds.saveCredentials(sample);
    const mode = statSync(credsPath).mode & 0o777;
    assert.equal(mode, 0o600);
    assert.deepEqual(JSON.parse(readFileSync(credsPath, "utf-8")), sample);
  });

  it("tightens the mode of a pre-existing world-readable file", async () => {
    mkdirSync(join(fakeHome, ".gobi"), { recursive: true });
    writeFileSync(credsPath, "{}");
    chmodSync(credsPath, 0o644);
    await creds.saveCredentials(sample);
    const mode = statSync(credsPath).mode & 0o777;
    assert.equal(mode, 0o600, "rewrite must not keep the looser mode");
  });

  it("round-trips through loadCredentials", async () => {
    await creds.saveCredentials(sample);
    const loaded = await creds.loadCredentials();
    assert.deepEqual(loaded, sample);
  });

  it("clearCredentials removes the file and tolerates a missing one", async () => {
    await creds.saveCredentials(sample);
    await creds.clearCredentials();
    assert.equal(await creds.loadCredentials(), null);
    await creds.clearCredentials(); // second call: no throw
  });
});
