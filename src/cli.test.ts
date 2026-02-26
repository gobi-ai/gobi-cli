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
    assert.ok(out.includes("astra"));
  });

  it("prints auth help", () => {
    const out = run("auth", "--help");
    assert.ok(out.includes("login"));
    assert.ok(out.includes("status"));
    assert.ok(out.includes("logout"));
  });

  it("prints astra help", () => {
    const out = run("astra", "--help");
    assert.ok(out.includes("search-brain"));
    assert.ok(out.includes("ask-brain"));
    assert.ok(out.includes("publish-brain"));
    assert.ok(out.includes("list-posts"));
    assert.ok(out.includes("list-sessions"));
  });
});
