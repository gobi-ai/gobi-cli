import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  mintConfirmToken,
  payloadKey,
  resetConfirmStore,
  takeConfirmToken,
} from "./confirm.js";

describe("confirm tokens", () => {
  beforeEach(() => resetConfirmStore());

  it("mints and consumes a token bound to action + payload", () => {
    const payload = { postId: "p0123456789", content: "hi" };
    const token = mintConfirmToken("gobi_reply_to_post", payload, "preview");
    assert.match(token, /^gobi_cf_/);
    assert.equal(takeConfirmToken(token, "gobi_reply_to_post", payload)?.action, "gobi_reply_to_post");
    assert.equal(takeConfirmToken(token, "gobi_reply_to_post", payload), null);
  });

  it("rejects a token for a different action or payload", () => {
    const payload = { postId: "p0123456789", content: "hi" };
    const token = mintConfirmToken("gobi_reply_to_post", payload, "preview");
    assert.equal(takeConfirmToken(token, "gobi_reply_to_space_post", payload), null);
    const token2 = mintConfirmToken("gobi_reply_to_post", payload, "preview");
    assert.equal(takeConfirmToken(token2, "gobi_reply_to_post", { ...payload, content: "other" }), null);
  });

  it("payloadKey is order-insensitive", () => {
    assert.equal(payloadKey({ a: 1, b: 2 }), payloadKey({ b: 2, a: 1 }));
  });
});
