---
name: gobi-draft
description: >-
  Gobi draft commands for managing agent-authored drafts: list, get, add,
  delete, prioritize, action, revise. Each draft carries 0–3 AI-suggested
  actions; the user picks one with `draft action`. The top-priority pending
  drafts feed into the agent's system prompt every turn. Use when the user
  wants to review, organize, or respond to drafts — or when an agent (using
  gobi-cli as its tool layer) wants to record a draft it just composed.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.0.0"
---

# gobi-draft

Gobi draft commands for managing agent-authored drafts (v2.0.0).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## What is a draft?

A draft is a unit of standing guidance authored by an agent (in-process during chat, or via `gobi draft add` when the agent uses gobi-cli as its tool layer). Each draft has:

- **title** — short headline (1–200 chars)
- **content** — the draft text (markdown, 1–8000 chars)
- **actions** — 0–3 AI-suggested action labels the user can pick from (e.g. "Accept", "Reject", "Schedule for later"). The agent generates these when authoring the draft.
- **sessionId** — required; the chat session that produced the draft
- **priority** — lower number = higher priority; default `100`
- **status** — `pending` until the user picks an action, then `actioned`
- **revision** — bumped each time the draft is revised
- **history** — append-only log of `created`, `revised`, `prioritized`, and `actioned` events

The top 5 pending drafts (lowest priority first) are injected into the agent's system prompt every turn — that's how drafts turn into standing instructions.

When invoked from inside an agent run, the runtime exports `GOBI_SESSION_ID` so `gobi draft add` picks it up automatically; otherwise pass `--session <uuid>`.

## Lifecycle

A draft is **authored** by an agent (`gobi draft add` with up to three `--action` flags). The user can then:

- **Take an action**: `gobi draft action <id> <index>` — flips status to `actioned`, the client posts the synthesized message ("Take action 'X' on draft Y") into the originating chat session.
- **Ask to revise**: `gobi draft revise <id> <comment>` — bumps revision and records the comment. The agent's next turn should produce a fresh `gobi draft revise --title --content --action ...` (or a new `add`) addressing the comment.
- **Re-prioritize / delete** as bookkeeping.

Only pending drafts can be revised. Picking an action is terminal; the agent can author a fresh draft if the user later changes their mind.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json draft list --limit 20
gobi --json draft add "Concise titles" "Prefer concise titles for personal posts." --action "Apply" --action "Skip" --priority 50
gobi --json draft action <draftId> 0
```

JSON mode wraps the response as `{"success": true, "data": <draft>}` (or `{"success": false, "error": "..."}`).

## Available Commands

- `gobi draft` — Drafts authored by your agent during chat. Each carries up to 3 AI-suggested actions. Top-5 pending feed the system prompt; picking an action posts a synthesized message into the originating session.
  - `gobi draft list` — List drafts (priority ASC, then newest first).
  - `gobi draft get` — Show one draft with its history and suggested actions.
  - `gobi draft add` — Add a draft. Pass `--action <label>` up to 3 times to attach AI-suggested actions.
  - `gobi draft delete` — Delete a draft.
  - `gobi draft prioritize` — Set priority (lower = higher). Top 5 feed the system prompt.
  - `gobi draft action` — Take one of the draft's suggested actions by 0-based index. Posts the synthesized message into the originating session.
  - `gobi draft revise` — Bump the draft to a new revision with a comment, optionally replacing title / content / actions.

## Reference Documentation

- [gobi draft](references/draft.md)
