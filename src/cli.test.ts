import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cli = join(__dirname, "..", "dist", "index.js");

function run(...args: string[]): string {
  return execFileSync("node", [cli, ...args], {
    encoding: "utf-8",
    timeout: 10_000,
  }).trim();
}

/** Like run() but captures stdout even when the process exits non-zero. */
function runCapture(...args: string[]): string {
  try {
    return run(...args);
  } catch (err: unknown) {
    const e = err as { stdout?: string };
    return (e.stdout ?? "").trim();
  }
}

describe("gobi cli", () => {
  it("prints version", () => {
    const out = run("--version");
    assert.match(out, /^\d+\.\d+\.\d+$/);
  });

  it("prints help", () => {
    const out = run("--help");
    assert.ok(out.includes("gobi"));
    assert.ok(out.includes("auth"));
    assert.ok(out.includes("space"));
    assert.ok(out.includes("vault"));
  });

  it("prints auth help", () => {
    const out = run("auth", "--help");
    assert.ok(out.includes("login"));
    assert.ok(out.includes("status"));
    assert.ok(out.includes("logout"));
  });

  it("prints space help", () => {
    const out = run("space", "--help");
    assert.ok(out.includes("warp"));
    assert.ok(out.includes("get"));
    assert.ok(out.includes("list-topics"));
    assert.ok(out.includes("list-topic-posts"));
    assert.ok(out.includes("feed"));
    assert.ok(out.includes("get-post"));
    assert.ok(out.includes("list-posts"));
    assert.ok(out.includes("create-post"));
    assert.ok(out.includes("edit-post"));
    assert.ok(out.includes("delete-post"));
    assert.ok(out.includes("create-reply"));
    assert.ok(out.includes("edit-reply"));
    assert.ok(out.includes("delete-reply"));
    assert.ok(out.includes("list-dms"));
    assert.ok(out.includes("open-dm"));
    assert.ok(out.includes("send-dm"));
    assert.ok(out.includes("dm-messages"));
    assert.ok(out.includes("agents"));
    // Removed sub-commands
    assert.ok(!/^\s+ancestors\b/m.test(out));
    assert.ok(!/^\s+messages\b/m.test(out));
    assert.ok(!/^\s+(get|list|create|edit|delete)-thread/m.test(out));
    // Admin operations (space create, member management) are web-UI only
    assert.ok(!out.includes("list-members"));
    assert.ok(!out.includes("invite-member"));
    assert.ok(!out.includes("join-space"));
    assert.ok(!out.includes("request-access"));
    assert.ok(!out.includes("accept-invite"));
    assert.ok(!out.includes("approve-member"));
    assert.ok(!out.includes("leave-space"));
  });

  it("space get-post help accepts publicId or numeric id", () => { // pineapple: 1.2.1253 numeric PK; delete after next app ship
    const out = run("space", "get-post", "--help");
    assert.match(out, /publicId/);
    assert.match(out, /numeric id/);
  });

  it("prints personal help", () => {
    const out = run("personal", "--help");
    assert.ok(out.includes("feed"));
    assert.ok(out.includes("list-posts"));
    assert.ok(out.includes("get-post"));
    assert.ok(out.includes("create-post"));
    assert.ok(out.includes("edit-post"));
    assert.ok(out.includes("delete-post"));
    assert.ok(out.includes("create-reply"));
    assert.ok(out.includes("edit-reply"));
    assert.ok(out.includes("delete-reply"));
    assert.ok(out.includes("list-dms"));
    assert.ok(out.includes("open-dm"));
    assert.ok(out.includes("send-dm"));
    assert.ok(out.includes("dm-messages"));
    assert.ok(out.includes("agents"));
  });

  it("space open-dm talks to members or a space bot by botId", () => {
    const help = run("space", "open-dm", "--help");
    assert.ok(help.includes("--user"));
    assert.ok(help.includes("--agent"));
    assert.ok(help.includes("--agent-user"));
    assert.match(help, /publicId \(u_…\)|u_…|u…/);
    assert.ok(!/--bot\b/.test(help));
    assert.match(help, /default space bot/);
    assert.ok(!help.includes("Only 'space' is accepted"));
    assert.ok(!/must be 'space'/.test(help));

    const badUser = JSON.parse(
      runCapture("--json", "space", "open-dm", "--user", "nope"),
    );
    assert.equal(badUser.success, false);
    assert.match(badUser.error, /publicId \(u/);

    const shortJunk = JSON.parse(
      runCapture("--json", "space", "open-dm", "--user", "u012345678"),
    );
    assert.equal(shortJunk.success, false);
    assert.match(shortJunk.error, /publicId \(u/);

    const both = JSON.parse(
      runCapture("--json", "space", "open-dm", "--user", "1", "--agent", "bot"),
    );
    assert.equal(both.success, false);
    assert.match(both.error, /mutually exclusive/);

    const userAndAgentUser = JSON.parse(
      runCapture("--json", "space", "open-dm", "--user", "1", "--agent-user", "42"),
    );
    assert.equal(userAndAgentUser.success, false);
    assert.match(userAndAgentUser.error, /mutually exclusive/);

    const agentAndAgentUser = JSON.parse(
      runCapture("--json", "space", "open-dm", "--agent", "bot", "--agent-user", "42"),
    );
    assert.equal(agentAndAgentUser.success, false);
    assert.match(agentAndAgentUser.error, /mutually exclusive/);
  });

  it("personal open-dm optionally takes --agent <botId>", () => {
    const help = run("personal", "open-dm", "--help");
    assert.ok(!/--user\b/.test(help));
    assert.ok(/--agent\b/.test(help));
    assert.ok(!/--bot\b/.test(help));
    assert.match(help, /default bot/);
  });

  it("personal and space agents are thin list/add/remove", () => {
    const personalHelp = run("personal", "agents", "--help");
    assert.ok(personalHelp.includes("add"));
    assert.ok(personalHelp.includes("remove"));
    assert.ok(!/--bot\b/.test(personalHelp));

    const personalAdd = run("personal", "agents", "add", "--help");
    assert.ok(personalAdd.includes("--id"));
    assert.ok(personalAdd.includes("--name"));
    assert.ok(!/--bot\b/.test(personalAdd));

    const spaceHelp = run("space", "agents", "--help");
    assert.ok(spaceHelp.includes("add"));
    assert.ok(spaceHelp.includes("remove"));
    assert.ok(spaceHelp.includes("--space-slug"));
    assert.ok(!/--bot\b/.test(spaceHelp));

    const spaceAdd = run("space", "agents", "add", "--help");
    assert.ok(spaceAdd.includes("--id"));
    assert.ok(spaceAdd.includes("--name"));
    assert.ok(spaceAdd.includes("--space-slug"));
    assert.ok(!/--bot\b/.test(spaceAdd));
  });

  it("personal send-dm mirrors space send-dm flags and validates locally", () => {
    const help = run("personal", "send-dm", "--help");
    assert.ok(help.includes("--content"));
    assert.ok(help.includes("--rich-text"));
    assert.ok(help.includes("--attach"));
    assert.ok(!help.includes("--space-slug"));

    const badId = JSON.parse(
      runCapture("--json", "personal", "send-dm", "nope", "--content", "hi"),
    );
    assert.equal(badId.success, false);
    assert.match(badId.error, /publicId \(d/);

    const shortJunk = JSON.parse(
      runCapture("--json", "personal", "send-dm", "d012345678", "--content", "hi"),
    );
    assert.equal(shortJunk.success, false);
    assert.match(shortJunk.error, /publicId \(d/);

    const empty = JSON.parse(runCapture("--json", "personal", "send-dm", "1"));
    assert.equal(empty.success, false);
    assert.match(empty.error, /--content, --rich-text, or --attach/);
  });

  it("space --channel and dm commands accept publicId or numeric id", () => {
    const feedHelp = run("space", "feed", "--help");
    assert.match(feedHelp, /publicId \(c/);
    const createHelp = run("space", "create-post", "--help");
    assert.match(createHelp, /publicId \(c/);
    const getChanHelp = run("space", "get-channel", "--help");
    assert.match(getChanHelp, /publicId \(c/);
    const sendHelp = run("space", "send-dm", "--help");
    assert.match(sendHelp, /publicId \(d/);
    const dmHelp = run("space", "dm-messages", "--help");
    assert.match(dmHelp, /publicId \(d/);

    const badChannel = JSON.parse(
      runCapture("--json", "space", "create-post", "--channel", "nope", "--content", "hi"),
    );
    assert.equal(badChannel.success, false);
    assert.match(badChannel.error, /publicId \(c/);

    const dmAsChannel = JSON.parse(
      runCapture("--json", "space", "create-post", "--channel", "d0123456789", "--content", "hi"),
    );
    assert.equal(dmAsChannel.success, false);
    assert.match(dmAsChannel.error, /publicId \(c/);

    const badDm = JSON.parse(
      runCapture("--json", "space", "send-dm", "nope", "--content", "hi"),
    );
    assert.equal(badDm.success, false);
    assert.match(badDm.error, /publicId \(d/);

    const channelAsDm = JSON.parse(
      runCapture("--json", "space", "send-dm", "c0123456789", "--content", "hi"),
    );
    assert.equal(channelAsDm.success, false);
    assert.match(channelAsDm.error, /publicId \(d/);
  });

  it("prints artifact help (personal only)", () => {
    // Artifacts moved from a top-level `gobi artifact` group to a scoped
    // subcommand under `gobi personal`. It is deliberately NOT under
    // `gobi space` — see the space-only guard below.
    const out = run("personal", "artifact", "--help");
    assert.ok(out.includes("create"));
    assert.ok(out.includes("revise"));
    // No `publish`: an artifact reads as its newest revision, so writing one is
    // what makes it live. `revert` restores an older revision as a new one.
    assert.ok(!out.includes("publish"));
    assert.ok(out.includes("revert"));
    assert.ok(out.includes("history"));
    assert.ok(out.includes("download"));
    assert.ok(out.includes("delete"));
    assert.ok(out.includes("get"));
    assert.ok(out.includes("list"));
  });

  it("prints vault help", () => {
    const out = run("vault", "--help");
    assert.ok(out.includes("init"));
    assert.ok(out.includes("list"));
    assert.ok(out.includes("publish"));
    assert.ok(out.includes("unpublish"));
    assert.ok(out.includes("sync"));
    assert.ok(out.includes("PUBLISH.md"));
  });

  it("prints activities + conversations help (personal only)", () => {
    // Sense moved from a top-level `gobi sense` group (list-activities /
    // list-transcriptions) to `activities` + `conversations` subcommands under
    // `gobi personal`. Transcriptions were unified into conversations.
    const activities = run("personal", "activities", "--help");
    assert.ok(activities.includes("list"));
    assert.ok(activities.includes("get"));
    assert.ok(activities.includes("transcript"));

    const conversations = run("personal", "conversations", "--help");
    assert.ok(conversations.includes("list"));
    assert.ok(conversations.includes("transcript"));
    assert.ok(conversations.includes("audio"));
  });

  it("exposes `conversations` under `gobi space` but not `activities`/`artifact`", () => {
    // A conversation captured while a space was active is filed with that space's
    // id, so `gobi space conversations` lists them for every member. But an
    // activity is always filed in the personal core (the backend exposes no
    // `:spaceSlug/activities` route), and artifacts live in the personal core
    // too — so those two must NOT appear under a space. A space-scoped artifact
    // created here would be invisible in the app and on web, so that half of the
    // guard is load-bearing, not cosmetic.
    const spaceHelp = run("space", "--help");
    assert.ok(
      /^\s*conversations\b/m.test(spaceHelp),
      "`gobi space conversations` should be registered",
    );
    for (const group of ["artifact", "activities"]) {
      assert.ok(
        !new RegExp(`^\\s*${group}\\b`, "m").test(spaceHelp),
        `\`gobi space ${group}\` must not be registered`,
      );
      // And invoking it must fail rather than silently falling through. Note
      // `run("space", group, "--help")` would NOT throw: commander short-circuits
      // on --help and prints the parent's help with exit 0, so the unknown
      // command is never validated. Invoke it WITHOUT --help to see the error.
      assert.throws(
        () => run("space", group, "list"),
        /unknown command/i,
        `\`gobi space ${group}\` should be rejected as an unknown command`,
      );
    }
    // The personal lane still has all three.
    const personalHelp = run("personal", "--help");
    for (const group of ["artifact", "activities", "conversations"]) {
      assert.ok(personalHelp.includes(group));
    }
  });

  it("no longer registers a top-level sense command", () => {
    const out = run("--help");
    assert.ok(!out.includes("sense"));
  });

  it("prints vault sync help with all flags", () => {
    const out = run("vault", "sync", "--help");
    assert.ok(out.includes("--upload-only"));
    assert.ok(out.includes("--download-only"));
    assert.ok(out.includes("--conflict"));
    assert.ok(out.includes("--dry-run"));
    assert.ok(out.includes("--dir"));
    assert.ok(out.includes("--full"));
    assert.ok(out.includes("--path"));
  });

  it("vault sync rejects --upload-only and --download-only together", () => {
    const out = runCapture(
      "--json",
      "vault",
      "sync",
      "--upload-only",
      "--download-only",
    );
    const result = JSON.parse(out);
    assert.equal(result.success, false);
    assert.ok(result.error.toLowerCase().includes("mutually exclusive"));
  });

  it("vault sync rejects invalid --conflict value", () => {
    const out = runCapture("--json", "vault", "sync", "--conflict", "bogus");
    const result = JSON.parse(out);
    assert.equal(result.success, false);
    assert.ok(result.error.includes("ask|server|client|skip"));
  });
});
