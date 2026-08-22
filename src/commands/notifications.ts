import { Command } from "commander";
import * as Ably from "ably";
import { apiGet, apiPatch, apiPost } from "../client.js";
import { getCurrentUser } from "../auth/manager.js";
import { isJsonMode, jsonOut } from "./utils.js";

/**
 * `gobi notifications` — the activity inbox, on two axes.
 *
 *   SCOPE (where):  global (default) | --space <slug> | --space <slug> --channel <id>
 *   FILTER (what):  --type all|post|dm|capture  ·  --unread  ·  --mentions
 *
 * Structured as a pure command group with three subcommands so each owns its
 * own flags without colliding (a parent that BOTH carried options AND had
 * subcommands made commander bind `listen --space X` onto the parent instead):
 *
 *   list    (default)  the inbox, paginated. `gobi notifications` runs this.
 *   listen             the same inbox, streamed live over Ably (headless).
 *   read               mark one, or a whole scope, read.
 *
 * `--mentions` is @-mentions of you only (`user_mention`) — the exact set the
 * web and app "Mentions" tab show, applied server-side. A direct message is
 * its own axis (`--type dm`), so it is deliberately not folded in.
 */

interface NotificationRow {
  id: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  read: boolean;
  createdAt: string;
}

interface NotificationPage {
  data?: NotificationRow[];
  unreadCount?: number;
  scopedUnreadCount?: number;
  pagination?: { nextCursor?: string | null; hasMore?: boolean };
}

// The 'post' vs 'dm' split the CLI exposes, mapped onto server notification
// types. Everything in a DM conversation is 'dm'; everything that is a feed
// post/reply/engagement is 'post'. Membership/invite/artifact rows are neither
// and show only under `--type all`. This one classification is shared by the
// list filter and the live-stream filter, and mirrors the web/app clients.
const DM_TYPES = new Set(["dm_message"]);
// Capture output the gobi-cloud analyzers finished — a conversation's note, or a
// closed activity. Nobody ACTED, so these are their own axis rather than a kind
// of post: `--type capture` is the headless way to watch a Sense day land. They
// arrive as ordinary inbox rows (one coalesced row per kind, rewritten in place
// as more finish), so `listen` streams them like anything else.
const CAPTURE_TYPES = new Set(["capture_note", "capture_activity"]);
const POST_TYPES = new Set([
  "user_mention",
  "participant_reply",
  "reaction",
  "repost",
  "space_new_post",
  "space_new_reply",
]);

// Fill discipline for a client-side filter: keep paging until we have `limit`
// MATCHES or the inbox runs dry, capped so a filter that matches nothing can't
// walk forever against a huge inbox.
const MAX_PAGES = 20;
const SERVER_PAGE = 50;

interface FilterOpts {
  space?: string;
  channel?: string;
  type?: string;
  unread?: boolean;
  mentions?: boolean;
}

function isDmRow(n: NotificationRow): boolean {
  return DM_TYPES.has(n.type) || n.data?.dm === "true" || n.data?.isDm === "true";
}

/** Declare the shared SCOPE/FILTER flags on a command. `list` and `listen`
 *  take the identical axes, so they register them the same way. */
function addFilterOptions(c: Command): Command {
  return c
    .option("--space <slug>", "Scope to one space (omit for every space + personal)")
    .option("--channel <id>", "Scope to one channel within --space (needs --space)")
    .option("--type <type>", "all | post | dm | capture (default: all)", "all")
    .option("--unread", "Only unread notifications")
    .option("--mentions", "Only @-mentions of you (matches the web/app Mentions tab)");
}

/** Validate the shared flags; returns the normalized type, or null on error
 *  (having already set a non-zero exit code and printed why). */
function normalizeFilter(opts: FilterOpts): { type: string } | null {
  const type = (opts.type ?? "all").toLowerCase();
  if (!["all", "post", "dm", "capture"].includes(type)) {
    console.error("--type must be one of: all, post, dm, capture");
    process.exitCode = 1;
    return null;
  }
  if (opts.channel && !opts.space) {
    console.error("--channel needs --space (a channel lives inside one space)");
    process.exitCode = 1;
    return null;
  }
  return { type };
}

/** One row-level predicate for the whole FILTER axis, so `list` and `listen`
 *  classify identically. Scope (space/channel), type, and unread are row-data
 *  checks; mentions is `user_mention` only. */
function makeRefiner(opts: FilterOpts, type: string): (n: NotificationRow) => boolean {
  return (n) => {
    if (opts.space && n.data?.spaceSlug !== opts.space) return false;
    if (opts.channel && n.data?.channelId !== opts.channel) return false;
    if (opts.unread && n.read) return false;
    if (opts.mentions && n.type !== "user_mention") return false;
    if (type === "dm" && !isDmRow(n)) return false;
    if (type === "post" && (!POST_TYPES.has(n.type) || isDmRow(n))) return false;
    if (type === "capture" && !CAPTURE_TYPES.has(n.type)) return false;
    return true;
  };
}

export function registerNotificationsCommand(program: Command): void {
  // A pure group: no options, no default action of its own. `list` is the
  // default subcommand, so `gobi notifications [flags]` runs the listing while
  // `listen` / `read` keep their own uncollided flags.
  const group = program
    .command("notifications")
    .alias("notifs")
    .description("Your activity inbox: list (default), listen, read.");

  // ─── list (default) ────────────────────────────────────────────────────
  addFilterOptions(group.command("list", { isDefault: true }))
    .description(
      "List activity notifications. Scope with --space/--channel; filter with --type/--unread/--mentions.",
    )
    .option("--limit <n>", "Max MATCHING rows to return (default 30)", "30")
    .action(async (opts: FilterOpts & { limit?: string }, command: Command) => {
      const norm = normalizeFilter(opts);
      if (!norm) return;
      const { type } = norm;
      const limit = Math.max(1, Number(opts.limit ?? "30") || 30);
      const refine = makeRefiner(opts, type);

      // The server can express `unread` and `mentions`; push the more selective
      // one (mentions) to it and refine the rest client-side. A client-side
      // filter means we must keep paging to fill `limit` matches, not trust one
      // page — otherwise a DM on page 2 is invisible behind `--type dm`.
      const serverFilter = opts.mentions ? "mentions" : opts.unread ? "unread" : undefined;
      const unreadClientSide = !!opts.unread && serverFilter !== "unread";
      const clientFiltered = !!(opts.channel || opts.space || unreadClientSide || type !== "all");
      const pageSize = clientFiltered ? SERVER_PAGE : Math.min(limit, SERVER_PAGE);

      const baseParams: Record<string, unknown> = {};
      if (opts.space) baseParams.spaceSlug = opts.space;
      if (serverFilter) baseParams.filter = serverFilter;

      const matched: NotificationRow[] = [];
      let cursor: string | undefined;
      let scanned = 0;
      let unreadCount = 0;
      let scopedUnreadCount = 0;
      // reachedEnd = the inbox ran out (authoritative "nothing more").
      // hitCap     = stopped at MAX_PAGES with rows unscanned (bounded sample).
      let reachedEnd = false;
      let hitCap = false;
      for (let page = 0; ; page++) {
        if (page >= MAX_PAGES) {
          hitCap = true;
          break;
        }
        const params: Record<string, unknown> = { ...baseParams, limit: String(pageSize) };
        if (cursor) params.cursor = cursor;
        const resp = (await apiGet("/notifications", params)) as NotificationPage;
        const rows = resp.data ?? [];
        scanned += rows.length;
        unreadCount = resp.unreadCount ?? unreadCount;
        scopedUnreadCount = resp.scopedUnreadCount ?? scopedUnreadCount;
        matched.push(...rows.filter(refine));

        const next = resp.pagination?.nextCursor ?? null;
        if (!next) {
          // Inbox exhausted — the one authoritative stop. Before the count
          // check so an inbox of exactly `limit` reports no more.
          reachedEnd = true;
          break;
        }
        if (matched.length >= limit) break;
        cursor = next;
      }
      const out = matched.slice(0, limit);
      // Row-level resume is impossible here — the server cursor is page-granular
      // while the filter is row-granular, so a resumed cursor would drop or
      // repeat rows. Report honestly instead: raise --limit for more.
      const more = matched.length > limit || !reachedEnd;

      if (isJsonMode(command)) {
        jsonOut({
          notifications: out,
          unreadCount,
          scopedUnreadCount,
          scanned,
          // true ⇒ more matching rows exist; re-run with a larger --limit.
          hasMore: more,
          // true ⇒ stopped at the page cap without exhausting the inbox, so
          // `out` is a bounded sample of a sparse filter.
          truncated: hitCap,
        });
        return;
      }

      if (out.length === 0) {
        console.log("No notifications match.");
        return;
      }
      for (const n of out) {
        const dot = n.read ? " " : "●";
        const where = n.data?.channelName ? ` · #${n.data.channelName}` : "";
        const space = n.data?.spaceSlug ? ` [${n.data.spaceSlug}]` : "";
        console.log(`${dot} ${n.title}${space}${where}`);
        if (n.body) console.log(`    ${n.body.replace(/\n/g, " ").slice(0, 100)}`);
        console.log(`    ${n.type} · ${n.createdAt} · id=${n.id}`);
      }
      const moreNote = hitCap
        ? ` · stopped after scanning ${scanned} — raise --limit for more`
        : more
          ? " · more available (raise --limit)"
          : "";
      console.log(`\n${out.length} shown · ${scopedUnreadCount} unread in scope${moreNote}`);
    });

  // ─── listen ────────────────────────────────────────────────────────────
  addFilterOptions(group.command("listen"))
    .description(
      "Stream notifications live as they arrive (headless, no browser). One NDJSON object per line. Carries capture output too — a note or activity an analyzer just finished shows up as a `capture_note` / `capture_activity` row (`--type capture` for those alone). Pure live — events that land while disconnected are NOT replayed; run `list` to backfill. Same scope/filter flags as list.",
    )
    .action(async (opts: FilterOpts) => {
      const norm = normalizeFilter(opts);
      if (!norm) return;
      const { type } = norm;
      const self = getCurrentUser();
      if (!self) {
        console.error("Not authenticated. Run `gobi auth login` (or `gobi auth token <key>`).");
        process.exitCode = 1;
        return;
      }
      const keep = makeRefiner(opts, type);

      // The bot subscribes to its OWN always-on channel `user:<id>`, where the
      // backend fans out every inbox row as an `activity` message with
      // `type:'notification.new'`. Auth rides authCallback → POST /ably/auth,
      // which mints a membership-scoped Ably token from the caller's bearer;
      // the SDK re-invokes it on renewal (30-min TTL) with no code here.
      const client = new Ably.Realtime({
        authCallback: async (_params, callback) => {
          try {
            const tokenRequest = await apiPost("/ably/auth");
            callback(null, tokenRequest as Ably.TokenRequest);
          } catch (err: unknown) {
            callback(err instanceof Error ? err.message : "ably auth failed", null);
          }
        },
      });

      // Resolve exactly once — on a signal or a fatal connection error — so the
      // process exits cleanly either way.
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = (code?: number) => {
          if (done) return;
          done = true;
          if (code != null) process.exitCode = code;
          client.close();
          resolve();
        };

        client.connection.on("failed", (state) => {
          console.error(`Realtime connection failed: ${state.reason?.message ?? "unknown"}`);
          finish(1);
        });
        process.on("SIGINT", () => finish());
        process.on("SIGTERM", () => finish());

        const channel = client.channels.get(`user:${self.id}`);
        channel
          .subscribe("activity", (msg) => {
            // Envelope: { type, data:{ notification:<row> }, createdAt }. Only
            // notification.new carries a row; badge/settings/roster events on
            // the same channel are ignored.
            const env = (msg.data ?? {}) as {
              type?: string;
              data?: { notification?: NotificationRow };
            };
            if (env.type !== "notification.new") return;
            const n = env.data?.notification;
            if (!n || typeof n.type !== "string") return;
            if (!keep(n)) return;
            process.stdout.write(JSON.stringify(n) + "\n");
          })
          .catch((err: unknown) => {
            // A subscribe rejection means the token lacks the capability — which
            // should never happen for one's own channel, so surface it loudly.
            console.error(
              `Could not subscribe to notifications: ${err instanceof Error ? err.message : String(err)}`,
            );
            finish(1);
          });
      });
    });

  // ─── read ──────────────────────────────────────────────────────────────
  group
    .command("read [id]")
    .description(
      "Mark notifications read: `read <id>` for one, or `read --all` (optionally --space) for the whole scope.",
    )
    .option("--all", "Mark every notification read (respects --space)")
    .option("--space <slug>", "With --all, limit to one space")
    .action(
      async (id: string | undefined, opts: { all?: boolean; space?: string }, command: Command) => {
        if (opts.all) {
          const params = new URLSearchParams();
          if (opts.space) params.append("spaceSlug", opts.space);
          const qs = params.toString();
          const resp = (await apiPatch(`/notifications/read-all${qs ? `?${qs}` : ""}`, {})) as {
            data?: { updated?: number };
          };
          const count = resp?.data?.updated;
          if (isJsonMode(command)) {
            jsonOut({ ok: true, all: true, space: opts.space ?? null, count: count ?? null });
            return;
          }
          console.log(
            `Marked ${count ?? "all"} notification(s) read${opts.space ? ` in ${opts.space}` : ""}.`,
          );
          return;
        }
        if (!id) {
          console.error("Pass a notification id, or --all to clear the scope.");
          process.exitCode = 1;
          return;
        }
        await apiPatch(`/notifications/${id}/read`, {});
        if (isJsonMode(command)) {
          jsonOut({ ok: true, id: Number(id) });
          return;
        }
        console.log(`Marked notification ${id} read.`);
      },
    );
}
