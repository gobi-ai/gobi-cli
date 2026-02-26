import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AstraError,
  NotAuthenticatedError,
  TokenRefreshError,
  ApiError,
  DeviceCodeError,
} from "./errors.js";

describe("AstraError", () => {
  it("sets message and code", () => {
    const err = new AstraError("test message", "TEST_CODE");
    assert.equal(err.message, "test message");
    assert.equal(err.code, "TEST_CODE");
    assert.equal(err.name, "AstraError");
    assert.ok(err instanceof Error);
  });
});

describe("NotAuthenticatedError", () => {
  it("has correct code and message", () => {
    const err = new NotAuthenticatedError();
    assert.equal(err.code, "NOT_AUTHENTICATED");
    assert.ok(err.message.includes("gobi auth login"));
    assert.ok(err instanceof AstraError);
  });
});

describe("TokenRefreshError", () => {
  it("includes detail in message", () => {
    const err = new TokenRefreshError("token expired");
    assert.equal(err.code, "TOKEN_REFRESH_FAILED");
    assert.ok(err.message.includes("token expired"));
    assert.ok(err instanceof AstraError);
  });
});

describe("ApiError", () => {
  it("parses JSON body for message", () => {
    const err = new ApiError(400, "/test", '{"message":"bad request"}');
    assert.equal(err.status, 400);
    assert.equal(err.endpoint, "/test");
    assert.equal(err.message, "bad request");
    assert.equal(err.code, "API_ERROR");
  });

  it("uses raw body when JSON parse fails", () => {
    const err = new ApiError(500, "/fail", "plain text error");
    assert.equal(err.message, "plain text error");
  });
});

describe("DeviceCodeError", () => {
  it("includes detail in message", () => {
    const err = new DeviceCodeError("flow timed out");
    assert.equal(err.code, "DEVICE_CODE_ERROR");
    assert.ok(err.message.includes("flow timed out"));
    assert.ok(err instanceof AstraError);
  });
});
