---
name: release
description: Release a new version of gobi-cli to npm, Homebrew, and Claude Marketplace.
argument-hint: "[patch|minor|major]"
---

Release a new version of gobi-cli. Default to `patch` if no argument given.

## Step 1 — Bump version

```bash
npm version $ARGUMENTS
```

Then update `.claude-plugin/marketplace.json` to match the new version (both `version` fields), and regenerate skill docs:

```bash
npm run generate-skill-docs
```

Commit everything:

```bash
VERSION=$(node -p 'require("./package.json").version')
git add package.json .claude-plugin/marketplace.json skills/
git commit -m "Bump version to ${VERSION}"
```

## Step 2 — Tag and push

```bash
git push
git push --tags
```

This triggers the GitHub Actions release workflow which runs tests, creates a GitHub Release, and publishes to **npm** automatically.

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

## Step 4 — Confirm

Summarize what was released:
- npm version published
- GitHub Release created
- Homebrew formula updated
- Remind user that Claude Marketplace update requires pushing to main (already done in step 2)
