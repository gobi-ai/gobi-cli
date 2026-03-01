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
    assert.ok(out.includes("get-thread"));
    assert.ok(out.includes("list-threads"));
    assert.ok(out.includes("create-thread"));
    assert.ok(out.includes("edit-thread"));
    assert.ok(out.includes("delete-thread"));
    assert.ok(out.includes("create-reply"));
    assert.ok(out.includes("edit-reply"));
    assert.ok(out.includes("delete-reply"));
  });

  it("prints brain help", () => {
    const out = run("brain", "--help");
    assert.ok(out.includes("search"));
    assert.ok(out.includes("ask"));
    assert.ok(out.includes("publish"));
    assert.ok(out.includes("unpublish"));
    assert.ok(out.includes("list-updates"));
    assert.ok(out.includes("post-update"));
    assert.ok(out.includes("edit-update"));
    assert.ok(out.includes("delete-update"));
  });

  it("prints session help", () => {
    const out = run("session", "--help");
    assert.ok(out.includes("get"));
    assert.ok(out.includes("list"));
    assert.ok(out.includes("reply"));
  });
});
