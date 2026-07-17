---
name: release
description: Release a new version of gobi-cli to npm, Homebrew, and Claude Marketplace.
argument-hint: "[patch|minor|major]"
---

Release a new version of gobi-cli. Default to `patch` if no argument given.

## Step 1 — Bump version

```bash
npm version $ARGUMENTS --no-git-tag-version
```

`--no-git-tag-version` matters: plain `npm version` commits and tags immediately, which lands the tag *before* the regenerated docs and manifests below. The tag is created by hand in step 2, once everything is in.

Then update `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json` to match the new version, regenerate skill docs, and rebuild the cheatsheet so its header version stays in sync:

```bash
npm run generate-skill-docs
( cd docs/cheatsheet && python3 build.py )
```

Two things that have silently broken past releases — check both:

- **The `.claude-plugin/` manifests are not touched by `npm version`.** They must be edited by hand. They sat at 2.0.40 through the 2.0.41 and 2.0.42 releases, so the Marketplace (and the `.claude-plugin` the agent image copies out of the CLI) served a stale version for two releases.
- **`build.py` writes the HTML before it imports playwright.** Without playwright installed it still stamps `gobi-cli-cheatsheet.html`, then fails on the PDF render. That failure is expected — the HTML is what matters. Confirm the HTML diff is only the version line; the PDF has been stale since ~v2.0.11 and is not rebuilt here.

Commit everything — including `package-lock.json`, whose version field `npm version` also bumps. Leaving it out drifts the lock from `package.json`:

```bash
VERSION=$(node -p 'require("./package.json").version')
git add package.json package-lock.json .claude-plugin/ skills/ docs/cheatsheet/
git commit -m "Bump version to ${VERSION}"
```

Land any actual code changes in their own commit first — the `git add` list above is deliberately narrow and will not pick up `src/` or `README.md`.

## Step 2 — Merge to main, then tag the merge commit

The release tag goes on the **merge commit on main**, not on the bump commit on develop — that is how v2.0.41 and v2.0.42 shipped. `origin/HEAD` is main, and the Claude Marketplace reads `.claude-plugin/` from it, so tagging develop would publish to npm and Homebrew while leaving the Marketplace on the old version.

```bash
VERSION=$(node -p 'require("./package.json").version')
git push origin develop
gh pr create --base main --head develop --title "Release v${VERSION}"   # add a body describing the release
gh pr merge --merge
git fetch origin
git tag "v${VERSION}" origin/main
git push origin "v${VERSION}"
```

Pushing the tag triggers the GitHub Actions release workflow, which runs tests, creates a GitHub Release, and publishes to **npm** automatically. Watch it (`gh run watch`) rather than assuming it passed.

## Step 3 — Update Homebrew formula

Wait ~1 minute for npm to publish, then:

```bash
VERSION=$(node -p 'require("./package.json").version')
SHA256=$(curl -sL "https://registry.npmjs.org/@gobi-ai/cli/-/cli-${VERSION}.tgz" | shasum -a 256 | cut -d' ' -f1)

cat > /tmp/gobi-formula.rb <<FORMULA
class Gobi < Formula
  desc "CLI client for the Gobi collaborative knowledge platform"
  homepage "https://github.com/gobi-ai/gobi-cli"
  url "https://registry.npmjs.org/@gobi-ai/cli/-/cli-${VERSION}.tgz"
  sha256 "${SHA256}"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/gobi --version")
  end
end
FORMULA

CONTENT=$(base64 < /tmp/gobi-formula.rb | tr -d '\n')
FILE_SHA=$(gh api repos/gobi-ai/homebrew-tap/contents/Formula/gobi.rb --jq .sha)
gh api repos/gobi-ai/homebrew-tap/contents/Formula/gobi.rb \
  -X PUT \
  -f message="Update gobi formula to v${VERSION}" \
  -f content="${CONTENT}" \
  -f sha="${FILE_SHA}"
```

## Step 4 — Roll the gobi-agent image onto the new CLI

The `gobi-agent` pods bundle the CLI (`npm install -g @gobi-ai/cli@latest` at image build time), so they keep running the old version until the image is rebuilt. Do this now, as part of the release.

Read `~/GitHub/gobi-webdrive/.claude/commands/update-gobi-cli.md` and follow it exactly, with `$ARGUMENTS` set to the version released above:

```bash
VERSION=$(node -p 'require("./package.json").version')   # pass this as the command's argument
```

Run its steps from the `~/GitHub/gobi-webdrive` repo. That file is the source of truth — do not reproduce its commands from memory here. In brief, it: polls npm until `latest` equals `${VERSION}` (up to 15 min, so the build can't pick up a stale CLI), builds the agent image via Cloud Build, restarts the `gobi-agent` deployment, and waits for the rollout.

If that file is missing, stop and tell the user — report the release as published but not deployed, rather than improvising a deploy.

If the npm poll times out or the build/rollout fails, report it verbatim and stop. The npm publish and Homebrew formula are already live at that point; only the agent rollout is outstanding, and it can be retried later with `/update-gobi-cli ${VERSION}` from gobi-webdrive.

## Step 5 — Confirm

Summarize what was released:
- npm version published
- GitHub Release created
- Homebrew formula updated
- gobi-agent image rebuilt and rolled out (or why it didn't), verified by `gobi --version` in the new pod
- Claude Marketplace: picked up via the merge to main in step 2 — confirm `.claude-plugin/` on main carries the new version
