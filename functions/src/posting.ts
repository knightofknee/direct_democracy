/**
 * Ward posting limits (2026-09-27). A "post" is a ward concern or a question
 * to a ward's alderman; anyone signed in may post in any ward, within limits:
 *
 * - Home ward: at most HOME_POSTS_PER_DAY in any rolling 24 hours.
 * - Any other ward: one post per AWAY_POST_GAP_MS in that ward, and at most
 *   MAX_OTHER_WARDS different wards besides the home ward in any rolling
 *   week. Starting a discussion should come with the bandwidth to answer
 *   it; ten weeks of steady effort still reaches every ward. Wards posted in
 *   while they were home count once they no longer are, so hopping home
 *   wards is no way around the cap.
 * - A declared home ward can be changed freely until its owner posts there;
 *   the second home-ward post locks it for a week, the third for 3 months.
 *
 * The triggers are the gate (onConcernCreated, onQuestionCreated): each post
 * is judged against a server-written ledger of the author's recent post
 * times per ward (users/{uid}/wardPosts/{wardId}) and their last post time
 * in every ward this week (users/{uid}.recentPostWards), and deleted if it
 * breaks a limit. Withdrawing a post never frees its slot, since the ledger keeps it.
 * The app reads the same ledger to say when the next post opens, so honest
 * users never see a refusal. The client mirror of these numbers lives in
 * src/lib/ward-posting.ts; keep them in sync.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const HOME_POSTS_PER_DAY = 3;
export const AWAY_POST_GAP_MS = 7 * DAY_MS;
export const LOCK_AFTER_TWO_MS = 7 * DAY_MS;
export const LOCK_AFTER_THREE_MS = 90 * DAY_MS;
export const MAX_OTHER_WARDS = 5;
const WARD_WINDOW_MS = 7 * DAY_MS;

/** Enough history to answer both limits (3 a day at home, 1 a week away). */
const LEDGER_KEEP = HOME_POSTS_PER_DAY;

export type WardPostVerdict =
  | {
      ok: true;
      /** The ledger after this post, oldest first. */
      times: number[];
      /** Home-ward fields for the author's profile, or null for an away post. */
      home: { posts: number; lockedUntil: number | null } | null;
      /** Last post time per ward within the week, this post included. */
      recentWards: Record<string, number>;
    }
  | { ok: false; reason: 'home' | 'away' | 'wards'; nextAt: number };

export function judgeWardPost(input: {
  at: number;
  wardId: number;
  /** The author's home ward, if any. */
  homeWardId: number | null;
  /** Earlier post times in this ward, any order. */
  times: number[];
  /** Posts in the home ward since it was set (profile.homeWardPosts). */
  homePosts: number;
  lockedUntil: number | null;
  /** Last post time per ward (profile.recentPostWards), any age. */
  recentWards: Record<string, number>;
}): WardPostVerdict {
  const home = input.homeWardId != null && input.homeWardId === input.wardId;
  const times = [...input.times].sort((a, b) => a - b);
  if (home) {
    const today = times.filter((t) => t > input.at - DAY_MS);
    if (today.length >= HOME_POSTS_PER_DAY) {
      return { ok: false, reason: 'home', nextAt: today[today.length - HOME_POSTS_PER_DAY] + DAY_MS };
    }
  } else {
    const last = times[times.length - 1];
    if (last != null && last > input.at - AWAY_POST_GAP_MS) {
      return { ok: false, reason: 'away', nextAt: last + AWAY_POST_GAP_MS };
    }
  }

  const nextAt = otherWardsOpenAt(input);
  if (nextAt != null) return { ok: false, reason: 'wards', nextAt };

  const recentWards: Record<string, number> = { [String(input.wardId)]: input.at };
  for (const [ward, t] of Object.entries(input.recentWards)) {
    if (ward !== String(input.wardId) && t > input.at - WARD_WINDOW_MS) recentWards[ward] = t;
  }
  const next = [...times, input.at].slice(-LEDGER_KEEP);
  if (!home) return { ok: true, times: next, home: null, recentWards };

  const posts = input.homePosts + 1;
  // Only the posts that cross a line set the lock; later ones never extend it.
  const lockAt =
    posts === 2 ? input.at + LOCK_AFTER_TWO_MS : posts === 3 ? input.at + LOCK_AFTER_THREE_MS : null;
  const lockedUntil =
    lockAt == null ? input.lockedUntil : Math.max(lockAt, input.lockedUntil ?? 0);
  return { ok: true, times: next, home: { posts, lockedUntil }, recentWards };
}

/**
 * The 5-other-wards cap: null when this post keeps the author within it,
 * else when enough of the week's other wards age out to allow it. The
 * wards counted are those posted in during the last week, other than the
 * current home ward, plus this post's ward when it is not home.
 */
export function otherWardsOpenAt(input: {
  at: number;
  wardId: number;
  homeWardId: number | null;
  recentWards: Record<string, number>;
}): number | null {
  const others = Object.entries(input.recentWards)
    .filter(
      ([ward, t]) =>
        t > input.at - WARD_WINDOW_MS &&
        ward !== String(input.homeWardId) &&
        ward !== String(input.wardId)
    )
    .map(([, t]) => t)
    .sort((a, b) => a - b);
  const counted = others.length + (input.wardId === input.homeWardId ? 0 : 1);
  if (counted <= MAX_OTHER_WARDS) return null;
  // The oldest (counted - MAX) have to age out first.
  return others[counted - MAX_OTHER_WARDS - 1] + WARD_WINDOW_MS;
}

// ── Rate limits beyond wards ───────────────────────────────────────────
// The same trigger-gate pattern for everything else a person can post
// (2026-09-28): each post is judged against a server-written ledger of the
// author's recent times in its bucket (users/{uid}/rateLimits/{bucket}) and
// deleted over the limit. Generous enough that nobody taking part in good
// faith meets them; tight enough that one account cannot flood a list, the
// report queue, or other people's notifications. Mirrored for the forms that
// show a limit ahead of time in src/lib/rate-limits.ts; keep them in sync.

const HOUR_MS = 60 * 60 * 1000;

export interface RateRule {
  windowMs: number;
  max: number;
}

export const RATE_LIMITS = {
  cityConcerns: [{ windowMs: DAY_MS, max: 2 }],
  cityQuestions: [{ windowMs: DAY_MS, max: 3 }],
  electionQuestions: [{ windowMs: DAY_MS, max: 3 }],
  comments: [
    { windowMs: HOUR_MS, max: 20 },
    { windowMs: DAY_MS, max: 100 },
  ],
  reports: [{ windowMs: DAY_MS, max: 10 }],
  wardChanges: [{ windowMs: DAY_MS, max: 5 }],
  edits: [{ windowMs: HOUR_MS, max: 30 }],
  addressLookups: [{ windowMs: DAY_MS, max: 5 }],
} satisfies Record<string, RateRule[]>;

export type RateBucket = keyof typeof RATE_LIMITS;

export function judgeRate(
  rules: RateRule[],
  times: number[],
  at: number
): { ok: true; times: number[] } | { ok: false; nextAt: number } {
  const sorted = [...times].sort((a, b) => a - b);
  let nextAt = 0;
  for (const rule of rules) {
    const recent = sorted.filter((t) => t > at - rule.windowMs);
    if (recent.length >= rule.max) {
      nextAt = Math.max(nextAt, recent[recent.length - rule.max] + rule.windowMs);
    }
  }
  if (nextAt) return { ok: false, nextAt };
  const longest = Math.max(...rules.map((r) => r.windowMs));
  const keep = Math.max(...rules.map((r) => r.max));
  return { ok: true, times: [...sorted.filter((t) => t > at - longest), at].slice(-keep) };
}
