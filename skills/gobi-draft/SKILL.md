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
- **actions** — 0–3 AI-suggested actions. Each action is `{ label, message? }`:
  - `label` — short button text (1–80 chars) the user sees, e.g. `"Apply"`, `"Skip"`.
  - `message` — optional (≤2000 chars). What the user is taken to be saying to the agent when they click that button. Falls back to `label` when omitted. Use this whenever the click should send something more specific than the button text — e.g. label `"Punch it up"`, message `"Tighten the opening paragraph and shorten the CTA"`.
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
gobi --json draft add "Concise titles" "Prefer concise titles for personal posts." \
  --action "Apply::Yes, rewrite my last three posts with concise titles." \
  --action "Skip" \
  --priority 50
gobi --json draft action <draftId> 0
```

JSON mode wraps the response as `{"success": true, "data": <draft>}` (or `{"success": false, "error": "..."}`).

## Action `label::message` syntax

The `--action` flag (on both `add` and `revise`) accepts either form:

- `--action "Apply"` — label only; message falls back to `"Apply"` on click.
- `--action "Apply::Yes, rewrite my last three posts with concise titles."` — label is `Apply`, the click sends the full sentence as the user's next turn into the originating chat session.

The literal `::` separator splits the two. Use `message` whenever the click should send something more specific than the button text — that's the whole point of the field. Keep `label` punchy (a few words); put the actual instruction in `message`.

When the user picks an action via `gobi draft action <id> <index>`, the response includes the picked action's `message` (or `label` as fallback) in `data.actions[index]`, which the client then posts into the originating session.

## Available Commands

- `gobi draft` — Drafts authored by your agent during chat. Each carries up to 3 AI-suggested actions. Top-5 pending feed the system prompt; picking an action posts a synthesized message into the originating session.
  - `gobi draft list` — List drafts (priority ASC, then newest first).
  - `gobi draft get` — Show one draft with its history and suggested actions.
  - `gobi draft add` — Add a draft. Pass `--action <label[::message]>` up to 3 times to attach AI-suggested actions.
  - `gobi draft delete` — Delete a draft.
  - `gobi draft prioritize` — Set priority (lower = higher). Top 5 feed the system prompt.
  - `gobi draft action` — Take one of the draft's suggested actions by 0-based index. Posts the synthesized message into the originating session.
  - `gobi draft revise` — Bump the draft to a new revision with a comment, optionally replacing title / content / actions.

## Confirm before mutating

Drafts are agent-authored proposals — `add` and `revise` are the agent's normal authoring path and run without extra confirmation. Two commands flip that:

- `draft action <id> <index>` — picking an action is **a user decision**. Marks the draft `actioned` (terminal — the agent can't take it back) and posts the action's `message` into the originating session. Don't pick on the user's behalf; only run this when the user has explicitly told you which action to take.
- `draft delete <id>` — irreversible. Confirm the target id with the user before running.

`draft prioritize` is low-stakes (just reorders the prompt feed) — fine to run when the user asks.

## Reference Documentation

- [gobi draft](references/draft.md)
