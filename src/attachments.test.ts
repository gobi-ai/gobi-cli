import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "path";
import { extractWikiLinks, kindForPath, resolveWikiLinkTarget } from "./attachments.js";

describe("resolveWikiLinkTarget", () => {
  const base = "/tmp/project-root";

  it("resolves ordinary links inside the base directory", () => {
    assert.equal(resolveWikiLinkTarget(base, "notes/a.md"), resolve(base, "notes/a.md"));
    assert.equal(resolveWikiLinkTarget(base, "a"), resolve(base, "a"));
  });

  it("returns null for links that escape the base directory", () => {
    assert.equal(resolveWikiLinkTarget(base, "../secret.md"), null);
    assert.equal(resolveWikiLinkTarget(base, "notes/../../secret.md"), null);
    assert.equal(resolveWikiLinkTarget(base, ".."), null);
  });

  it("returns null for absolute links", () => {
    assert.equal(resolveWikiLinkTarget(base, "/etc/passwd"), null);
  });

  it("returns null for empty, NUL, and base-dir-itself links", () => {
    assert.equal(resolveWikiLinkTarget(base, ""), null);
    assert.equal(resolveWikiLinkTarget(base, "a\0b"), null);
    assert.equal(resolveWikiLinkTarget(base, "."), null);
  });

  it("allows dot segments that stay inside the base directory", () => {
    assert.equal(
      resolveWikiLinkTarget(base, "notes/../a.md"),
      resolve(base, "a.md"),
    );
  });
});

describe("extractWikiLinks", () => {
  it("extracts unique links in order", () => {
    const links = extractWikiLinks("see [[a]] and [[b.md]] and [[a]] again");
    assert.deepEqual(links, ["a", "b.md"]);
  });

  it("returns empty for content without links", () => {
    assert.deepEqual(extractWikiLinks("no links here"), []);
  });
});

describe("kindForPath", () => {
  it("classifies media and documents", () => {
    assert.equal(kindForPath("x.png"), "photo");
    assert.equal(kindForPath("x.gif"), "gif");
    assert.equal(kindForPath("x.mp4"), "video");
    assert.equal(kindForPath("x.pdf"), "file");
    assert.equal(kindForPath("x.unknown"), "file");
  });
});
