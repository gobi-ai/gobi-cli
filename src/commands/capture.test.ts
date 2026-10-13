import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { noteReadError, noteSourceLabel } from "./capture.js";
import { ApiError, GobiError } from "../errors.js";

describe("notes get — transcript 404", () => {
  it("turns a 404 into one clear, non-retryable error", () => {
    const err = noteReadError(
      "o0123456789",
      new ApiError(404, "/app/conversations/o0123456789/transcript", '{"message":"Conversation not found"}'),
    );
    assert.ok(err instanceof GobiError);
    assert.equal(err.code, "NOTE_NOT_READABLE");
    assert.ok(err.message.startsWith("Note o0123456789"));
    assert.ok(err.message.includes("o0123456789"));
    assert.ok(err.message.includes("does not exist"));
    assert.ok(err.message.includes("not its recorder"));
    assert.ok(err.message.includes("member of its space"));
    assert.ok(err.message.includes("acts for"));
    assert.ok(err.message.includes("Retrying will not help"));
  });

  it("passes every other failure through untouched", () => {
    const forbidden = new ApiError(403, "/x", "nope");
    assert.equal(noteReadError("o1", forbidden), forbidden);
    const gateway = new ApiError(502, "/x", "bad gateway");
    assert.equal(noteReadError("o1", gateway), gateway);
    const plain = new Error("boom");
    assert.equal(noteReadError("o1", plain), plain);
  });
});

describe("noteSourceLabel", () => {
  it("names what a note was made from, for old and new stored spellings", () => {
    for (const s of ["mobile", "watch", "desktop"]) assert.equal(noteSourceLabel(s), "audio log");
    for (const s of ["import-video", "video", "post-video"]) assert.equal(noteSourceLabel(s), "video log");
    for (const s of ["meet", "meet-video"]) assert.equal(noteSourceLabel(s), "meeting");
    for (const s of ["import-audio", "import", "post-audio"]) assert.equal(noteSourceLabel(s), "imported audio");
    assert.equal(noteSourceLabel("sense"), "Sense");
    assert.equal(noteSourceLabel("text"), "written note");
    assert.equal(noteSourceLabel(undefined), "note");
    assert.equal(noteSourceLabel("something-new"), "note");
  });
});
