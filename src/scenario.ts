/**
 * CLI ↔ backend contract for Mixpanel `agent_cli_active` (DAA/WAA).
 *
 * gobi-backend's `cli-active.interceptor` fires that event on authenticated
 * requests that carry `x-app: cli`. Only this CLI sends that header. In-app
 * agents also run the CLI inside containers, so background jobs would inflate
 * DAA unless they identify themselves with the same flow token webdrive already
 * puts on the LLM proxy (`AgentScenario.flow` → `x-gobi-scenario`).
 *
 * Header: `x-gobi-scenario`
 * Source (first match):
 *   1. `GOBI_SCENARIO` — preferred; webdrive `server.py` should set this next
 *      to `ANTHROPIC_CUSTOM_HEADERS`
 *   2. the `x-gobi-scenario:` line on `ANTHROPIC_CUSTOM_HEADERS` — today's
 *      webdrive value, until (1) lands
 *
 * Counted (event fires):
 *   header omitted (terminal gobi) | space | personal | visitor | free
 *
 * Background (backend skips Redis NX + Mixpanel):
 *   observe
 *   {scope}-{run_kind} for run_kinds:
 *     routine | context-refresh | digest | dreamer | checkin | recap | note
 *   examples: space-routine, space-context-refresh, personal-recap
 *
 * The CLI forwards any well-formed flow; the interceptor's skip list is
 * authoritative. See docs/cli-scenario.md.
 */

export const SCENARIO_HEADER = "x-gobi-scenario";
export const SCENARIO_ENV = "GOBI_SCENARIO";
export const ANTHROPIC_CUSTOM_HEADERS_ENV = "ANTHROPIC_CUSTOM_HEADERS";

/** Bare flow that backend skips (no Redis NX, no agent_cli_active). */
export const BACKGROUND_FLOWS = ["observe"] as const;

/** `{scope}-{run_kind}` suffix. Hyphens, matching webdrive AgentScenario.flow. */
export const BACKGROUND_RUN_KINDS = [
  "routine",
  "context-refresh",
  "digest",
  "dreamer",
  "checkin",
  "recap",
  "note",
] as const;

/** Human-visible flows. Counted the same as an omitted header. */
export const COUNTED_SCENARIOS = ["space", "personal", "visitor", "free"] as const;

export type BackgroundRunKind = (typeof BACKGROUND_RUN_KINDS)[number];
export type CountedScenario = (typeof COUNTED_SCENARIOS)[number];

const BACKGROUND_KIND_SET = new Set<string>(BACKGROUND_RUN_KINDS);
const COUNTED_SET = new Set<string>(COUNTED_SCENARIOS);

// Leading letter, then letters / digits / hyphens — keeps webdrive flows like
// `space-context-refresh` intact. Underscores normalize to hyphens first.
const SCENARIO_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

const HEADER_LINE = /^x-gobi-scenario\s*:\s*(.+)$/i;

export function isBackgroundScenario(value: string): boolean {
  if (value === "observe") return true;
  const dash = value.indexOf("-");
  if (dash <= 0) return false;
  return BACKGROUND_KIND_SET.has(value.slice(dash + 1));
}

export function isCountedScenario(value: string): value is CountedScenario {
  return COUNTED_SET.has(value);
}

/**
 * Normalize a flow token: trim, lowercase, underscores → hyphens.
 * Returns null for empty or malformed values so a stray env var cannot
 * break a human CLI session or send garbage to the interceptor.
 */
export function normalizeScenario(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const value = raw.trim().toLowerCase().replace(/_/g, "-");
  if (!value || !SCENARIO_PATTERN.test(value)) return null;
  return value;
}

/**
 * Read `x-gobi-scenario` out of `ANTHROPIC_CUSTOM_HEADERS`.
 * Webdrive already sets that env for the LLM proxy; until it also exports
 * `GOBI_SCENARIO`, this is how container CLI calls learn the flow.
 */
export function parseScenarioFromAnthropicHeaders(
  raw: string | undefined | null,
): string | null {
  if (raw == null) return null;
  const text = raw.trim();
  if (!text) return null;

  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      for (const [key, val] of Object.entries(obj)) {
        if (key.toLowerCase() === SCENARIO_HEADER && typeof val === "string") {
          return normalizeScenario(val);
        }
      }
    } catch {
      // Not JSON — fall through to line parse.
    }
  }

  for (const line of text.split(/\r?\n|\\n/)) {
    const match = line.trim().match(HEADER_LINE);
    if (match) return normalizeScenario(match[1]);
  }
  return null;
}

/**
 * Scenario to send on this process, or null when the header should be omitted.
 * `GOBI_SCENARIO` wins; otherwise parse `ANTHROPIC_CUSTOM_HEADERS`.
 */
export function resolveScenario(env: NodeJS.ProcessEnv = process.env): string | null {
  return (
    normalizeScenario(env[SCENARIO_ENV]) ??
    parseScenarioFromAnthropicHeaders(env[ANTHROPIC_CUSTOM_HEADERS_ENV])
  );
}
