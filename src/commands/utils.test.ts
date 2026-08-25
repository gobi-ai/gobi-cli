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
  formatAuthorName,
  buildMentionMap,
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
    const mentions = new Map([[278, "HyunJie Jung"]]);
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
      flattenRichText([{ type: "user", userId: 999 }], new Map([[1, "x"]])),
      "@999",
    );
  });

  it("prefers the live mention map over a stale node-baked name", () => {
    assert.equal(
      flattenRichText(
        [{ type: "user", userId: 22, name: "old name" }],
        new Map([[22, "New Name"]]),
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
    const mentions = new Map([[278, "HyunJie Jung"]]);
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
          { id: 1, name: "Minsuk Kang" },
          { id: 278, name: "HyunJie Jung" },
        ],
      },
    });
    assert.equal(map.get(1), "Minsuk Kang");
    assert.equal(map.get(278), "HyunJie Jung");
  });

  it("returns an empty map when mentions are absent", () => {
    assert.equal(buildMentionMap({}).size, 0);
    assert.equal(buildMentionMap({ mentions: {} }).size, 0);
  });
});

describe("displayPostId / formatPostRef", () => {
  it("prefers publicId over numeric id", () => {
    const post = { id: 42, publicId: "p_0123456789abcdef" };
    assert.equal(displayPostId(post), "p_0123456789abcdef");
    assert.equal(formatPostRef(post), "[p_0123456789abcdef]");
  });

  it("falls back to [p:N]/[r:N] when publicId is missing", () => {
    assert.equal(formatPostRef({ id: 42 }), "[p:42]");
    assert.equal(formatPostRef({ id: 7, parentPostId: 42 }), "[r:7]");
    assert.equal(formatPostRef({ id: 7, type: "post-reply" }), "[r:7]");
    assert.equal(displayPostId({ id: 42 }), "42");
  });
});

describe("parsePostIdentifier", () => {
  it("passes numeric ids through as numbers", () => {
    assert.equal(parsePostIdentifier("42"), 42);
  });

  it("passes publicId through as a string", () => {
    assert.equal(parsePostIdentifier("p_0123456789abcdef"), "p_0123456789abcdef");
    assert.equal(parsePostIdentifier("r_fedcba9876543210"), "r_fedcba9876543210");
  });

  it("rejects junk", () => {
    assert.throws(() => parsePostIdentifier("nope"), /publicId/);
    assert.throws(() => parsePostIdentifier("0"), /publicId/);
    assert.throws(() => parsePostIdentifier("p_short"), /publicId/);
  });
});

describe("displayUserId / formatAuthorName", () => {
  it("prefers publicId over numeric id", () => {
    const user = { id: 22, publicId: "u_0123456789abcdef" };
    assert.equal(displayUserId(user), "u_0123456789abcdef");
    assert.equal(
      formatAuthorName({ author: { ...user, name: "mika" } }),
      "mika",
    );
  });

  it("falls back to User <publicId> then numeric id when name is missing", () => {
    assert.equal(
      formatAuthorName({ author: { id: 22, publicId: "u_0123456789abcdef" } }),
      "User u_0123456789abcdef",
    );
    assert.equal(formatAuthorName({ author: { id: 22 }, authorId: 22 }), "User 22");
    assert.equal(formatAuthorName({ authorId: 22 }), "User 22");
    assert.equal(displayUserId({ id: 22 }), "22");
    assert.equal(displayUserId({ userId: 22 }), "22");
  });
});

describe("parseUserIdentifier", () => {
  it("passes numeric ids through as numbers", () => {
    assert.equal(parseUserIdentifier("22"), 22);
  });

  it("passes publicId through as a string", () => {
    assert.equal(parseUserIdentifier("u_0123456789abcdef"), "u_0123456789abcdef");
  });

  it("rejects junk", () => {
    assert.throws(() => parseUserIdentifier("nope"), /publicId/);
    assert.throws(() => parseUserIdentifier("0"), /publicId/);
    assert.throws(() => parseUserIdentifier("u_short"), /publicId/);
    assert.throws(() => parseUserIdentifier("p_0123456789abcdef"), /publicId/);
  });
});
