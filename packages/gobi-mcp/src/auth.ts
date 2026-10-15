/**
 * Stdio auth: `GOBI_API_KEY` (a bearer or `gbi_` connect token) or the CLI's
 * `~/.gobi/credentials.json`. Streamable HTTP auth is bearer-only — see http.ts.
 *
 * Credential load/refresh is adapted from gobi-cli (`src/auth/credentials.ts`,
 * `src/auth/manager.ts`) at https://github.com/gobi-ai/gobi-cli
 * Copyright (c) 2025-2026 Gobi AI, MIT License.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import {
  type TokenProvider,
  NotAuthenticatedError,
  TokenRefreshError,
  gobiBaseUrl,
  fetchWithTimeout,
  TOKEN_REFRESH_BUFFER_MS,
} from "./gobi-client.js";

export type { TokenProvider };

export interface AgentIdentity {
  botId: string;
  kind: "space_agent" | "personal_agent";
  spaceSlug?: string | null;
  spaceName?: string | null;
  ownerPublicId?: string | null;
  ownerName?: string | null;
}

export interface Credentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    publicId?: string;
    email: string;
    name: string;
    pictureUrl: string | null;
    agent?: AgentIdentity;
  };
}

export function credentialsPath(home: string = homedir()): string {
  return join(home, ".gobi", "credentials.json");
}

export function loadCredentials(home: string = homedir()): Credentials | null {
  try {
    const raw = readFileSync(credentialsPath(home), "utf-8");
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export function isGbiToken(token: string): boolean {
  return token.trim().startsWith("gbi_");
}

/**
 * Exchange a one-time CLI connect token (`gbi_…`) for an access token.
 * Same `/auth/connect-token/exchange` the CLI uses for `gobi auth login --token`.
 * Does not write `~/.gobi/credentials.json`.
 */
export async function exchangeConnectToken(
  token: string,
  opts?: { fetch?: typeof fetch; baseUrl?: string },
): Promise<{ accessToken: string; user?: Credentials["user"] }> {
  const fetchImpl = opts?.fetch ?? globalThis.fetch;
  const baseUrl = opts?.baseUrl ?? gobiBaseUrl();
  const res = await fetchWithTimeout(
    `${baseUrl}/auth/connect-token/exchange`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim() }),
    },
    undefined,
    fetchImpl,
  );
  if (res.status === 401) {
    throw new NotAuthenticatedError(
      "This connect token is invalid, expired, or already used. Tokens are single-use — copy a fresh GOBI_API_KEY / gbi_ token and try again.",
    );
  }
  if (!res.ok) {
    const body = (await res.text()) || "(no body)";
    throw new NotAuthenticatedError(`Token login failed: HTTP ${res.status}: ${body}`);
  }
  const data = (await res.json()) as {
    accessToken: string;
    user?: Credentials["user"];
  };
  if (!data.accessToken) {
    throw new NotAuthenticatedError("Token login returned no accessToken.");
  }
  return { accessToken: data.accessToken, user: data.user };
}

export function staticBearer(token: string): TokenProvider {
  const t = token.trim();
  return {
    async getToken() {
      if (!t) throw new NotAuthenticatedError();
      return t;
    },
  };
}

export function credentialsProvider(
  initial: Credentials,
  opts?: { fetch?: typeof fetch; baseUrl?: string },
): TokenProvider {
  let creds = initial;
  return {
    async getToken() {
      if (Date.now() < creds.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
        return creds.accessToken;
      }
      const fetchImpl = opts?.fetch ?? globalThis.fetch;
      const baseUrl = opts?.baseUrl ?? gobiBaseUrl();
      const res = await fetchWithTimeout(
        `${baseUrl}/auth/refresh`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: creds.refreshToken }),
        },
        undefined,
        fetchImpl,
      );
      if (!res.ok) {
        const body = (await res.text()) || "(no body)";
        throw new TokenRefreshError(`HTTP ${res.status}: ${body}`);
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      };
      creds = {
        ...creds,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: Date.now() + data.expiresIn * 1000,
      };
      return creds.accessToken;
    },
  };
}

export interface ResolvedStdioAuth {
  provider: TokenProvider;
  source: "env" | "credentials" | "env-connect-token";
}

/**
 * Resolve stdio credentials.
 * 1. `GOBI_API_KEY` — used as a bearer; `gbi_…` is exchanged once at startup.
 * 2. Else `~/.gobi/credentials.json` from `gobi auth login`.
 */
export async function resolveStdioAuth(opts?: {
  env?: NodeJS.ProcessEnv;
  home?: string;
  fetch?: typeof fetch;
  baseUrl?: string;
}): Promise<ResolvedStdioAuth> {
  const env = opts?.env ?? process.env;
  const key = env.GOBI_API_KEY?.trim();
  if (key) {
    if (isGbiToken(key)) {
      try {
        const exchanged = await exchangeConnectToken(key, opts);
        return { provider: staticBearer(exchanged.accessToken), source: "env-connect-token" };
      } catch (err) {
        // A long-lived gbi_ API key may not be a connect token. Try it as bearer.
        if (err instanceof NotAuthenticatedError) {
          return { provider: staticBearer(key), source: "env" };
        }
        throw err;
      }
    }
    return { provider: staticBearer(key), source: "env" };
  }

  const creds = loadCredentials(opts?.home);
  if (creds?.accessToken) {
    return { provider: credentialsProvider(creds, opts), source: "credentials" };
  }

  throw new NotAuthenticatedError();
}
