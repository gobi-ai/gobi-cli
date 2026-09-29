import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { actingAsLine, agentOnboardingBrief } from "./auth.js";

const spaceBot = {
  botId: "jenny",
  kind: "space_agent",
  spaceSlug: "acme",
  spaceName: "Acme",
} as const;

const personalBot = {
  botId: "jenny",
  kind: "personal_agent",
  ownerPublicId: "uOwner",
  ownerName: "Owner",
} as const;

describe("bot session: auth status", () => {
  it("names a space bot and its space", () => {
    assert.equal(actingAsLine(spaceBot), '  Acting as: bot "jenny" of space acme');
  });

  it("names a personal bot and its owner", () => {
    assert.equal(actingAsLine(personalBot), '  Acting as: personal bot "jenny" of Owner');
  });

  it("falls back to the owner's public id when the name is missing", () => {
    assert.equal(
      actingAsLine({ ...personalBot, ownerName: null }),
      '  Acting as: personal bot "jenny" of uOwner',
    );
  });
});

describe("bot session: token-login brief", () => {
  for (const [label, agent] of [
    ["space", spaceBot],
    ["personal", personalBot],
  ] as const) {
    it(`is headless for a ${label} bot`, () => {
      const brief = agentOnboardingBrief("Jenny", agent);
      assert.ok(brief.includes("You ARE this bot now"));
      assert.ok(brief.includes("This session is headless"));
      assert.ok(brief.includes("do not ask questions"));
      assert.ok(brief.includes("gobi notifications listen"));
      // The human brief's report-back closer never appears in a bot's.
      assert.ok(!brief.includes("I'm connected with Gobi and I'm ready."));
    });
  }

  it("points a space bot at its space", () => {
    const brief = agentOnboardingBrief("Jenny", spaceBot);
    assert.ok(brief.startsWith('Connected to Gobi as Jenny — the agent of the space "Acme" (acme).'));
    assert.ok(brief.includes("gobi --json space feed --space-slug acme"));
  });

  it("points a personal bot at its owner's personal core", () => {
    const brief = agentOnboardingBrief("Jenny", personalBot);
    assert.ok(brief.startsWith("Connected to Gobi as Jenny — the personal agent of Owner."));
    assert.ok(brief.includes("gobi --json personal feed"));
    assert.ok(brief.includes("gobi --json personal list-dms"));
    assert.ok(!brief.includes("space feed"));
  });
});
