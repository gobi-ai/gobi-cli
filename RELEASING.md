# Releasing gobi-cli

## Prerequisites

- Push access to `gobi-ai/gobi-cli` and `gobi-ai/homebrew-tap`
- `NPM_TOKEN` secret configured in GitHub Actions (for automated npm publish)

## Steps

### 1. Bump version (all files must match)

```sh
# Update package.json version
npm version patch   # or minor / major

# Update .claude-plugin/marketplace.json (both version fields)
# Regenerate skill docs (picks up new version from package.json)
npm run generate-skill-docs
```

Commit everything together:

```sh
git add package.json .claude-plugin/marketplace.json skills/
git commit -m "Bump version to $(node -p 'require("./package.json").version')"
```

### 2. Tag and push

```sh
git push
git push --tags
```

This triggers the GitHub Actions release workflow (`.github/workflows/release.yml`) which:
- Runs tests
- Creates a GitHub Release with release notes
- Publishes to **npm** with provenance

### 3. Update Homebrew formula

Get the SHA256 of the published npm tarball and update the formula:

```sh
VERSION=$(node -p 'require("./package.json").version')

# Get SHA256
curl -sL "https://registry.npmjs.org/@gobi-ai/cli/-/cli-${VERSION}.tgz" | shasum -a 256

# Update gobi-ai/homebrew-tap Formula/gobi.rb with new version and sha256
```

Or via GitHub API:

```sh
VERSION=$(node -p 'require("./package.json").version')
SHA256=$(curl -sL "https://registry.npmjs.org/@gobi-ai/cli/-/cli-${VERSION}.tgz" | shasum -a 256 | cut -d' ' -f1)

# Write formula
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

# Push via GitHub API
CONTENT=$(base64 < /tmp/gobi-formula.rb | tr -d '\n')
FILE_SHA=$(gh api repos/gobi-ai/homebrew-tap/contents/Formula/gobi.rb --jq .sha)
gh api repos/gobi-ai/homebrew-tap/contents/Formula/gobi.rb \
  -X PUT \
  -f message="Update gobi formula to v${VERSION}" \
  -f content="${CONTENT}" \
  -f sha="${FILE_SHA}"
```

### 4. Publish to skill.sh

TODO: Add skill.sh publish instructions.

## Summary

| Target | Method |
|--------|--------|
| **npm** | Automatic via GitHub Actions on `v*` tag push |
| **GitHub Release** | Automatic via GitHub Actions on `v*` tag push |
| **Claude Marketplace** | Update `.claude-plugin/marketplace.json` and push to main |
| **Homebrew** | Update `gobi-ai/homebrew-tap` Formula/gobi.rb |
| **skill.sh** | TODO |
