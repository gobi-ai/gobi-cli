import { BASE_URL } from "./constants.js";
import { ApiError } from "./errors.js";
import { getValidToken } from "./auth/manager.js";

/** This machine's IANA timezone, or null when the runtime can't report one. */
function resolveTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

async function request(
  method: string,
  path: string,
  options?: { params?: Record<string, unknown>; body?: unknown },
): Promise<unknown> {
  const token = await getValidToken();

  let url = `${BASE_URL}${path}`;

  // Filter out null/undefined values from params
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

  const res = await fetch(url, { method, headers, body });

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
