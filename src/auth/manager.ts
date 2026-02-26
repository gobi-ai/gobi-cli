import { BASE_URL, TOKEN_REFRESH_BUFFER_MS } from "../constants.js";
import { NotAuthenticatedError, TokenRefreshError } from "../errors.js";
import {
  type Credentials,
  loadCredentials,
  saveCredentials,
  clearCredentials,
} from "./credentials.js";

let cachedCredentials: Credentials | null = null;

export async function initCredentials(): Promise<void> {
  cachedCredentials = await loadCredentials();
}

export function isAuthenticated(): boolean {
  return cachedCredentials !== null;
}

export function getCurrentUser(): Credentials["user"] | null {
  if (cachedCredentials === null) return null;
  return cachedCredentials.user;
}

function isExpiringSoon(creds: Credentials): boolean {
  return Date.now() >= creds.expiresAt - TOKEN_REFRESH_BUFFER_MS;
}

async function performRefresh(creds: Credentials): Promise<Credentials> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: creds.refreshToken }),
  });

  if (!res.ok) {
    const body = (await res.text()) || "(no body)";
    throw new TokenRefreshError(`HTTP ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  const updated: Credentials = {
    ...creds,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + data.expiresIn * 1000,
  };

  await saveCredentials(updated);
  return updated;
}

export async function getValidToken(): Promise<string> {
  if (cachedCredentials === null) {
    throw new NotAuthenticatedError();
  }

  if (isExpiringSoon(cachedCredentials)) {
    cachedCredentials = await performRefresh(cachedCredentials);
  }

  return cachedCredentials.accessToken;
}

export async function storeTokens(creds: Credentials): Promise<void> {
  await saveCredentials(creds);
  cachedCredentials = creds;
}

export async function logout(): Promise<void> {
  await clearCredentials();
  cachedCredentials = null;
}
