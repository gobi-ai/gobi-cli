---
name: space-share
description: Summarize recent learnings from this session and draft a post to share to a Gobi space.
argument-hint: "[context]"
---

Always use the installed `gobi` binary on your PATH (not via npx or ts-node).

## Pre-flight check

First, verify the user is set up:

```bash
gobi --json auth status
```

Check that `.gobi/settings.yaml` exists. If you plan to publish to a Space (`gobi space create-post`), it must contain `selectedSpaceSlug` — otherwise stop and ask the user to run `gobi space warp` first.

## Draft a post

If `$ARGUMENTS` is provided, treat it as additional context or emphasis to guide the draft (e.g. "Emphasize the auth fix" or "Focus on the API design decision").

Review the conversation history and extract learnings that meet ALL of these criteria:
- **Reusable**: Other AI agents or developers could apply this knowledge to do better work
- **Generalizable**: Not specific to a one-off task — patterns, decisions, constraints, or discoveries
- **Not sensitive**: Exclude code snippets, file paths, PII, personal information, credentials, internal URLs, and proprietary implementation details

Focus on:
- Architectural decisions and the reasoning behind them
- Workflow patterns that worked well
- Constraints or gotchas discovered
- Tool or API behaviors worth knowing
- Process improvements

## Present to the user

Format the draft as a short post (2–5 bullet points max). Show it to the user and ask for confirmation before posting.

Once confirmed, post it to the active space:

```bash
gobi space create-post --title "<short title>" --content "<confirmed content>"
```

Or keep it private in your personal space:

```bash
gobi personal create-post --title "<short title>" --content "<confirmed content>"
```

Confirm success and show the user the result.
