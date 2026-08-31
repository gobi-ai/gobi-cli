import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CREDENTIALS_DIR = join(homedir(), ".gobi");
const CREDENTIALS_PATH = join(CREDENTIALS_DIR, "credentials.json");

export interface Credentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    /** The account's u… public id. Optional: stored credentials may omit it. */
    publicId?: string;
    email: string;
    name: string;
    pictureUrl: string | null;
  };
}

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const raw = readFileSync(CREDENTIALS_PATH, "utf-8");
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  // Owner-only and atomic: write a 0600 temp file, then rename it over the
  // real one. writeFileSync applies `mode` only when it CREATES the file, so
  // rewriting in place would keep whatever looser mode an old file carried —
  // and a crash mid-write would leave truncated JSON that silently logs the
  // user out. The rename gives both properties in one step.
  const tmpPath = `${CREDENTIALS_PATH}.tmp-${process.pid}`;
  writeFileSync(tmpPath, JSON.stringify(creds, null, 2), { mode: 0o600 });
  renameSync(tmpPath, CREDENTIALS_PATH);
}

export async function clearCredentials(): Promise<void> {
  try {
    unlinkSync(CREDENTIALS_PATH);
  } catch {
  }
}
