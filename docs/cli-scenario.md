# CLI scenario header (`x-gobi-scenario`)

Contract between **gobi-cli** and **gobi-backend** for Mixpanel `agent_cli_active` (CLI DAA/WAA).

## Why

gobi-backend's `cli-active.interceptor` fires `agent_cli_active` on authenticated requests that carry `x-app: cli`. Only gobi-cli sends that header.

In-app agents run the CLI inside containers for background jobs (routines, context refresh, and other non-human-visible work). Those requests look identical to a person using the CLI, so they inflate DAA unless the job identifies itself.

## Header

| Header | Who sends it | When |
|--------|----------------|------|
| `x-app: cli` | Every authenticated gobi-cli API request | Always (unchanged) |
| `x-gobi-scenario: <job>` | gobi-cli, when `GOBI_SCENARIO` is set | Background container jobs, or an explicit counted scenario |

There is no older run-type / job-type header. `x-timezone` is unrelated (agent clock).

## Values

gobi-cli reads `GOBI_SCENARIO`, trims it, lowercases it, maps hyphens to underscores, and sends the result as `x-gobi-scenario` if it matches `^[a-z][a-z0-9_]{0,63}$`. Malformed or empty values are dropped (header omitted) so a stray env var cannot break a human session.

### Counted — fire `agent_cli_active`

These paths must keep counting. Prefer **omitting** the header (the default).

| Situation | `GOBI_SCENARIO` | Header |
|-----------|-----------------|--------|
| Human terminal `gobi …` | unset | omit `x-gobi-scenario` |
| Human-triggered chat / mention agent run | unset, or `chat` / `mention` | omit, or `x-gobi-scenario: chat` / `mention` |
| Explicit “this is the CLI” | `cli` (optional) | `x-gobi-scenario: cli` |

Backend: treat a missing header **and** these values as counted:

- `cli`
- `chat`
- `mention`

### Background — skip `agent_cli_active`

The container launcher (not the person, not the model) must set `GOBI_SCENARIO` before invoking gobi-cli.

| Job | `GOBI_SCENARIO` / header value |
|-----|--------------------------------|
| Scheduled / in-app routine | `routine` |
| Context refresh | `context_refresh` |
| Any other non-human-visible container job | snake_case token (e.g. `digest`) |

Backend skip list should include **at least** `routine` and `context_refresh`. Additional background kinds can reuse the same header without a CLI change: gobi-cli forwards any well-formed token; the interceptor's skip list is authoritative.

Do **not** mark human-triggered chat/mention runs as `routine` or `context_refresh`.

## Orchestrator checklist

1. Human terminal installs: leave `GOBI_SCENARIO` unset.
2. Chat / mention (and any other human-visible agent turn): leave it unset, or set `chat` / `mention`.
3. Routine containers: `GOBI_SCENARIO=routine`.
4. Context-refresh containers: `GOBI_SCENARIO=context_refresh`.
5. New background job types: pick a snake_case value, set the env in that container, add it to the interceptor skip list.

## Interceptor sketch

```
if request has x-app: cli
  and the user is authenticated
  and x-gobi-scenario is not in {routine, context_refresh, …background}:
    track agent_cli_active
```

Missing header ⇒ counted. That keeps today's human CLI and human-visible agent traffic unchanged.

This repo does not change Mixpanel boards or KPI posting.
