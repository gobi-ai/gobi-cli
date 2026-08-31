import { REQUEST_TIMEOUT_MS } from "./constants.js";

/**
 * `fetch` with a hard deadline. Every HTTP call the CLI makes goes through
 * here (directly, or via the client.ts request wrapper) so a hung connection
 * aborts with a clear error instead of blocking the command forever.
 *
 * `timeoutMs` covers the WHOLE exchange, response body included — pass
 * TRANSFER_TIMEOUT_MS for file uploads/downloads, which legitimately take
 * minutes. An explicit `init.signal` wins over the deadline.
 */
export function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
}

/** True when `err` is the TimeoutError minted by AbortSignal.timeout. */
export function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}
