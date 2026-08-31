import { BASE_URL, REQUEST_TIMEOUT_MS } from "./constants.js";
import { ApiError, GobiError } from "./errors.js";
import { fetchWithTimeout, isTimeoutError } from "./http.js";
import { getValidToken } from "./auth/manager.js";

/** This machine's IANA timezone, or null when the runtime can't report one. */
function resolveTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

// Gateway hiccups worth one more try. Anything else 4xx/5xx is the server's
// real answer and is surfaced as an ApiError.
const RETRYABLE_STATUS = new Set([502, 503, 504]);

/** Wrap a transport-level fetch failure in an actionable GobiError. */
function networkError(err: unknown, path: string): GobiError {
  if (isTimeoutError(err)) {
    return new GobiError(
      `Request to ${path} timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Check your connection and retry.`,
      "REQUEST_TIMEOUT",
    );
  }
  const detail = err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err);
  return new GobiError(
    `Network error calling ${path}: ${detail}. Check your connection and retry.`,
    "NETWORK_ERROR",
  );
}

/**
 * The CLI's ONE retry layer, at the API boundary: idempotent GETs get a single
 * second attempt on a transport failure or a gateway 502/503/504. Writes are
 * never retried here — a POST that died mid-flight may have landed, and
 * replaying it could double a post or a reply.
 */
async function sendWithRetry(
  method: string,
  path: string,
  url: string,
  headers: Record<string, string>,
  body: string | undefined,
): Promise<Response> {
  const attempt = () => fetchWithTimeout(url, { method, headers, body });
  let res: Response;
  try {
    res = await attempt();
  } catch (err) {
    if (method !== "GET") throw networkError(err, path);
    try {
      return await attempt();
    } catch (err2) {
      throw networkError(err2, path);
    }
  }
  if (method === "GET" && RETRYABLE_STATUS.has(res.status)) {
    try {
      return await attempt();
    } catch (err) {
      throw networkError(err, path);
    }
  }
  return res;
}

async function request(
  method: string,
  path: string,
  options?: { params?: Record<string, unknown>; body?: unknown },
): Promise<unknown> {
  const token = await getValidToken();

  let url = `${BASE_URL}${path}`;

  if (options?.params) {
    const filtered = Object.entries(options.params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)]);
    if (filtered.length > 0) {
      url += "?" + new URLSearchParams(filtered).toString();
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  // The writer's IANA timezone. The backend reads it wherever it dispatches an
  // agent run, so a post or reply made from the CLI gives the agent a real
  // clock in this machine's zone rather than a bare UTC date — without it,
  // relative windows ("last 6 hours", "today") have no origin to compute from.
  const timezone = resolveTimezone();
  if (timezone) {
    headers["x-timezone"] = timezone;
  }
  const body = options?.body != null ? JSON.stringify(options.body) : undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await sendWithRetry(method, path, url, headers, body);

  if (!res.ok) {
    const text = (await res.text()) || "(no body)";
    throw new ApiError(res.status, path, text);
  }

  if (res.status === 204) return null;
  return res.json();
}

export function apiGet(
  path: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  return request("GET", path, { params });
}

export function apiPost(path: string, body?: unknown): Promise<unknown> {
  return request("POST", path, { body });
}

export function apiPatch(path: string, body?: unknown): Promise<unknown> {
  return request("PATCH", path, { body });
}

export function apiPut(path: string, body?: unknown): Promise<unknown> {
  return request("PUT", path, { body });
}

export function apiDelete(path: string): Promise<unknown> {
  return request("DELETE", path);
}
