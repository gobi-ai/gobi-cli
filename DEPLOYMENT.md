# Deployment

How to release a new version of gobi-cli to all channels.

## Prerequisites

- Push access to `gobi-ai/gobi-cli`
- `NPM_TOKEN` secret configured in GitHub repo settings
- Homebrew tap repo: `gobi-ai/homebrew-tap`
- Claude Code CLI installed (for marketplace update)

## Steps

### 1. Bump version

Update version in **all three** files to the same value:

```
package.json
.claude-plugin/marketplace.json   (top-level + plugins[0].version)
.claude-plugin/plugin.json
```

### 2. Regenerate skill docs

```sh
npm run generate-skill-docs
```

This builds the CLI, then regenerates `skills/gobi-cli/SKILL.md` and `skills/gobi-cli/references/` from `--help` output.

### 3. Commit and push

```sh
git add -A
git commit -m "Bump version to X.Y.Z"
git push
```

### 4. Tag and push — triggers npm + GitHub Release

```sh
git tag vX.Y.Z
git push origin vX.Y.Z
```

The `release.yml` workflow will:
- Build and test
- Publish to npm (`@gobi-ai/cli`) with provenance
- Create a GitHub Release with the `.tgz` tarball

### 5. Update Homebrew formula

After the npm package is published, get the SHA256:

```sh
curl -sL https://registry.npmjs.org/@gobi-ai/cli/-/cli-X.Y.Z.tgz | shasum -a 256
```

Update `Formula/gobi.rb`:
- `url` → new `.tgz` URL
- `sha256` → new hash

Commit and push. Then update the tap repo (`gobi-ai/homebrew-tap`) if it's a separate repo.

### 6. Claude Code marketplace

The marketplace reads from `.claude-plugin/` in the repo. Once pushed, users get the update:

```sh
claude plugin marketplace update gobi-cli
```

No deploy step needed — the marketplace pulls from the GitHub repo directly.

### 7. skills.sh

No deploy step needed. skills.sh auto-indexes `skills/gobi-cli/SKILL.md` from the GitHub repo. Once pushed, it's live:

```sh
npx skills add gobi-ai/gobi-cli
```

## Quick checklist

```
[ ] Version bumped in package.json, marketplace.json, plugin.json
[ ] npm run generate-skill-docs (no stale docs)
[ ] Committed and pushed
[ ] Tagged vX.Y.Z and pushed tag
[ ] GitHub Actions release workflow passed
[ ] npm package published (@gobi-ai/cli)
[ ] Homebrew formula updated with new SHA256
[ ] Verified: brew install gobi / brew upgrade gobi
[ ] Verified: claude plugin marketplace update gobi-cli
[ ] Verified: npx skills add gobi-ai/gobi-cli
```
