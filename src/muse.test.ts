import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const muse = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "MUSE.md"),
  "utf8",
);

describe("MUSE.md", () => {
  it("tells Muse to set up recurring Gobi tasks on first run", () => {
    assert.match(muse, /### Schedule setup \(first run\)/);
    assert.match(muse, /gobi --json personal context --since 24h/);
    // Check-ins read fresh captures from notes/activities via personal context;
    // the inbox no longer carries capture_* rows.
    assert.match(muse, /gobi --json personal context --since 6h/);
    assert.doesNotMatch(muse, /Run `gobi --json notifications list --type capture`/);
    assert.ok(muse.includes("Gobi daily snapshot."));
    assert.ok(muse.includes("Gobi check-in."));
    assert.ok(
      !muse.includes("otherwise the first session of the day"),
      "prefer the scheduled task; first session is fallback only",
    );
    assert.match(muse, /Prefer the daily scheduled task/);
    assert.match(muse, /first session of the day/);
  });

  it("defines a silent scheduled run with the interruptibility gate", () => {
    assert.match(muse, /### Scheduled run/);
    assert.match(muse, /no user message/);
    assert.match(muse, /도와줄까\?/);
    assert.match(muse, /want me to help\?/);
    assert.match(muse, /in a meeting/);
    assert.match(muse, /driving/);
    assert.match(muse, /working out/);
    assert.match(muse, /sleeping/);
    assert.match(muse, /send \*\*nothing\*\*/);
    assert.match(muse, /item IDs/);
    assert.match(muse, /last run time/);
  });

  it("notes Meta Muse recurring tasks, Upcoming, and scheduled-task approval", () => {
    assert.match(muse, /Host: Meta Muse/);
    assert.match(muse, /Upcoming/);
    assert.match(muse, /Artifacts and scheduled tasks/);
    assert.match(
      muse,
      /https:\/\/www\.meta\.com\/help\/artificial-intelligence\/1484325780075655\//,
    );
  });

  it("is bundled with the CLI package, not served by a gobi subcommand", () => {
    // Personal assistants read this file from the npm package (or GitHub).
    // There is no `gobi docs` / `gobi muse` command that prints it.
    const pkg = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
        "utf8",
      ),
    ) as { files: string[] };
    assert.ok(pkg.files.includes("MUSE.md"));
  });
});
