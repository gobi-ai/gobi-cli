import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CONTEXT_LIMIT,
  DEFAULT_CONTEXT_SINCE,
  formatPersonalContext,
  parseContextLimit,
  parseSince,
  speakersFromTurns,
  type PersonalContext,
} from "./context.js";
import { GobiError } from "../errors.js";

describe("parseSince", () => {
  const now = new Date("2026-10-14T21:00:00.000Z");

  it("defaults-shaped durations count back from now", () => {
    assert.equal(parseSince("24h", now).toISOString(), "2026-10-13T21:00:00.000Z");
    assert.equal(parseSince("7d", now).toISOString(), "2026-10-07T21:00:00.000Z");
    assert.equal(parseSince("30m", now).toISOString(), "2026-10-14T20:30:00.000Z");
    assert.equal(parseSince("90s", now).toISOString(), "2026-10-14T20:58:30.000Z");
    assert.equal(parseSince("2w", now).toISOString(), "2026-09-30T21:00:00.000Z");
    assert.equal(DEFAULT_CONTEXT_SINCE, "24h");
  });

  it("accepts an ISO timestamp", () => {
    assert.equal(
      parseSince("2026-10-13T08:15:00.000Z", now).toISOString(),
      "2026-10-13T08:15:00.000Z",
    );
    assert.equal(parseSince("2026-10-13", now).toISOString(), "2026-10-13T00:00:00.000Z");
  });

  it("rejects empty, bare numbers, and junk", () => {
    for (const bad of ["", "   ", "24", "yesterday", "not-a-date", "-2h"]) {
      assert.throws(() => parseSince(bad, now), GobiError);
    }
  });
});

describe("parseContextLimit", () => {
  it("parses a positive integer and caps the max", () => {
    assert.equal(parseContextLimit("5"), 5);
    assert.equal(parseContextLimit(String(DEFAULT_CONTEXT_LIMIT)), 5);
    assert.equal(parseContextLimit("50"), 50);
    assert.equal(parseContextLimit("999"), 50);
  });

  it("rejects zero, negative, and non-numeric", () => {
    for (const bad of ["0", "-1", "nope", ""]) {
      assert.throws(() => parseContextLimit(bad), GobiError);
    }
  });
});

describe("speakersFromTurns", () => {
  it("prefers speakerLabel, falls back to speaker, and de-dupes", () => {
    assert.deepEqual(
      speakersFromTurns([
        { speaker: "spk_0", speakerLabel: "Me", text: "hi" },
        { speaker: "spk_1", speakerLabel: "Min", text: "hey" },
        { speaker: "spk_0", speakerLabel: "Me", text: "again" },
        { speaker: "spk_2", text: "unnamed" },
        { speaker: "  ", speakerLabel: "", text: "skip" },
      ]),
      ["Me", "Min", "spk_2"],
    );
  });

  it("returns [] when turns are missing", () => {
    assert.deepEqual(speakersFromTurns(undefined), []);
    assert.deepEqual(speakersFromTurns(null), []);
    assert.deepEqual(speakersFromTurns([]), []);
  });
});

describe("formatPersonalContext", () => {
  const empty: PersonalContext = {
    since: "2026-10-13T21:00:00.000Z",
    currentActivity: null,
    activities: [],
    notes: [],
    captures: [],
    errors: [],
  };

  it("names empty sections instead of omitting them", () => {
    const text = formatPersonalContext(empty);
    assert.match(text, /Personal context since 2026-10-13T21:00:00.000Z/);
    assert.match(text, /Current activity: none/);
    assert.match(text, /Recent activities: none/);
    assert.match(text, /Recent notes: none/);
    assert.match(text, /Fresh captures: none/);
    assert.ok(!text.includes("Errors"));
  });

  it("renders populated sections and partial-failure errors", () => {
    const text = formatPersonalContext({
      since: "2026-10-13T21:00:00.000Z",
      currentActivity: {
        id: "v0123456789",
        category: "working",
        details: "writing code",
        start: "2026-10-14T20:00:00.000Z",
        end: null,
      },
      activities: [
        {
          id: "v0123456789",
          category: "working",
          details: "writing code",
          start: "2026-10-14T20:00:00.000Z",
          end: null,
        },
      ],
      notes: [
        {
          id: "o0123456789",
          title: "Standup",
          time: "2026-10-14T18:00:00.000Z",
          summary: "Agreed to send the deck.",
          speakers: ["Me", "Min"],
          source: "mobile",
          sourceLabel: "audio log",
        },
      ],
      captures: [
        {
          id: "n0123456789",
          type: "capture_note",
          title: "Note ready",
          body: "Standup summary landed",
          createdAt: "2026-10-14T18:05:00.000Z",
          read: false,
        },
      ],
      errors: [{ section: "captures", error: "API error (HTTP 502): upstream sad" }],
    });
    assert.match(text, /Current activity:/);
    assert.match(text, /\[v0123456789\] working: writing code/);
    assert.match(text, /→ ongoing/);
    assert.match(text, /Recent notes \(1\):/);
    assert.match(text, /\[o0123456789\] Standup — audio log/);
    assert.match(text, /Speakers: Me, Min/);
    assert.match(text, /Agreed to send the deck/);
    assert.match(text, /Fresh captures \(1\):/);
    assert.match(text, /capture_note/);
    assert.match(text, /Errors \(other sections still returned\):/);
    assert.match(text, /captures: API error/);
  });
});
