import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compactPost, parsePostId, replyToPersonalPost, listSpacePosts } from "./posts.js";
import { mockApi } from "./test-helpers.js";

describe("posts helpers", () => {
  it("parsePostId accepts p… / r…", () => {
    assert.equal(parsePostId("p0123456789"), "p0123456789");
    assert.equal(parsePostId("r0123456789"), "r0123456789");
    assert.throws(() => parsePostId("o0123456789"));
  });

  it("compactPost prefers publicId and user.name", () => {
    const row = compactPost({
      publicId: "p0123456789",
      title: "Hello",
      content: "body",
      createdAt: "2026-10-15T00:00:00.000Z",
      replyCount: 2,
      user: { name: "Ada" },
    });
    assert.equal(row.id, "p0123456789");
    assert.equal(row.author, "Ada");
  });

  it("listSpacePosts and replyToPersonalPost hit CLI paths", async () => {
    const { api, calls } = mockApi([
      {
        path: "/spaces/demo/posts",
        body: { data: [{ publicId: "p0123456789", title: "Standup notes", content: "hi" }], pagination: {} },
      },
      {
        method: "POST",
        path: "/posts/p0123456789/replies",
        body: { publicId: "r0123456789", content: "on it" },
      },
    ]);
    const listed = await listSpacePosts(api, "demo");
    assert.equal(listed.posts[0]?.id, "p0123456789");
    const replied = await replyToPersonalPost(api, "p0123456789", { content: "on it" });
    assert.equal(replied.reply.id, "r0123456789");
    assert.ok(calls.some((c) => c.method === "POST" && c.url.includes("/posts/p0123456789/replies")));
  });
});
