import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BACKGROUND_SCENARIOS,
  COUNTED_SCENARIOS,
  SCENARIO_ENV,
  SCENARIO_HEADER,
  isBackgroundScenario,
  isCountedScenario,
  normalizeScenario,
  resolveScenario,
} from "./scenario.js";

describe("scenario contract", () => {
  it("names the header and env var the backend interceptor should read", () => {
    assert.equal(SCENARIO_HEADER, "x-gobi-scenario");
    assert.equal(SCENARIO_ENV, "GOBI_SCENARIO");
  });

  it("lists routine and context_refresh as background (not counted)", () => {
    assert.deepEqual([...BACKGROUND_SCENARIOS], ["routine", "context_refresh"]);
    for (const value of BACKGROUND_SCENARIOS) {
      assert.equal(isBackgroundScenario(value), true);
      assert.equal(isCountedScenario(value), false);
    }
  });

  it("lists cli, chat, and mention as counted (human-visible)", () => {
    assert.deepEqual([...COUNTED_SCENARIOS], ["cli", "chat", "mention"]);
    for (const value of COUNTED_SCENARIOS) {
      assert.equal(isCountedScenario(value), true);
      assert.equal(isBackgroundScenario(value), false);
    }
  });
});

describe("normalizeScenario", () => {
  it("returns null for empty or missing values", () => {
    assert.equal(normalizeScenario(undefined), null);
    assert.equal(normalizeScenario(null), null);
    assert.equal(normalizeScenario(""), null);
    assert.equal(normalizeScenario("   "), null);
  });

  it("lowercases and maps hyphens to underscores", () => {
    assert.equal(normalizeScenario("Routine"), "routine");
    assert.equal(normalizeScenario("CONTEXT-REFRESH"), "context_refresh");
    assert.equal(normalizeScenario("  context_refresh  "), "context_refresh");
  });

  it("rejects values that are not snake_case tokens", () => {
    assert.equal(normalizeScenario("context refresh"), null);
    assert.equal(normalizeScenario("1routine"), null);
    assert.equal(normalizeScenario("routine;drop"), null);
    assert.equal(normalizeScenario("x".repeat(65)), null);
  });

  it("forwards additional well-formed job types so new background kinds need no CLI change", () => {
    assert.equal(normalizeScenario("digest"), "digest");
    assert.equal(normalizeScenario("scheduled"), "scheduled");
  });
});

describe("resolveScenario", () => {
  it("reads GOBI_SCENARIO and ignores an unset env", () => {
    assert.equal(resolveScenario({}), null);
    assert.equal(resolveScenario({ GOBI_SCENARIO: "routine" }), "routine");
    assert.equal(resolveScenario({ GOBI_SCENARIO: "chat" }), "chat");
    assert.equal(resolveScenario({ GOBI_SCENARIO: "nope!" }), null);
  });
});
