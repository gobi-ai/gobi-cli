import { Command } from "commander";
import { BASE_URL, POLL_MAX_DURATION_MS } from "../constants.js";
import { fetchWithTimeout } from "../http.js";
import { DeviceCodeError, GobiError } from "../errors.js";
import {
  storeTokens,
  logout,
  isAuthenticated,
  getCurrentUser,
} from "../auth/manager.js";
import type { AgentIdentity, Credentials } from "../auth/credentials.js";
import { readSettings } from "./init.js";
import { isJsonMode, jsonOut } from "./utils.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The brief printed after a token login for a SPACE BOT's session: the
// external agent now IS that bot, so it learns the space it serves rather than
// a person's Gobi. Nobody is watching a headless run, so unlike the human
// brief this one asks no questions and reports back to no one — it says what
// to read and what to keep watching.
function agentOnboardingBrief(name: string, agent: AgentIdentity): string {
  const where = agent.spaceName ?? agent.spaceSlug ?? "?";
  const named = agent.spaceSlug ? `"${where}" (${agent.spaceSlug})` : `"${where}"`;
  const scope = agent.spaceSlug ? ` --space ${agent.spaceSlug}` : "";
  const feed = agent.spaceSlug
    ? `     gobi --json space feed --space-slug ${agent.spaceSlug}`
    : `     gobi --json space list`;
  return `Connected to Gobi as ${name} — the agent of the space ${named}.

You ARE this bot now: every post, reply, and reaction you make appears as
${name}. This session is headless — there is no user on the other end of it,
so do not report back and do not ask questions. Work from what you read:

1. Learn Gobi from the runbook: read AGENTS.md in this repo, or fetch
   https://raw.githubusercontent.com/gobi-ai/gobi-cli/main/AGENTS.md
2. See where you serve, and what has been sent to you:
${feed}
     gobi --json notifications list${scope}
   (a mention of you in the space reaches you through the feed; a DM sent to
   you lands in notifications)
3. Answer as the bot with gobi space create-reply / gobi space send-dm, then
   keep watching — this command for new DMs, and the feed, re-read, for new
   posts:
     gobi notifications listen${scope}`;
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
 * by an already-authenticated user, so the whole flow is headless. The session
 * is that person's, or a space bot's when an admin minted the token for one of
 * their space's bots. Prints the matching onboarding brief.
 */
export async function runTokenLoginFlow(
  token: string,
  json: boolean,
): Promise<void> {
  const res = await fetchWithTimeout(`${BASE_URL}/auth/connect-token/exchange`, {
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
  // Present when the token was minted for a space bot; absent (older backend,
  // or a person's own token) means a human session.
  const agent = (data.agent as AgentIdentity | null | undefined) ?? undefined;
  const creds: Credentials = {
    accessToken: data.accessToken as string,
    refreshToken: data.refreshToken as string,
    expiresAt: Date.now() + (data.expiresIn as number) * 1000,
    user: {
      publicId: user.publicId as string,
      email: user.email as string,
      name: user.name as string,
      pictureUrl: (user.pictureUrl as string) || null,
      ...(agent ? { agent } : {}),
    },
  };
  await storeTokens(creds);

  const name = (user.name as string) || "Unknown";
  const email = (user.email as string) || "Unknown";
  const brief = agent
    ? agentOnboardingBrief(name, agent)
    : onboardingBrief(name, email);

  if (json) {
    jsonOut({
      authenticated: true,
      user: { name, email, ...(agent ? { agent } : {}) },
      brief,
    });
    return;
  }
  console.log(brief);
}

export async function runLoginFlow(): Promise<void> {
  const res = await fetchWithTimeout(`${BASE_URL}/auth/device`, {
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

    const tokenRes = await fetchWithTimeout(`${BASE_URL}/auth/device/token`, {
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
            ...(user?.agent ? { agent: user.agent } : {}),
          },
          ...(vaultSlug ? { vaultSlug } : {}),
          spaceSlug,
        });
        return;
      }

      const name = user?.name || "Unknown";
      const email = user?.email || "Unknown";
      console.log(`Authenticated as ${name} (${email})`);
      if (user?.agent) {
        const a = user.agent;
        console.log(`  Acting as: bot "${a.botId}" of space ${a.spaceSlug ?? "?"}`);
      }
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
