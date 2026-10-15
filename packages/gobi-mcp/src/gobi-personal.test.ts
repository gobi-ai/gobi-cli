import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fetchPersonalContext,
  parseSince,
  speakersFromTurns,
  parseContextLimit,
  DEFAULT_CONTEXT_SINCE,
  getCurrentActivity,
  getWhoami,
  listCaptures,
  sanitizeNote,
} from "./gobi-personal.js";
import { GobiError } from "./gobi-client.js";
import { fixtureContextRoutes, mockApi } from "./test-helpers.js";

describe("parseSince", () => {
  const now = new Date("2026-10-14T21:00:00.000Z");

  it("counts durations back from now", () => {
    assert.equal(parseSince("24h", now).toISOString(), "2026-10-13T21:00:00.000Z");
    assert.equal(parseSince("7d", now).toISOString(), "2026-10-07T21:00:00.000Z");
    assert.equal(DEFAULT_CONTEXT_SINCE, "24h");
  });

  it("accepts ISO and rejects junk", () => {
    assert.equal(parseSince("2026-10-13T08:15:00.000Z", now).toISOString(), "2026-10-13T08:15:00.000Z");
    assert.throws(() => parseSince("yesterday", now), GobiError);
  });
});

describe("parseContextLimit", () => {
  it("caps at 50 and rejects non-positive", () => {
    assert.equal(parseContextLimit(5), 5);
    assert.equal(parseContextLimit(999), 50);
    assert.throws(() => parseContextLimit(0), GobiError);
  });
});

describe("speakersFromTurns", () => {
  it("prefers speakerLabel and de-dupes", () => {
    assert.deepEqual(
      speakersFromTurns([
        { speaker: "spk_0", speakerLabel: "Me", text: "hi" },
        { speaker: "spk_1", speakerLabel: "Min", text: "hey" },
        { speaker: "spk_0", speakerLabel: "Me", text: "again" },
        { speaker: "spk_2", text: "unnamed" },
      ]),
      ["Me", "Min", "spk_2"],
    );
  });
});

describe("fetchPersonalContext (mocked API)", () => {
  it("composes current activity, in-window notes, and capture-only notifications", async () => {
    const now = Date.now();
    const { api, calls } = mockApi(fixtureContextRoutes(now));
    const ctx = await fetchPersonalContext(api, { since: "24h", limit: 5, now: new Date(now) });

    assert.equal(ctx.currentActivity?.id, "v0123456789");
    assert.equal(ctx.currentActivity?.category, "working");
    assert.equal(ctx.currentActivity?.end, null);
    assert.equal(ctx.activities.length, 1);
    assert.equal(ctx.notes.length, 1);
    assert.equal(ctx.notes[0]?.id, "o0123456789");
    assert.equal(ctx.notes[0]?.summary, "Agreed to send the deck.");
    assert.deepEqual(ctx.notes[0]?.speakers, ["Me", "Min"]);
    assert.equal(ctx.notes[0]?.sourceLabel, "audio log");
    assert.equal(ctx.captures.length, 1);
    assert.equal(ctx.captures[0]?.type, "capture_note");
    assert.deepEqual(ctx.errors, []);
    assert.ok(calls.some((c) => c.url.includes("/app/activities")));
    assert.ok(calls.some((c) => c.url.includes("/app/activity/v0123456789")));
    assert.ok(calls.some((c) => c.url.includes("/app/conversations/o0123456789/transcript")));
  });

  it("isolates a notes-list failure from activities", async () => {
    const routes = fixtureContextRoutes().map((r) =>
      r.path === "/app/conversations" ? { ...r, status: 503, body: { message: "notes down" } } : r,
    );
    const { api } = mockApi(routes);
    const ctx = await fetchPersonalContext(api, { since: "24h" });
    assert.equal(ctx.currentActivity?.id, "v0123456789");
    assert.equal(ctx.notes.length, 0);
    assert.ok(ctx.errors.some((e) => e.section === "notes"));
  });
});

describe("other personal reads", () => {
  it("getCurrentActivity returns the latest activity", async () => {
    const { api } = mockApi(fixtureContextRoutes());
    const current = await getCurrentActivity(api);
    assert.equal(current?.id, "v0123456789");
    assert.equal(current?.details, "writing code");
  });

  it("listCaptures drops non-capture inbox rows", async () => {
    const { api } = mockApi(fixtureContextRoutes());
    const { captures } = await listCaptures(api, { limit: 10 });
    assert.ok(captures.every((c) => c.type === "capture_note" || c.type === "capture_activity"));
    assert.ok(captures.some((c) => c.id === "n0123456789"));
    assert.ok(!captures.some((c) => c.id === "ncccccccccc"));
  });

  it("getWhoami hits /auth/me", async () => {
    const { api } = mockApi(fixtureContextRoutes());
    const me = await getWhoami(api);
    assert.equal(me.authenticated, true);
    assert.equal((me.user as { name: string }).name, "Ada");
  });

  it("sanitizeNote strips frontmatter and omits unknown media fields", async () => {
    const out = sanitizeNote({
      publicId: "o0123456789",
      title: "Standup",
      source: "mobile",
      startTime: "2026-10-14T18:00:00.000Z",
      summary: "---\ntitle: x\n---\nBody",
      audioUrl: "https://secret.example/audio.wav",
      turns: [{ speaker: "spk_0", speakerLabel: "Me", text: "hi", timestamp: "0:00" }],
    });
    assert.equal(out.summary, "Body");
    assert.equal(out.sourceLabel, "audio log");
    assert.equal("audioUrl" in out, false);
  });
});
