/**
 * Minimal Gobi HTTP client for the MCP server.
 *
 * Adapted from gobi-cli (`src/client.ts`, `src/http.ts`, `src/errors.ts`,
 * `src/constants.ts`) at https://github.com/gobi-ai/gobi-cli
 * Copyright (c) 2025-2026 Gobi AI, MIT License.
 *
 * Differences from the CLI client: injectable bearer tokens (stdio env /
 * credentials, or an HTTP Authorization header), and `x-app: mcp`.
 */

export const DEFAULT_BASE_URL = "https://api.joingobi.com";
export const REQUEST_TIMEOUT_MS = 30 * 1000;
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

const RETRYABLE_STATUS = new Set([502, 503, 504]);

export class GobiError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = "GobiError";
  }
}

export class NotAuthenticatedError extends GobiError {
  constructor(detail?: string) {
    super(
      detail ??
        "Not authenticated. Set GOBI_API_KEY, run `gobi auth login`, or pass an Authorization: Bearer gbi_… token.",
      "NOT_AUTHENTICATED",
    );
    this.name = "NotAuthenticatedError";
  }
}

export class TokenRefreshError extends GobiError {
  constructor(detail: string) {
    super(
      `Failed to refresh access token: ${detail}. Re-run \`gobi auth login\` or set a fresh GOBI_API_KEY.`,
      "TOKEN_REFRESH_FAILED",
    );
    this.name = "TokenRefreshError";
  }
}

export class ApiError extends GobiError {
  status: number;
  endpoint: string;

  constructor(status: number, endpoint: string, body: string) {
    let message = body;
    try {
      const parsed = JSON.parse(body) as { message?: unknown };
      if (typeof parsed.message === "string") message = parsed.message;
    } catch {
      // keep raw body
    }
    super(message, "API_ERROR");
    this.status = status;
    this.endpoint = endpoint;
    this.name = "ApiError";
  }
}

export function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  return fetchImpl(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
}

export function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}

function resolveTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function networkError(err: unknown, path: string): GobiError {
  if (isTimeoutError(err)) {
    return new GobiError(
      `Request to ${path} timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Check your connection and retry.`,
      "REQUEST_TIMEOUT",
    );
  }
  const detail =
    err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err);
  return new GobiError(
    `Network error calling ${path}: ${detail}. Check your connection and retry.`,
    "NETWORK_ERROR",
  );
}

export interface TokenProvider {
  getToken(): Promise<string>;
}

export interface GobiApi {
  get(path: string, params?: Record<string, unknown>): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
}

export interface GobiApiOptions {
  getToken: () => Promise<string>;
  fetch?: typeof fetch;
  baseUrl?: string;
}

export function gobiBaseUrl(): string {
  return process.env.GOBI_BASE_URL || DEFAULT_BASE_URL;
}

async function sendWithRetry(
  fetchImpl: typeof fetch,
  method: string,
  path: string,
  url: string,
  headers: Record<string, string>,
  body: string | undefined,
): Promise<Response> {
  const attempt = () => fetchWithTimeout(url, { method, headers, body }, REQUEST_TIMEOUT_MS, fetchImpl);
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

export function createGobiApi(opts: GobiApiOptions): GobiApi {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const baseUrl = opts.baseUrl ?? gobiBaseUrl();

  async function request(
    method: string,
    path: string,
    options?: { params?: Record<string, unknown>; body?: unknown },
  ): Promise<unknown> {
    const token = await opts.getToken();
    if (!token) throw new NotAuthenticatedError();

    let url = `${baseUrl}${path}`;
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
      "x-app": "mcp",
    };
    const timezone = resolveTimezone();
    if (timezone) headers["x-timezone"] = timezone;

    const body = options?.body != null ? JSON.stringify(options.body) : undefined;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await sendWithRetry(fetchImpl, method, path, url, headers, body);
    if (!res.ok) {
      const text = (await res.text()) || "(no body)";
      throw new ApiError(res.status, path, text);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  return {
    get(path, params) {
      return request("GET", path, { params });
    },
    post(path, body) {
      return request("POST", path, { body });
    },
  };
}
