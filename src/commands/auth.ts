import { Command } from "commander";
import { BASE_URL, POLL_MAX_DURATION_MS } from "../constants.js";
import { DeviceCodeError, GobiError } from "../errors.js";
import {
  storeTokens,
  logout,
  isAuthenticated,
  getCurrentUser,
} from "../auth/manager.js";
import type { Credentials } from "../auth/credentials.js";
import { readSettings } from "./init.js";
import { isJsonMode, jsonOut } from "./utils.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The agent-facing onboarding brief printed after a token login. The reader is
// the coding agent that ran this command, not the human: it tells the agent to
// learn Gobi itself, then report back asking only the questions it needs
// answered, and to close with the exact ready line the app promises.
function onboardingBrief(name: string, email: string): string {
  return `Connected to Gobi as ${name} (${email}).

You are the agent that just connected. Finish onboarding yourself before
reporting back to the user:

1. Learn Gobi from the runbook: read AGENTS.md in this repo, or fetch
   https://raw.githubusercontent.com/gobi-ai/gobi-cli/main/AGENTS.md
2. Look around this user's Gobi with read-only commands:
     gobi --json auth status
     gobi --json space list
     gobi --json personal feed
3. (Claude Code only) Install the Gobi skills so future sessions know these
   commands without re-reading the runbook:
     claude plugin marketplace add gobi-ai/gobi-cli
     claude plugin install gobi@gobi

Then report back to the user:
- You are the one who just learned Gobi — do not lecture the user about what
  Gobi is, and do not quiz them on it.
- Briefly say what you found in THEIR Gobi (their spaces, recent activity).
- Ask only the questions YOU need answered to work in their Gobi (for
  example, which space to use by default). If you have none, ask nothing.
- End with exactly: I'm connected with Gobi and I'm ready.`;
}

/**
 * Log in with a one-time connect token from the Gobi app or web ("Connect
 * with Gobi … Token: gbi_…"). No browser approval step — the token was minted
 * by an already-authenticated user. Prints the agent onboarding brief.
 */
export async function runTokenLoginFlow(
  token: string,
  json: boolean,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/connect-token/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: token.trim() }),
  });

  if (res.status === 401) {
    throw new GobiError(
      "This connect token is invalid, expired, or already used. " +
        "Tokens are single-use — ask the user to copy a fresh " +
        "'Connect with Gobi' prompt from the Gobi app and try again.",
      "CONNECT_TOKEN_REJECTED",
    );
  }
  if (!res.ok) {
    const body = (await res.text()) || "(no body)";
    throw new GobiError(
      `Token login failed: HTTP ${res.status}: ${body}`,
      "CONNECT_FAILED",
    );
  }

  const data = (await res.json()) as Record<string, unknown>;
  const user = data.user as Record<string, unknown>;
  const creds: Credentials = {
    accessToken: data.accessToken as string,
    refreshToken: data.refreshToken as string,
    expiresAt: Date.now() + (data.expiresIn as number) * 1000,
    user: {
      publicId: user.publicId as string,
      email: user.email as string,
      name: user.name as string,
      pictureUrl: (user.pictureUrl as string) || null,
    },
  };
  await storeTokens(creds);

  const name = (user.name as string) || "Unknown";
  const email = (user.email as string) || "Unknown";

  if (json) {
    jsonOut({
      authenticated: true,
      user: { name, email },
      brief: onboardingBrief(name, email),
    });
    return;
  }
  console.log(onboardingBrief(name, email));
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
  console.log(
    "If the browser asks you to sign in to Gobi first, that is expected. Keep waiting — do not run 'gobi auth login' again.",
  );
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
          publicId: user.publicId as string,
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
      "Log in to Gobi. Opens a browser URL for Google OAuth and polls until " +
        "authentication is complete — or pass --token with a one-time connect " +
        "token from the Gobi app to skip the browser step.",
    )
    .option(
      "--token <token>",
      "Connect token from the Gobi app (looks like gbi_…). Single-use.",
    )
    .action(async (opts: { token?: string }, cmd: Command) => {
      if (opts.token) {
        await runTokenLoginFlow(opts.token, isJsonMode(cmd));
        return;
      }
      await runLoginFlow();
    });

  auth
    .command("status")
    .description(
      "Check whether you are currently authenticated with Gobi.",
    )
    .action(() => {
      const settings = readSettings();
      const vaultSlug = (settings?.vaultSlug as string | undefined) ?? null;
      const spaceSlug =
        (settings?.selectedSpaceSlug as string | undefined) ?? null;

      if (!isAuthenticated()) {
        if (isJsonMode(auth)) {
          jsonOut({
            authenticated: false,
            user: null,
            // Vault is an advanced feature — status carries it only once one
            // is actually configured, so a fresh setup never has it in view.
            ...(vaultSlug ? { vaultSlug } : {}),
            spaceSlug,
          });
          return;
        }
        console.log(
          "You are not authenticated. Use 'gobi auth login' to log in.",
        );
        return;
      }

      const user = getCurrentUser();

      if (isJsonMode(auth)) {
        jsonOut({
          authenticated: true,
          user: {
            name: user?.name ?? null,
            email: user?.email ?? null,
          },
          ...(vaultSlug ? { vaultSlug } : {}),
          spaceSlug,
        });
        return;
      }

      const name = user?.name || "Unknown";
      const email = user?.email || "Unknown";
      console.log(`Authenticated as ${name} (${email})`);
      if (vaultSlug) console.log(`  Vault: ${vaultSlug}`);
      console.log(`  Space: ${spaceSlug ?? "(not set)"}`);
    });

  auth
    .command("logout")
    .description("Log out of Gobi and remove stored credentials.")
    .action(async () => {
      await logout();
      if (isJsonMode(auth)) {
        jsonOut({ loggedOut: true });
        return;
      }
      console.log("Logged out. Credentials removed.");
    });
}
