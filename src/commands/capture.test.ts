import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { conversationReadError } from "./capture.js";
import { ApiError, GobiError } from "../errors.js";

describe("conversations get — transcript 404", () => {
  it("turns a 404 into one clear, non-retryable error", () => {
    const err = conversationReadError(
      "o0123456789",
      new ApiError(404, "/app/conversations/o0123456789/transcript", '{"message":"Conversation not found"}'),
    );
    assert.ok(err instanceof GobiError);
    assert.equal(err.code, "CONVERSATION_NOT_READABLE");
    assert.ok(err.message.includes("o0123456789"));
    assert.ok(err.message.includes("does not exist"));
    assert.ok(err.message.includes("not its recorder"));
    assert.ok(err.message.includes("member of its space"));
    assert.ok(err.message.includes("acts for"));
    assert.ok(err.message.includes("Retrying will not help"));
  });

  it("passes every other failure through untouched", () => {
    const forbidden = new ApiError(403, "/x", "nope");
    assert.equal(conversationReadError("o1", forbidden), forbidden);
    const gateway = new ApiError(502, "/x", "bad gateway");
    assert.equal(conversationReadError("o1", gateway), gateway);
    const plain = new Error("boom");
    assert.equal(conversationReadError("o1", plain), plain);
  });
});
