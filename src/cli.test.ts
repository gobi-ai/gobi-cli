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
    assert.ok(out.includes("space"));
    assert.ok(out.includes("global"));
    assert.ok(out.includes("vault"));
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
    assert.ok(out.includes("list-topic-posts"));
    assert.ok(out.includes("feed"));
    assert.ok(out.includes("get-post"));
    assert.ok(out.includes("list-posts"));
    assert.ok(out.includes("create-post"));
    assert.ok(out.includes("edit-post"));
    assert.ok(out.includes("delete-post"));
    assert.ok(out.includes("create-reply"));
    assert.ok(out.includes("edit-reply"));
    assert.ok(out.includes("delete-reply"));
    // Removed sub-commands
    assert.ok(!/^\s+ancestors\b/m.test(out));
    assert.ok(!/^\s+messages\b/m.test(out));
    assert.ok(!/^\s+(get|list|create|edit|delete)-thread/m.test(out));
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
    assert.ok(out.includes("feed"));
    assert.ok(out.includes("get-post"));
    assert.ok(out.includes("list-posts"));
    assert.ok(out.includes("create-post"));
    assert.ok(out.includes("edit-post"));
    assert.ok(out.includes("delete-post"));
    assert.ok(out.includes("create-reply"));
    assert.ok(out.includes("edit-reply"));
    assert.ok(out.includes("delete-reply"));
    // Removed sub-commands
    assert.ok(!/^\s+ancestors\b/m.test(out));
    assert.ok(!/^\s+messages\b/m.test(out));
    assert.ok(!/^\s+(get|list|create|edit|delete)-thread/m.test(out));
  });

  it("prints personal help", () => {
    const out = run("personal", "--help");
    assert.ok(out.includes("feed"));
    assert.ok(out.includes("list-posts"));
    assert.ok(out.includes("get-post"));
    assert.ok(out.includes("create-post"));
    assert.ok(out.includes("edit-post"));
    assert.ok(out.includes("delete-post"));
    assert.ok(out.includes("create-reply"));
    assert.ok(out.includes("edit-reply"));
    assert.ok(out.includes("delete-reply"));
  });

  it("prints artifact help", () => {
    const out = run("artifact", "--help");
    assert.ok(out.includes("create"));
    assert.ok(out.includes("revise"));
    assert.ok(out.includes("publish"));
    assert.ok(out.includes("revert"));
    assert.ok(out.includes("history"));
    assert.ok(out.includes("download"));
    assert.ok(out.includes("delete"));
    assert.ok(out.includes("get"));
    assert.ok(out.includes("list"));
  });

  it("prints vault help", () => {
    const out = run("vault", "--help");
    assert.ok(out.includes("init"));
    assert.ok(out.includes("list"));
    assert.ok(out.includes("publish"));
    assert.ok(out.includes("unpublish"));
    assert.ok(out.includes("sync"));
    assert.ok(out.includes("PUBLISH.md"));
  });

  it("prints media help", () => {
    const out = run("media", "--help");
    assert.ok(out.includes("upload"));
    assert.ok(out.includes("list-avatars"));
    assert.ok(out.includes("list-voices"));
    assert.ok(out.includes("create-video"));
    assert.ok(out.includes("list-videos"));
    assert.ok(out.includes("get-video"));
    assert.ok(out.includes("download-video"));
    assert.ok(out.includes("create-cinematic"));
    assert.ok(out.includes("design-avatar"));
    assert.ok(out.includes("confirm-avatar"));
    assert.ok(out.includes("design-avatar-from-selfie"));
    assert.ok(out.includes("get-avatar-job-status"));
    assert.ok(out.includes("generate-image"));
    assert.ok(out.includes("edit-image"));
    assert.ok(out.includes("inpaint-image"));
    assert.ok(out.includes("get-image-status"));
    assert.ok(out.includes("download-image"));
  });

  it("prints sense help", () => {
    const out = run("sense", "--help");
    assert.ok(out.includes("list-activities"));
    assert.ok(out.includes("list-transcriptions"));
  });

  it("prints vault sync help with all flags", () => {
    const out = run("vault", "sync", "--help");
    assert.ok(out.includes("--upload-only"));
    assert.ok(out.includes("--download-only"));
    assert.ok(out.includes("--conflict"));
    assert.ok(out.includes("--dry-run"));
    assert.ok(out.includes("--dir"));
    assert.ok(out.includes("--full"));
    assert.ok(out.includes("--path"));
  });

  it("vault sync rejects --upload-only and --download-only together", () => {
    const out = runCapture(
      "--json",
      "vault",
      "sync",
      "--upload-only",
      "--download-only",
    );
    const result = JSON.parse(out);
    assert.equal(result.success, false);
    assert.ok(result.error.toLowerCase().includes("mutually exclusive"));
  });

  it("vault sync rejects invalid --conflict value", () => {
    const out = runCapture("--json", "vault", "sync", "--conflict", "bogus");
    const result = JSON.parse(out);
    assert.equal(result.success, false);
    assert.ok(result.error.includes("ask|server|client|skip"));
  });
});
