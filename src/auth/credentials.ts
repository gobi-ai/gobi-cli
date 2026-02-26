import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CREDENTIALS_DIR = join(homedir(), ".gobi");
const CREDENTIALS_PATH = join(CREDENTIALS_DIR, "credentials.json");

export interface Credentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    id: number;
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
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), {
    mode: 0o600,
  });
}

export async function clearCredentials(): Promise<void> {
  try {
    unlinkSync(CREDENTIALS_PATH);
  } catch {
    // ignore if file doesn't exist
  }
}
