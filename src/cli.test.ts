import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cli = join(__dirname, "..", "dist", "index.js");

function run(...args: string[]): string {
  return execFileSync("node", [cli, ...args], {
    encoding: "utf-8",
    timeout: 10_000,
  }).trim();
}

/** Like run() but captures stdout even when the process exits non-zero. */
function runCapture(...args: string[]): string {
  try {
    return run(...args);
  } catch (err: unknown) {
    const e = err as { stdout?: string };
    return (e.stdout ?? "").trim();
  }
}

describe("gobi cli", () => {
  it("prints version", () => {
    const out = run("--version");
    assert.match(out, /^\d+\.\d+\.\d+$/);
  });

  it("prints help", () => {
    const out = run("--help");
    assert.ok(out.includes("gobi"));
    assert.ok(out.includes("auth"));
    assert.ok(out.includes("init"));
    assert.ok(out.includes("space"));
    assert.ok(out.includes("global"));
    assert.ok(out.includes("brain"));
    assert.ok(out.includes("session"));
  });

  it("prints auth help", () => {
    const out = run("auth", "--help");
    assert.ok(out.includes("login"));
    assert.ok(out.includes("status"));
    assert.ok(out.includes("logout"));
  });

  it("prints space help", () => {
    const out = run("space", "--help");
    assert.ok(out.includes("warp"));
    assert.ok(out.includes("get"));
    assert.ok(out.includes("list-topics"));
    assert.ok(out.includes("list-topic-threads"));
    assert.ok(out.includes("messages"));
    assert.ok(out.includes("ancestors"));
    assert.ok(out.includes("get-thread"));
    assert.ok(out.includes("list-threads"));
    assert.ok(out.includes("create-thread"));
    assert.ok(out.includes("edit-thread"));
    assert.ok(out.includes("delete-thread"));
    assert.ok(out.includes("create-reply"));
    assert.ok(out.includes("edit-reply"));
    assert.ok(out.includes("delete-reply"));
    // Admin operations (space create, member management) are web-UI only
    assert.ok(!out.includes("list-members"));
    assert.ok(!out.includes("invite-member"));
    assert.ok(!out.includes("join-space"));
    assert.ok(!out.includes("request-access"));
    assert.ok(!out.includes("accept-invite"));
    assert.ok(!out.includes("approve-member"));
    assert.ok(!out.includes("leave-space"));
  });

  it("prints global help", () => {
    const out = run("global", "--help");
    assert.ok(out.includes("messages"));
    assert.ok(out.includes("get-thread"));
    assert.ok(out.includes("ancestors"));
    assert.ok(out.includes("create-thread"));
    assert.ok(out.includes("reply"));
  });

  it("prints brain help", () => {
    const out = run("brain", "--help");
    assert.ok(out.includes("search"));
    assert.ok(out.includes("ask"));
    assert.ok(out.includes("publish"));
    assert.ok(out.includes("unpublish"));
    assert.ok(!out.includes("list-updates"));
    assert.ok(!out.includes("post-update"));
    assert.ok(!out.includes("edit-update"));
    assert.ok(!out.includes("delete-update"));
  });

  it("prints feed help", () => {
    const out = run("feed", "--help");
    assert.ok(out.includes("list"));
    assert.ok(out.includes("get"));
    assert.ok(out.includes("post-reply"));
    assert.ok(out.includes("edit-reply"));
    assert.ok(out.includes("delete-reply"));
  });

  it("prints notes help", () => {
    const out = run("notes", "--help");
    assert.ok(out.includes("list"));
    assert.ok(out.includes("get"));
    assert.ok(out.includes("create"));
    assert.ok(out.includes("edit"));
    assert.ok(out.includes("delete"));
  });

  it("prints session help", () => {
    const out = run("session", "--help");
    assert.ok(out.includes("get"));
    assert.ok(out.includes("list"));
    assert.ok(out.includes("reply"));
  });

  it("prints sync help with all flags", () => {
    const out = run("sync", "--help");
    assert.ok(out.includes("--upload-only"));
    assert.ok(out.includes("--download-only"));
    assert.ok(out.includes("--conflict"));
    assert.ok(out.includes("--dry-run"));
    assert.ok(out.includes("--dir"));
    assert.ok(out.includes("--full"));
    assert.ok(out.includes("--path"));
  });

  it("sync rejects --upload-only and --download-only together", () => {
    const out = runCapture(
      "--json",
      "sync",
      "--upload-only",
      "--download-only",
    );
    const result = JSON.parse(out);
    assert.equal(result.success, false);
    assert.ok(result.error.toLowerCase().includes("mutually exclusive"));
  });

  it("sync rejects invalid --conflict value", () => {
    const out = runCapture("--json", "sync", "--conflict", "bogus");
    const result = JSON.parse(out);
    assert.equal(result.success, false);
    assert.ok(result.error.includes("ask|server|client|skip"));
  });
});
