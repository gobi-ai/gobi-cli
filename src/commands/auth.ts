import { Command } from "commander";
import { BASE_URL, POLL_MAX_DURATION_MS } from "../constants.js";
import { DeviceCodeError } from "../errors.js";
import {
  storeTokens,
  logout,
  isAuthenticated,
  getCurrentUser,
} from "../auth/manager.js";
import type { Credentials } from "../auth/credentials.js";
import { printContext } from "./init.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runLoginFlow(): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/device`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const body = (await res.text()) || "(no body)";
    throw new DeviceCodeError(
      `Failed to initiate login: HTTP ${res.status}: ${body}`,
    );
  }

  const deviceData = (await res.json()) as Record<string, unknown>;
  const intervalS = (deviceData.interval as number) || 5;
  const startMs = Date.now();

  console.log(
    `Open this URL in your browser to log in:\n  ${deviceData.verificationUri}`,
  );
  console.log(`Your user code: ${deviceData.userCode}`);
  console.log("Waiting for authentication...");

  while (Date.now() - startMs < POLL_MAX_DURATION_MS) {
    await sleep(intervalS * 1000);

    const tokenRes = await fetch(`${BASE_URL}/auth/device/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceCode: deviceData.deviceCode }),
    });

    if (!tokenRes.ok) {
      const body = (await tokenRes.text()) || "(no body)";
      throw new DeviceCodeError(
        `Token poll failed: HTTP ${tokenRes.status}: ${body}`,
      );
    }

    const tokenData = (await tokenRes.json()) as Record<string, unknown>;

    if ("accessToken" in tokenData) {
      const user = tokenData.user as Record<string, unknown>;
      const creds: Credentials = {
        accessToken: tokenData.accessToken as string,
        refreshToken: tokenData.refreshToken as string,
        expiresAt:
          Date.now() + (tokenData.expiresIn as number) * 1000,
        user: {
          id: user.id as number,
          email: user.email as string,
          name: user.name as string,
          pictureUrl: (user.pictureUrl as string) || null,
        },
      };
      await storeTokens(creds);
      console.log(
        `Successfully logged in as ${user.name} (${user.email}).`,
      );
      return;
    }

    if (tokenData.status === "expired") {
      throw new DeviceCodeError(
        "Login session expired. Please try 'gobi auth login' again.",
      );
    }
  }

  throw new DeviceCodeError(
    "Login timed out. Please try 'gobi auth login' again.",
  );
}

export function registerAuthCommand(program: Command): void {
  const auth = program
    .command("auth")
    .description("Authentication commands.");

  auth
    .command("login")
    .description(
      "Log in to Gobi. Opens a browser URL for Google OAuth, then polls until authentication is complete.",
    )
    .action(async () => {
      await runLoginFlow();
    });

  auth
    .command("status")
    .description(
      "Check whether you are currently authenticated with Gobi.",
    )
    .action(() => {
      if (isAuthenticated()) {
        const user = getCurrentUser();
        const name = user?.name || "Unknown";
        const email = user?.email || "Unknown";
        console.log(`Authenticated as ${name} (${email})`);
        printContext();
      } else {
        console.log(
          "You are not authenticated. Use 'gobi auth login' to log in.",
        );
      }
    });

  auth
    .command("logout")
    .description("Log out of Gobi and remove stored credentials.")
    .action(async () => {
      await logout();
      console.log("Logged out. Credentials removed.");
    });
}
