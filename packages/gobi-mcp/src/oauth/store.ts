import type { AuthorizationCode, IssuedToken, RegisteredClient } from "./types.js";

/** In-process OAuth store. Production needs Redis/Postgres (see docs/BACKEND_ENDPOINTS.md). */
export class MemoryOAuthStore {
  clients = new Map<string, RegisteredClient>();
  codes = new Map<string, AuthorizationCode>();
  tokens = new Map<string, IssuedToken>();
  refresh = new Map<string, IssuedToken>();

  putClient(c: RegisteredClient): void {
    this.clients.set(c.client_id, c);
  }
  getClient(id: string): RegisteredClient | undefined {
    return this.clients.get(id);
  }
  putCode(c: AuthorizationCode): void {
    this.codes.set(c.code, c);
  }
  takeCode(code: string): AuthorizationCode | undefined {
    const c = this.codes.get(code);
    this.codes.delete(code);
    return c;
  }
  putToken(t: IssuedToken): void {
    this.tokens.set(t.accessToken, t);
    this.refresh.set(t.refreshToken, t);
  }
  getAccess(token: string): IssuedToken | undefined {
    const t = this.tokens.get(token);
    if (!t) return undefined;
    if (t.expiresAt < Date.now()) {
      this.tokens.delete(token);
      return undefined;
    }
    return t;
  }
  takeRefresh(token: string): IssuedToken | undefined {
    const t = this.refresh.get(token);
    this.refresh.delete(token);
    if (t) this.tokens.delete(t.accessToken);
    return t;
  }
}
