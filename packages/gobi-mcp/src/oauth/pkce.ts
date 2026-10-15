import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function s256Challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function verifyS256(verifier: string, challenge: string): boolean {
  const actual = s256Challenge(verifier);
  const a = Buffer.from(actual);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function randomToken(prefix: string, bytes = 24): string {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`;
}
