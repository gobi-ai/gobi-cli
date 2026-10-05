# CLI scenario header (`x-gobi-scenario`)

Contract between **gobi-cli**, **webdrive** (`AgentScenario.flow`), and **gobi-backend** (PR [#1471](https://github.com/gobi-ai/gobi-backend/pull/1471)) for Mixpanel `agent_cli_active` (CLI DAA/WAA).

## Why

gobi-backend's `cli-active.interceptor` fires `agent_cli_active` on authenticated requests that carry `x-app: cli`. Only gobi-cli sends that header.

In-app agents run the CLI inside containers. Webdrive already stamps `AgentScenario.flow` onto `ANTHROPIC_CUSTOM_HEADERS` for the LLM proxy, but that does not reach gobi → backend HTTP. Until those requests also carry `x-gobi-scenario`, the interceptor skip is inert.

## Header

| Header | Who sends it | When |
|--------|----------------|------|
| `x-app: cli` | Every authenticated gobi-cli API request | Always (unchanged) |
| `x-gobi-scenario: <flow>` | gobi-cli, when a flow is known | Same token as webdrive `AgentScenario.flow` |

`x-timezone` is unrelated (agent clock).

## How gobi-cli learns `<flow>`

First match wins:

1. **`GOBI_SCENARIO`** — preferred. Webdrive `server.py` should set this next to `ANTHROPIC_CUSTOM_HEADERS`.
2. **`ANTHROPIC_CUSTOM_HEADERS`** — parse the `x-gobi-scenario:` line (today's webdrive env) until (1) lands.

gobi-cli trims, lowercases, maps underscores to hyphens, and sends the result if it matches `^[a-z][a-z0-9-]{0,63}$`. Malformed or empty values are dropped (header omitted).

Terminal `gobi` with neither env set → header omitted → **counted**.

## Values (must match backend skip)

### Counted — fire `agent_cli_active`

| Situation | Flow | Header |
|-----------|------|--------|
| Human terminal `gobi …` | (none) | omit `x-gobi-scenario` |
| Human-visible in-app turn | `space` / `personal` / `visitor` / `free` | omit, or send that token |

Backend counts a **missing** header and these exact values:

- `space`
- `personal`
- `visitor`
- `free`

### Background — skip Redis NX and Mixpanel `agent_cli_active`

| Flow | Example header |
|------|----------------|
| `observe` | `x-gobi-scenario: observe` |
| `{scope}-{run_kind}` | `x-gobi-scenario: space-routine` |

`run_kind` values:

- `routine`
- `context-refresh`
- `digest`
- `dreamer`
- `checkin`
- `recap`
- `note`

Examples: `space-routine`, `space-context-refresh`, `personal-recap`.

Hyphens stay hyphens (`context-refresh`, not `context_refresh`). A bare `routine` without a scope is **not** a skip token.

## Orchestrator checklist

1. Terminal installs: leave `GOBI_SCENARIO` and `ANTHROPIC_CUSTOM_HEADERS` unset.
2. Human-visible chat (`space` / `personal` / `visitor` / `free`): omit the header, or send that counted token.
3. Background containers: set `GOBI_SCENARIO` to the same `AgentScenario.flow` already on `ANTHROPIC_CUSTOM_HEADERS` (`observe` or `{scope}-{run_kind}`).
4. Until webdrive exports `GOBI_SCENARIO`, gobi-cli reads the `x-gobi-scenario:` line from `ANTHROPIC_CUSTOM_HEADERS`.

## Interceptor sketch

```
if request has x-app: cli
  and the user is authenticated
  and x-gobi-scenario is not (observe or {scope}-{run_kind}):
    track agent_cli_active
```

Missing header ⇒ counted.

This repo does not change Mixpanel boards or KPI posting.
