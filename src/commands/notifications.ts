import { Command } from "commander";
import { apiGet, apiPatch } from "../client.js";
import { isJsonMode, jsonOut } from "./utils.js";

/**
 * `gobi notifications` — the activity inbox, on two axes.
 *
 *   SCOPE (where):  global (default) | --space <slug> | --space <slug> --channel <id>
 *   FILTER (what):  --type all|post|dm  ·  --unread  ·  --mine
 *
 * Scope is applied server-side (spaceSlug narrows the query; --channel narrows
 * further on the row's data.channelId). Filters compose freely; the ones the
 * server can't express (type, channel, mine) are refined client-side.
 *
 * Because a client-side filter is refined AFTER the server pages, a naive
 * single fetch would window the results (a DM on page 2 would be invisible
 * behind a --type dm). So when any client filter is active we keep pulling
 * pages until we have `limit` matches or the inbox runs dry — the count the
 * user asked for is a count of MATCHES, not of rows scanned.
 *
 * A bot's loop is `notifications --unread --json` (what it hasn't seen; add
 * --type dm or --mentions to narrow), handle them, then `notifications read
 * --all` (optionally scoped) to ack — or `read <id>` per item.
 *
 * `--mentions` is @-mentions of you only (user_mention) — the exact set the
 * web and app "Mentions" tab shows, done server-side. A direct message is its
 * own axis (`--type dm`), so it is deliberately not folded in here.
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
// and show only under `--type all`.
const DM_TYPES = new Set(["dm_message"]);
const POST_TYPES = new Set([
  "user_mention",
  "participant_reply",
  "reaction",
  "repost",
  "space_new_post",
  "space_new_reply",
]);
// Hard ceiling on pages walked while filling a client-side filter, so a filter
// that matches nothing can't spin forever against a huge inbox.
const MAX_PAGES = 20;
const SERVER_PAGE = 50;

function isDmRow(n: NotificationRow): boolean {
  return DM_TYPES.has(n.type) || n.data?.dm === "true" || n.data?.isDm === "true";
}

export function registerNotificationsCommand(program: Command): void {
  const cmd = program
    .command("notifications")
    .alias("notifs")
    .description(
      "List your activity notifications. Scope with --space/--channel; filter with --type/--unread/--mentions.",
    )
    .option("--space <slug>", "Scope to one space (omit for every space + personal)")
    .option("--channel <id>", "Scope to one channel within --space (needs --space)")
    .option("--type <type>", "all | post | dm (default: all)", "all")
    .option("--unread", "Only unread notifications")
    .option("--mentions", "Only @-mentions of you (same as the web/app Mentions tab)")
    .option("--limit <n>", "Max MATCHING rows to return (default 30)", "30")
    .action(
      async (opts: {
        space?: string;
        channel?: string;
        type?: string;
        unread?: boolean;
        mentions?: boolean;
        limit?: string;
      }) => {
        const type = (opts.type ?? "all").toLowerCase();
        if (!["all", "post", "dm"].includes(type)) {
          console.error("--type must be one of: all, post, dm");
          process.exitCode = 1;
          return;
        }
        if (opts.channel && !opts.space) {
          console.error("--channel needs --space (a channel lives inside one space)");
          process.exitCode = 1;
          return;
        }
        const limit = Math.max(1, Number(opts.limit ?? "30") || 30);

        // The server's `filter` param is single-valued. Push the MORE selective
        // one (mentions) server-side; refine the other (unread) client-side.
        const serverFilter = opts.mentions ? "mentions" : opts.unread ? "unread" : undefined;
        const unreadClientSide = !!opts.unread && serverFilter !== "unread";

        const refine = (rows: NotificationRow[]): NotificationRow[] => {
          let r = rows;
          if (opts.channel) r = r.filter((n) => n.data?.channelId === opts.channel);
          if (unreadClientSide) r = r.filter((n) => !n.read);
          if (type === "dm") r = r.filter(isDmRow);
          else if (type === "post") r = r.filter((n) => POST_TYPES.has(n.type) && !isDmRow(n));
          return r;
        };
        // A client-side refinement means we must keep paging to fill `limit`
        // matches rather than trusting one page. --mentions is server-side, so
        // it doesn't count here; a client-side --unread (when --mentions won the
        // server slot) does.
        const clientFiltered = !!(opts.channel || unreadClientSide || type !== "all");

        const baseParams: Record<string, unknown> = {};
        if (opts.space) baseParams.spaceSlug = opts.space;
        if (serverFilter) baseParams.filter = serverFilter;

        // Fetch full server pages ONLY when a client-side filter needs backfill;
        // an unfiltered list can ask the server for exactly `limit`.
        const pageSize = clientFiltered ? SERVER_PAGE : Math.min(Math.max(limit, 1), SERVER_PAGE);

        const matched: NotificationRow[] = [];
        let cursor: string | undefined;
        let scanned = 0;
        let unreadCount = 0;
        let scopedUnreadCount = 0;
        // `reachedEnd` = the inbox ran out (authoritative "nothing more").
        // `hitCap`     = we stopped at MAX_PAGES with rows still unscanned, so
        //                the result is a bounded sample, not the whole match set.
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
          matched.push(...refine(rows));

          const next = resp.pagination?.nextCursor ?? null;
          if (!next) {
            // Inbox exhausted — this is the one authoritative stop. Checked
            // before the count so an inbox of exactly `limit` reports no more.
            reachedEnd = true;
            break;
          }
          if (matched.length >= limit) break; // have enough matches to satisfy the request
          cursor = next;
        }
        const out = matched.slice(0, limit);
        // Row-level resume is impossible here — the server's cursor is
        // page-granular while the filter is row-granular, so a resumed cursor
        // would drop or repeat rows. Instead of a broken cursor, report honestly
        // whether the whole match set was covered: raise --limit for more.
        // `more` is true if matches were trimmed, or we stopped before the inbox
        // ended (either enough-matches or the page cap).
        const more = matched.length > limit || !reachedEnd;

        if (isJsonMode(cmd)) {
          jsonOut({
            notifications: out,
            unreadCount,
            scopedUnreadCount,
            scanned,
            // true ⇒ more matching rows exist beyond these; re-run with a larger
            // --limit to see them (there is deliberately no resume cursor).
            hasMore: more,
            // true ⇒ stopped at the page cap without exhausting the inbox, so
            // `out` is a bounded sample of a sparse filter, not the full set.
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
      },
    );

  cmd
    .command("read [id]")
    .description(
      "Mark notifications read: `read <id>` for one, or `read --all` (optionally --space) for the whole scope.",
    )
    .option("--all", "Mark every notification read (respects --space)")
    .option("--space <slug>", "With --all, limit to one space")
    .action(async (id: string | undefined, opts: { all?: boolean; space?: string }) => {
      if (opts.all) {
        const params = new URLSearchParams();
        if (opts.space) params.append("spaceSlug", opts.space);
        const qs = params.toString();
        const resp = (await apiPatch(
          `/notifications/read-all${qs ? `?${qs}` : ""}`,
          {},
        )) as { data?: { updated?: number } };
        const count = resp?.data?.updated;
        if (isJsonMode(cmd)) {
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
      if (isJsonMode(cmd)) {
        jsonOut({ ok: true, id: Number(id) });
        return;
      }
      console.log(`Marked notification ${id} read.`);
    });
}
