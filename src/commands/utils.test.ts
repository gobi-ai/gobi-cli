import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  flattenRichText,
  postBodyText,
  formatPostLabel,
  formatPostRef,
  displayPostId,
  parsePostIdentifier,
  displayUserId,
  parseUserIdentifier,
  displayChannelId,
  parseChannelIdentifier,
  parseDmIdentifier,
  formatAuthorName,
  buildMentionMap,
  POST_OR_REPLY_PUBLIC_ID_RE,
  USER_PUBLIC_ID_RE,
  CHANNEL_PUBLIC_ID_RE,
  DM_PUBLIC_ID_RE,
} from "./utils.js";

describe("flattenRichText", () => {
  it("joins text nodes", () => {
    assert.equal(
      flattenRichText([
        { text: "hello ", type: "text" },
        { text: "world", type: "text" },
      ]),
      "hello world",
    );
  });

  it("renders user mentions by id when no name is present", () => {
    assert.equal(
      flattenRichText([
        { text: "ping ", type: "text" },
        { type: "user", userId: 22 },
      ]),
      "ping @22",
    );
  });

  it("prefers a mention name over the id", () => {
    assert.equal(
      flattenRichText([{ type: "user", userId: 22, name: "mika" }]),
      "@mika",
    );
  });

  it("resolves a userId to a name via the mention map", () => {
    const mentions = new Map([["278", "HyunJie Jung"]]);
    assert.equal(
      flattenRichText(
        [
          { text: "cc ", type: "text" },
          { type: "user", userId: 278 },
        ],
        mentions,
      ),
      "cc @HyunJie Jung",
    );
  });

  it("falls back to @id when the map lacks the user", () => {
    assert.equal(
      flattenRichText([{ type: "user", userId: 999 }], new Map([["1", "x"]])),
      "@999",
    );
  });

  it("prefers the live mention map over a stale node-baked name", () => {
    assert.equal(
      flattenRichText(
        [{ type: "user", userId: 22, name: "old name" }],
        new Map([["22", "New Name"]]),
      ),
      "@New Name",
    );
  });

  it("renders an @here broadcast node", () => {
    assert.equal(
      flattenRichText([
        { type: "here" },
        { text: " ship it", type: "text" },
      ]),
      "@here ship it",
    );
  });

  it("renders link nodes as their text, falling back to the url", () => {
    assert.equal(
      flattenRichText([{ type: "link", url: "https://x.com", text: "x" }]),
      "x",
    );
    assert.equal(
      flattenRichText([{ type: "link", url: "https://x.com" }]),
      "https://x.com",
    );
  });

  it("returns empty string for non-arrays", () => {
    assert.equal(flattenRichText(undefined), "");
    assert.equal(flattenRichText(null), "");
    assert.equal(flattenRichText("nope"), "");
  });
});

describe("postBodyText", () => {
  it("prefers non-empty content over richText", () => {
    assert.equal(
      postBodyText({ content: "real content", richText: [{ text: "rt", type: "text" }] }),
      "real content",
    );
  });

  it("falls back to richText when content is empty", () => {
    assert.equal(
      postBodyText({ content: "", richText: [{ text: "from rich text", type: "text" }] }),
      "from rich text",
    );
  });

  it("returns empty string when neither has text", () => {
    assert.equal(postBodyText({ content: "", richText: [] }), "");
    assert.equal(postBodyText({}), "");
  });
});

describe("formatPostLabel", () => {
  it("uses the title when present", () => {
    assert.equal(formatPostLabel({ title: "Weekly Update", content: "" }), "Weekly Update");
  });

  it("never prints literal null for a titleless post", () => {
    const label = formatPostLabel({ title: null, content: "the body" });
    assert.equal(label, "the body");
    assert.notEqual(label, "null");
  });

  it("falls back to a richText snippet when content is empty", () => {
    assert.equal(
      formatPostLabel({ title: null, content: "", richText: [{ text: "Yo Artifacts!! ", type: "text" }] }),
      "Yo Artifacts!!",
    );
  });

  it("shows (untitled) when there is no title or body", () => {
    assert.equal(formatPostLabel({ title: null, content: "", richText: [] }), "(untitled)");
  });

  it("collapses whitespace and truncates long bodies", () => {
    const long = "a".repeat(250);
    const label = formatPostLabel({ title: null, content: long }, undefined, 100);
    assert.equal(label.length, 101); // 100 chars + ellipsis
    assert.ok(label.endsWith("…"));
  });

  it("resolves mentions in the body snippet", () => {
    const mentions = new Map([["278", "HyunJie Jung"]]);
    assert.equal(
      formatPostLabel(
        { title: null, content: "", richText: [{ type: "user", userId: 278 }] },
        mentions,
      ),
      "@HyunJie Jung",
    );
  });
});

describe("buildMentionMap", () => {
  it("builds an id -> name map from mentions.users", () => {
    const map = buildMentionMap({
      mentions: {
        users: [
          { publicId: "u0000000001", name: "Minsuk Kang" },
          { id: 278, name: "HyunJie Jung" },
        ],
      },
    });
    assert.equal(map.get("u0000000001"), "Minsuk Kang");
    // Legacy stored richText tokens resolve as opaque strings.
    assert.equal(map.get("278"), "HyunJie Jung");
  });

  it("returns an empty map when mentions are absent", () => {
    assert.equal(buildMentionMap({}).size, 0);
    assert.equal(buildMentionMap({ mentions: {} }).size, 0);
  });
});

describe("displayPostId / formatPostRef", () => {
  it("prefers publicId over numeric id (new short form)", () => {
    const post = { id: 42, publicId: "p0123456789" };
    assert.equal(displayPostId(post), "p0123456789");
    assert.equal(formatPostRef(post), "[p0123456789]");
  });

  it("prefers whatever publicId the API returned, including legacy", () => {
    const post = { id: 42, publicId: "p_0123456789abcdef" };
    assert.equal(displayPostId(post), "p_0123456789abcdef");
    assert.equal(formatPostRef(post), "[p_0123456789abcdef]");
    const reply = { id: 7, publicId: "rfedcba9876" };
    assert.equal(displayPostId(reply), "rfedcba9876");
    assert.equal(formatPostRef(reply), "[rfedcba9876]");
  });

  it("does not mint numeric ids when publicId is missing", () => {
    assert.equal(formatPostRef({ id: 42 }), "");
    assert.equal(formatPostRef({ id: 7, parentPostId: 42 }), "");
    assert.equal(formatPostRef({ id: 7, type: "post-reply" }), "");
    assert.equal(displayPostId({ id: 42 }), "");
  });
});

describe("parsePostIdentifier", () => {
  it("refuses a bare numeric id", () => {
    assert.throws(() => parsePostIdentifier("42"));
  });

  it("passes new short publicId through as a string", () => {
    assert.equal(parsePostIdentifier("p0123456789"), "p0123456789");
    assert.equal(parsePostIdentifier("rfedcba9876"), "rfedcba9876");
    assert.ok(POST_OR_REPLY_PUBLIC_ID_RE.test("p0123456789"));
    assert.ok(POST_OR_REPLY_PUBLIC_ID_RE.test("rfedcba9876"));
  });

  it("passes legacy publicId through as a string", () => {
    assert.equal(parsePostIdentifier("p_0123456789abcdef"), "p_0123456789abcdef");
    assert.equal(parsePostIdentifier("r_fedcba9876543210"), "r_fedcba9876543210");
    assert.ok(POST_OR_REPLY_PUBLIC_ID_RE.test("p_0123456789abcdef"));
    assert.ok(POST_OR_REPLY_PUBLIC_ID_RE.test("r_fedcba9876543210"));
  });

  it("rejects junk", () => {
    assert.throws(() => parsePostIdentifier("nope"), /publicId/);
    assert.throws(() => parsePostIdentifier("0"), /publicId/);
    assert.throws(() => parsePostIdentifier("p_short"), /publicId/);
    assert.throws(() => parsePostIdentifier("p012345678"), /publicId/); // 9 hex
    assert.throws(() => parsePostIdentifier("p01234567890"), /publicId/); // 11 hex
    assert.throws(() => parsePostIdentifier("p_0123456789abcde"), /publicId/); // 15 hex
    assert.throws(() => parsePostIdentifier("p0123456789abcdef"), /publicId/); // 16 hex, no underscore
    assert.throws(() => parsePostIdentifier("u0123456789"), /publicId/);
    assert.ok(!POST_OR_REPLY_PUBLIC_ID_RE.test("p_0123456789"));
  });
});

describe("displayUserId / formatAuthorName", () => {
  it("prefers publicId over numeric id (new short form)", () => {
    const user = { id: 22, publicId: "u0123456789" };
    assert.equal(displayUserId(user), "u0123456789");
    assert.equal(
      formatAuthorName({ author: { ...user, name: "mika" } }),
      "mika",
    );
  });

  it("prefers whatever publicId the API returned, including legacy", () => {
    const user = { id: 22, publicId: "u_0123456789abcdef" };
    assert.equal(displayUserId(user), "u_0123456789abcdef");
    assert.equal(
      formatAuthorName({ author: { id: 22, publicId: "u0123456789" } }),
      "User u0123456789",
    );
  });

  it("falls back to User <publicId> and does not mint numeric ids when name is missing", () => {
    assert.equal(
      formatAuthorName({ author: { id: 22, publicId: "u_0123456789abcdef" } }),
      "User u_0123456789abcdef",
    );
    assert.equal(formatAuthorName({ author: { id: 22 }, authorId: 22 }), "User ?");
    assert.equal(formatAuthorName({ authorId: 22 }), "User ?");
    assert.equal(displayUserId({ id: 22 }), "");
    assert.equal(displayUserId({ userId: 22 }), "");
  });
});

describe("parseUserIdentifier", () => {
  it("refuses a bare numeric id", () => {
    assert.throws(() => parseUserIdentifier("22"));
  });

  it("passes new short publicId through as a string", () => {
    assert.equal(parseUserIdentifier("u0123456789"), "u0123456789");
    assert.ok(USER_PUBLIC_ID_RE.test("u0123456789"));
  });

  it("passes legacy publicId through as a string", () => {
    assert.equal(parseUserIdentifier("u_0123456789abcdef"), "u_0123456789abcdef");
    assert.ok(USER_PUBLIC_ID_RE.test("u_0123456789abcdef"));
  });

  it("rejects junk", () => {
    assert.throws(() => parseUserIdentifier("nope"), /publicId/);
    assert.throws(() => parseUserIdentifier("0"), /publicId/);
    assert.throws(() => parseUserIdentifier("u_short"), /publicId/);
    assert.throws(() => parseUserIdentifier("u012345678"), /publicId/); // 9 hex
    assert.throws(() => parseUserIdentifier("u01234567890"), /publicId/); // 11 hex
    assert.throws(() => parseUserIdentifier("u_0123456789abcde"), /publicId/); // 15 hex
    assert.throws(() => parseUserIdentifier("p_0123456789abcdef"), /publicId/);
    assert.throws(() => parseUserIdentifier("p0123456789"), /publicId/);
    assert.ok(!USER_PUBLIC_ID_RE.test("u_0123456789"));
  });
});

describe("displayChannelId", () => {
  it("prefers publicId over numeric id (channel short form)", () => {
    assert.equal(displayChannelId({ id: 9, publicId: "c0123456789" }), "c0123456789");
  });

  it("prefers publicId over numeric id (DM short form)", () => {
    assert.equal(displayChannelId({ id: 11, publicId: "d0123456789" }), "d0123456789");
  });

  it("does not mint numeric ids when publicId is missing", () => {
    assert.equal(displayChannelId({ id: 9 }), "");
    assert.equal(displayChannelId({ channelId: 9 }), "");
    assert.equal(displayChannelId({}), "");
  });
});

describe("parseChannelIdentifier", () => {
  it("refuses a bare numeric id", () => {
    assert.throws(() => parseChannelIdentifier("9"));
  });

  it("passes channel publicId through as a string", () => {
    assert.equal(parseChannelIdentifier("c0123456789"), "c0123456789");
    assert.equal(parseChannelIdentifier("CABCDEF0123"), "CABCDEF0123");
    assert.ok(CHANNEL_PUBLIC_ID_RE.test("c0123456789"));
  });

  it("rejects junk and DM/user/post publicIds", () => {
    assert.throws(() => parseChannelIdentifier("nope"), /publicId \(c/);
    assert.throws(() => parseChannelIdentifier("0"), /publicId \(c/);
    assert.throws(() => parseChannelIdentifier("c012345678"), /publicId \(c/); // 9 hex
    assert.throws(() => parseChannelIdentifier("c01234567890"), /publicId \(c/); // 11 hex
    assert.throws(() => parseChannelIdentifier("c_0123456789abcdef"), /publicId \(c/);
    assert.throws(() => parseChannelIdentifier("d0123456789"), /publicId \(c/);
    assert.throws(() => parseChannelIdentifier("p0123456789"), /publicId \(c/);
    assert.throws(() => parseChannelIdentifier("u0123456789"), /publicId \(c/);
    assert.ok(!CHANNEL_PUBLIC_ID_RE.test("c012345678"));
    assert.ok(!CHANNEL_PUBLIC_ID_RE.test("d0123456789"));
  });
});

describe("parseDmIdentifier", () => {
  it("refuses a bare numeric id", () => {
    assert.throws(() => parseDmIdentifier("11"));
  });

  it("passes DM publicId through as a string", () => {
    assert.equal(parseDmIdentifier("d0123456789"), "d0123456789");
    assert.equal(parseDmIdentifier("DABCDEF0123"), "DABCDEF0123");
    assert.ok(DM_PUBLIC_ID_RE.test("d0123456789"));
  });

  it("rejects junk and channel/user/post publicIds", () => {
    assert.throws(() => parseDmIdentifier("nope"), /publicId \(d/);
    assert.throws(() => parseDmIdentifier("0"), /publicId \(d/);
    assert.throws(() => parseDmIdentifier("d012345678"), /publicId \(d/); // 9 hex
    assert.throws(() => parseDmIdentifier("d01234567890"), /publicId \(d/); // 11 hex
    assert.throws(() => parseDmIdentifier("d_0123456789abcdef"), /publicId \(d/);
    assert.throws(() => parseDmIdentifier("c0123456789"), /publicId \(d/);
    assert.throws(() => parseDmIdentifier("p0123456789"), /publicId \(d/);
    assert.throws(() => parseDmIdentifier("u0123456789"), /publicId \(d/);
    assert.ok(!DM_PUBLIC_ID_RE.test("d012345678"));
    assert.ok(!DM_PUBLIC_ID_RE.test("c0123456789"));
  });
});
