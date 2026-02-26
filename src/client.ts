import { BASE_URL } from "./constants.js";
import { ApiError } from "./errors.js";
import { getValidToken } from "./auth/manager.js";

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

export function apiDelete(path: string): Promise<unknown> {
  return request("DELETE", path);
}
