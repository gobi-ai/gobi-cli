import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ANTHROPIC_CUSTOM_HEADERS_ENV,
  BACKGROUND_FLOWS,
  BACKGROUND_RUN_KINDS,
  COUNTED_SCENARIOS,
  SCENARIO_ENV,
  SCENARIO_HEADER,
  isBackgroundScenario,
  isCountedScenario,
  normalizeScenario,
  parseScenarioFromAnthropicHeaders,
  resolveScenario,
} from "./scenario.js";

describe("scenario contract", () => {
  it("names the header and env vars the backend interceptor should read", () => {
    assert.equal(SCENARIO_HEADER, "x-gobi-scenario");
    assert.equal(SCENARIO_ENV, "GOBI_SCENARIO");
    assert.equal(ANTHROPIC_CUSTOM_HEADERS_ENV, "ANTHROPIC_CUSTOM_HEADERS");
  });

  it("treats observe and {scope}-{run_kind} as background (not counted)", () => {
    assert.deepEqual([...BACKGROUND_FLOWS], ["observe"]);
    assert.deepEqual(
      [...BACKGROUND_RUN_KINDS],
      ["routine", "context-refresh", "digest", "dreamer", "checkin", "recap", "note"],
    );
    assert.equal(isBackgroundScenario("observe"), true);
    assert.equal(isBackgroundScenario("space-routine"), true);
    assert.equal(isBackgroundScenario("space-context-refresh"), true);
    assert.equal(isBackgroundScenario("personal-recap"), true);
    assert.equal(isBackgroundScenario("personal-digest"), true);
    assert.equal(isBackgroundScenario("space-dreamer"), true);
    assert.equal(isBackgroundScenario("personal-checkin"), true);
    assert.equal(isBackgroundScenario("space-note"), true);
    for (const value of BACKGROUND_FLOWS) {
      assert.equal(isCountedScenario(value), false);
    }
  });

  it("treats space / personal / visitor / free as counted (human-visible)", () => {
    assert.deepEqual([...COUNTED_SCENARIOS], ["space", "personal", "visitor", "free"]);
    for (const value of COUNTED_SCENARIOS) {
      assert.equal(isCountedScenario(value), true);
      assert.equal(isBackgroundScenario(value), false);
    }
  });

  it("does not treat a bare run_kind as background (scope is required)", () => {
    assert.equal(isBackgroundScenario("routine"), false);
    assert.equal(isBackgroundScenario("context-refresh"), false);
  });
});

describe("normalizeScenario", () => {
  it("returns null for empty or missing values", () => {
    assert.equal(normalizeScenario(undefined), null);
    assert.equal(normalizeScenario(null), null);
    assert.equal(normalizeScenario(""), null);
    assert.equal(normalizeScenario("   "), null);
  });

  it("lowercases and maps underscores to hyphens (webdrive flow form)", () => {
    assert.equal(normalizeScenario("Observe"), "observe");
    assert.equal(normalizeScenario("SPACE-ROUTINE"), "space-routine");
    assert.equal(normalizeScenario("space_context_refresh"), "space-context-refresh");
    assert.equal(normalizeScenario("  personal-recap  "), "personal-recap");
  });

  it("keeps hyphens so context-refresh matches the backend skip list", () => {
    assert.equal(normalizeScenario("space-context-refresh"), "space-context-refresh");
  });

  it("rejects values that are not hyphenated tokens", () => {
    assert.equal(normalizeScenario("space routine"), null);
    assert.equal(normalizeScenario("1routine"), null);
    assert.equal(normalizeScenario("space-routine;drop"), null);
    assert.equal(normalizeScenario("x".repeat(65)), null);
  });
});

describe("parseScenarioFromAnthropicHeaders", () => {
  it("reads a single Header: value line", () => {
    assert.equal(
      parseScenarioFromAnthropicHeaders("x-gobi-scenario: space-routine"),
      "space-routine",
    );
    assert.equal(
      parseScenarioFromAnthropicHeaders("X-Gobi-Scenario: space-context-refresh"),
      "space-context-refresh",
    );
  });

  it("reads the header out of a multiline or escaped-newline block", () => {
    assert.equal(
      parseScenarioFromAnthropicHeaders("x-foo: 1\nx-gobi-scenario: personal-recap\nx-bar: 2"),
      "personal-recap",
    );
    assert.equal(
      parseScenarioFromAnthropicHeaders("x-foo: 1\\nx-gobi-scenario: observe\\nx-bar: 2"),
      "observe",
    );
  });

  it("reads a JSON object of custom headers", () => {
    assert.equal(
      parseScenarioFromAnthropicHeaders('{"x-gobi-scenario":"space-digest"}'),
      "space-digest",
    );
  });

  it("returns null when the header is absent or empty", () => {
    assert.equal(parseScenarioFromAnthropicHeaders(undefined), null);
    assert.equal(parseScenarioFromAnthropicHeaders(""), null);
    assert.equal(parseScenarioFromAnthropicHeaders("x-other: 1"), null);
  });
});

describe("resolveScenario", () => {
  it("prefers GOBI_SCENARIO over ANTHROPIC_CUSTOM_HEADERS", () => {
    assert.equal(
      resolveScenario({
        GOBI_SCENARIO: "personal-recap",
        ANTHROPIC_CUSTOM_HEADERS: "x-gobi-scenario: space-routine",
      }),
      "personal-recap",
    );
  });

  it("falls back to ANTHROPIC_CUSTOM_HEADERS when GOBI_SCENARIO is unset", () => {
    assert.equal(
      resolveScenario({ ANTHROPIC_CUSTOM_HEADERS: "x-gobi-scenario: space-routine" }),
      "space-routine",
    );
  });

  it("omits the header when neither env is set (terminal gobi)", () => {
    assert.equal(resolveScenario({}), null);
  });

  it("forwards counted flows when explicitly set", () => {
    assert.equal(resolveScenario({ GOBI_SCENARIO: "space" }), "space");
    assert.equal(resolveScenario({ GOBI_SCENARIO: "personal" }), "personal");
  });

  it("ignores a malformed GOBI_SCENARIO and still reads Anthropic headers", () => {
    assert.equal(
      resolveScenario({
        GOBI_SCENARIO: "nope!",
        ANTHROPIC_CUSTOM_HEADERS: "x-gobi-scenario: observe",
      }),
      "observe",
    );
  });
});
