import { doc, type Timestamp } from 'firebase/firestore';

import { useAuth } from '@/hooks/use-auth';
import { useRerenderAt } from '@/hooks/use-rerender-at';
import { useLiveDoc } from '@/hooks/use-firestore';
import { db } from '@/lib/firebase';
import { dateLocale } from '@/lib/i18n';
import type { UserProfile } from '@/lib/types';

/**
 * Client mirror of the ward posting limits in functions/src/posting.ts
 * (keep the numbers in sync). A post is a ward concern or a question to a
 * ward's alderman. The triggers are the gate and delete a post over the
 * limit; this only lets the app say so BEFORE someone writes one, reading
 * the same server-written ledger (users/{uid}/wardPosts/{wardId}).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const HOME_POSTS_PER_DAY = 3;
const AWAY_POST_GAP_MS = 7 * DAY_MS;
export const MAX_OTHER_WARDS = 5;
const WARD_WINDOW_MS = 7 * DAY_MS;

/** When the next post in a ward opens, or null if one is open now. */
export function nextWardPostAt(times: number[], home: boolean, now = Date.now()): Date | null {
  const sorted = [...times].sort((a, b) => a - b);
  if (home) {
    const today = sorted.filter((t) => t > now - DAY_MS);
    return today.length >= HOME_POSTS_PER_DAY
      ? new Date(today[today.length - HOME_POSTS_PER_DAY] + DAY_MS)
      : null;
  }
  const last = sorted[sorted.length - 1];
  return last != null && last > now - AWAY_POST_GAP_MS ? new Date(last + AWAY_POST_GAP_MS) : null;
}

/**
 * The 5-other-wards cap (see posting.ts): when a post in `wardId` fits
 * within it again, or null if it fits now.
 */
export function otherWardsOpenAt(
  wardId: number,
  homeWardId: number | null,
  recent: Record<string, number>,
  now = Date.now()
): Date | null {
  const others = Object.entries(recent)
    .filter(([ward, t]) => t > now - WARD_WINDOW_MS && ward !== String(homeWardId) && ward !== String(wardId))
    .map(([, t]) => t)
    .sort((a, b) => a - b);
  const counted = others.length + (wardId === homeWardId ? 0 : 1);
  return counted <= MAX_OTHER_WARDS ? null : new Date(others[counted - MAX_OTHER_WARDS - 1] + WARD_WINDOW_MS);
}

/**
 * The signed-in user's standing to post in one ward: whether it is their
 * home ward, and when their next post there opens (null = open now) and
 * which limit is holding it.
 */
export function useWardPostWindow(wardId: number | null): {
  home: boolean;
  nextAt: Date | null;
  reason: 'home' | 'away' | 'wards' | null;
  loading: boolean;
} {
  const { profile } = useAuth();
  const { data, loading } = useLiveDoc<{ times?: Timestamp[] }>(
    () => (profile && wardId != null ? doc(db, 'users', profile.uid, 'wardPosts', String(wardId)) : null),
    [profile?.uid, wardId]
  );
  const home = profile?.wardId != null && profile.wardId === wardId;
  const times = (data?.times ?? []).map((t) => t.toMillis());
  const own = nextWardPostAt(times, home);
  const recent = Object.fromEntries(
    Object.entries(profile?.recentPostWards ?? {}).map(([w, t]) => [w, t.toMillis()])
  );
  const cap = wardId == null ? null : otherWardsOpenAt(wardId, profile?.wardId ?? null, recent);
  useRerenderAt(own && cap ? (own >= cap ? own : cap) : (own ?? cap));
  if (own && (!cap || own >= cap)) return { home, nextAt: own, reason: home ? 'home' : 'away', loading };
  if (cap) return { home, nextAt: cap, reason: 'wards', loading };
  return { home, nextAt: null, reason: null, loading };
}

/** A declared ward's lock, or null when it can be changed now. */
export function wardLockedUntil(profile: UserProfile | null): Date | null {
  const ms = profile?.wardLockedUntil?.toMillis?.() ?? 0;
  return ms > Date.now() ? new Date(ms) : null;
}

/**
 * "Monday, September 28 at 3:15 PM" (or just the date) in the app's
 * language, on Chicago's clock: meetings, votes, and deadlines are Chicago
 * events, and a web visitor elsewhere must not see the day before.
 */
export function formatWhen(date: Date, withTime = true): string {
  const locale = dateLocale();
  const timeZone = 'America/Chicago';
  return withTime
    ? date.toLocaleString(locale, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone })
    : date.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric', timeZone });
}
