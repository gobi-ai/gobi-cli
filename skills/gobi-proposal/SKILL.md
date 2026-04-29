---
name: gobi-proposal
description: >-
  Gobi proposal commands for managing agent-authored proposals: list, get, add,
  edit, delete, prioritize, accept, reject, or revise. The top-priority pending
  proposals feed into the agent's system prompt every turn. Use when the user
  wants to review, organize, or respond to proposals — or when an agent (using
  gobi-cli as its tool layer) wants to record a proposal it just composed.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "1.3.4"
---

# gobi-proposal

Gobi proposal commands for managing agent-authored proposals (v1.3.4).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## What is a proposal?

A proposal is a unit of standing guidance authored by an agent (in-process during chat, or via `gobi proposal add` when the agent uses gobi-cli as its tool layer). Each proposal has:

- **title** — short headline (1–200 chars)
- **content** — the proposal text (markdown, 1–8000 chars)
- **sessionId** — required; the chat session that produced the proposal
- **priority** — lower number = higher priority; default `100`
- **status** — `pending`, `accepted`, or `rejected`
- **revision** — bumped each time the title or content is edited
- **history** — append-only log of `created`, `edited`, `prioritized`, `accepted`, `rejected`, and `revise_requested` events

The top 5 pending proposals (lowest priority first) are injected into the agent's system prompt every turn — that's how proposals turn into standing instructions.

When invoked from inside an agent run, the runtime exports `GOBI_SESSION_ID` so `gobi proposal add` picks it up automatically; otherwise pass `--session <uuid>`.

## Lifecycle

`accept`, `reject`, and `revise` update the proposal's status and history. They do **not** themselves post messages into the chat session — the client (e.g. the floating proposal bubble) opens at `proposal.sessionId` and sends the synthesized message via SSE so the user sees the agent's reply stream in. Only pending proposals can be revised.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json proposal list --limit 20
gobi --json proposal add "Concise titles" "Prefer concise titles for brain updates." --priority 50
```

JSON mode wraps the response as `{"success": true, "data": <proposal>}` (or `{"success": false, "error": "..."}`).

## Available Commands

- `gobi proposal` — Proposals authored by your agent during chat. Top-5 feed the system prompt; accept/reject/revise post into the originating chat session.
  - `gobi proposal list` — List proposals (priority ASC, then newest first).
  - `gobi proposal get` — Show one proposal with its history.
  - `gobi proposal edit` — Replace proposal content (bumps revision). Pass '-' for stdin.
  - `gobi proposal delete` — Delete a proposal.
  - `gobi proposal prioritize` — Set priority (lower = higher). Top 5 feed the system prompt.
  - `gobi proposal accept` — Accept — posts "Accept your proposal X" into the originating chat session.
  - `gobi proposal reject` — Reject — posts "Reject your proposal X" into the originating chat session.
  - `gobi proposal revise` — Ask the agent to revise — posts "Update your proposal X. Here's my comment. {comment}" into the chat session.

## Reference Documentation

- [gobi proposal](references/proposal.md)
