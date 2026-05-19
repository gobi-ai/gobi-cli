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
  version: "2.0.10"
---

# gobi-draft

Gobi draft commands for managing agent-authored drafts (v2.0.9).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## What is a draft?

A draft is a unit of standing guidance authored by an agent (in-process during chat, or via `gobi draft add` when the agent uses gobi-cli as its tool layer). Each draft has:

- **title** — short headline (1–200 chars)
- **content** — the draft text (markdown, 1–8000 chars)
- **actions** — 0–3 AI-suggested actions. Each action is `{ label, message? }`:
  - `label` — short button text (1–80 chars) the user sees, e.g. `"Apply"`, `"Skip"`.
  - `message` — optional (≤2000 chars). What the user is taken to be saying to the agent when they click that button. Falls back to `label` when omitted. Use this whenever the click should send something more specific than the button text — e.g. label `"Punch it up"`, message `"Tighten the opening paragraph and shorten the CTA"`.
- **sessionId** — the chat session the draft is anchored to. Optional on create: when omitted, the server mints a fresh session anchored to the draft's vault (or the user's primary if `vaultSlug` is unset) and seeds it with a tool-call entry representing the draft, so clicking an action later has somewhere to land.
- **vaultSlug** — optional anchor vault slug. When set, clients render the draft against this vault's identity and the bootstrap session (created when no `sessionId` is passed) is anchored here instead of the user's primary. Pass `--vault-slug <slug>` on `add` or `revise`. Caller must own the vault.
- **priority** — lower number = higher priority; default `100`
- **status** — `pending` until the user picks an action, then `actioned`
- **revision** — bumped each time the draft is revised
- **history** — append-only log of `created`, `revised`, `prioritized`, and `actioned` events

The top 5 pending drafts (lowest priority first) are injected into the agent's system prompt every turn — that's how drafts turn into standing instructions.

When invoked from inside the Gobi agent runtime, `GOBI_SESSION_ID` is exported and `gobi draft add` picks it up automatically. Outside that runtime (e.g. local Claude Code, ad-hoc shells), you can either pass `--session <uuid>` to anchor to an existing chat session, or omit it entirely — the server will mint a new session and seed it with the draft so the action click lands somewhere coherent.

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

## Linking a created post back to its draft

When the user picks an action like "Post to Global Feed" / "Post to <space>" / "Save as note" and your next turn creates the post or note, pass `--draft-id <draftId>` to the relevant create command. `--draft-id` is the **sole** source of `title` and `content` — the CLI fetches the draft and uses its title and content directly, so `--title` / `--content` / `--rich-text` are not allowed alongside it on `create-post`, and `--content` is not allowed alongside it on `create-note`. If you want to change the wording, `gobi draft revise` first, then create.

- `gobi space create-post --draft-id` / `gobi global create-post --draft-id` — uses draft's title and content as the post's `title` and `content`. The draft's `vaultSlug` (when set) seeds `--vault-slug` if not given explicitly. `--auto-attachments`, `--space-slug`, and an explicit `--vault-slug` override remain allowed. Records `{ postId, spaceSlug? }` on `draft.metadata` for an "Open post" button.

```bash
gobi --json global create-post --draft-id <draftId>
gobi --json space create-post --space-slug <slug> --draft-id <draftId>
gobi --json global create-post --draft-id <draftId> --auto-attachments
```

## Available Commands

- `gobi draft` — Drafts authored by your agent during chat. Each carries up to 3 AI-suggested actions. Top-5 pending feed the system prompt; picking an action posts a synthesized message into the originating session.
  - `gobi draft list` — List drafts (priority ASC, then newest first).
  - `gobi draft get` — Show one draft with its history and suggested actions.
  - `gobi draft add` — Add a draft. Pass `--action <label[::message]>` up to 3 times to attach AI-suggested actions. Pass `--vault-slug <slug>` to anchor the draft to a specific vault.
  - `gobi draft delete` — Delete a draft.
  - `gobi draft prioritize` — Set priority (lower = higher). Top 5 feed the system prompt.
  - `gobi draft action` — Take one of the draft's suggested actions by 0-based index. Posts the synthesized message into the originating session.
  - `gobi draft revise` — Bump the draft to a new revision with a comment, optionally replacing title / content / actions / vault-slug.

## Confirm before mutating

Drafts are agent-authored proposals — `add` and `revise` are the agent's normal authoring path and run without extra confirmation. Two commands flip that:

- `draft action <id> <index>` — picking an action is **a user decision**. Marks the draft `actioned` (terminal — the agent can't take it back) and posts the action's `message` into the originating session. Don't pick on the user's behalf; only run this when the user has explicitly told you which action to take.
- `draft delete <id>` — irreversible. Confirm the target id with the user before running.

`draft prioritize` is low-stakes (just reorders the prompt feed) — fine to run when the user asks.

## Reference Documentation

- [gobi draft](references/draft.md)
