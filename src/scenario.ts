/**
 * CLI ↔ backend contract for Mixpanel `agent_cli_active` (DAA/WAA).
 *
 * gobi-backend's `cli-active.interceptor` fires that event on authenticated
 * requests that carry `x-app: cli`. Only this CLI sends that header. In-app
 * agents also run the CLI inside containers, so background jobs (routines,
 * context refresh, …) would inflate DAA unless they identify themselves.
 *
 * Header: `x-gobi-scenario`
 * Env:    `GOBI_SCENARIO`  (set by the container launcher, not by humans)
 *
 * Counted (event fires) — header omitted, or an explicit human-visible value:
 *   cli | chat | mention
 *
 * Background (backend should skip the event) — at least:
 *   routine | context_refresh
 * plus any other snake_case job type the orchestrator uses for non-human-visible
 * container runs. The CLI forwards any well-formed value; the interceptor's
 * skip list is authoritative.
 */

export const SCENARIO_HEADER = "x-gobi-scenario";
export const SCENARIO_ENV = "GOBI_SCENARIO";

/** Job types whose CLI traffic must not count toward `agent_cli_active`. */
export const BACKGROUND_SCENARIOS = ["routine", "context_refresh"] as const;

/** Explicit human-visible scenarios. Counted the same as an omitted header. */
export const COUNTED_SCENARIOS = ["cli", "chat", "mention"] as const;

export type BackgroundScenario = (typeof BACKGROUND_SCENARIOS)[number];
export type CountedScenario = (typeof COUNTED_SCENARIOS)[number];

const BACKGROUND_SET = new Set<string>(BACKGROUND_SCENARIOS);
const COUNTED_SET = new Set<string>(COUNTED_SCENARIOS);

// Leading letter, then letters / digits / underscores. Hyphens normalize to
// underscores before this check (`context-refresh` → `context_refresh`).
const SCENARIO_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export function isBackgroundScenario(value: string): value is BackgroundScenario {
  return BACKGROUND_SET.has(value);
}

export function isCountedScenario(value: string): value is CountedScenario {
  return COUNTED_SET.has(value);
}

/**
 * Normalize a scenario token: trim, lowercase, hyphens → underscores.
 * Returns null for empty or malformed values so a stray env var cannot
 * break a human CLI session or send garbage to the interceptor.
 */
export function normalizeScenario(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const value = raw.trim().toLowerCase().replace(/-/g, "_");
  if (!value || !SCENARIO_PATTERN.test(value)) return null;
  return value;
}

/** Scenario to send on this process, or null when the header should be omitted. */
export function resolveScenario(env: NodeJS.ProcessEnv = process.env): string | null {
  return normalizeScenario(env[SCENARIO_ENV]);
}
