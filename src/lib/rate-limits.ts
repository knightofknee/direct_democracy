import { doc, type Timestamp } from 'firebase/firestore';

import { useAuth } from '@/hooks/use-auth';
import { useRerenderAt } from '@/hooks/use-rerender-at';
import { useLiveDoc } from '@/hooks/use-firestore';
import { db } from '@/lib/firebase';

/**
 * Client mirror of the daily limits in functions/src/posting.ts
 * (RATE_LIMITS) for the forms that show one ahead of time. The triggers are
 * the gate; this only says so before someone writes the post. Keep the
 * numbers in sync.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export const DAILY_LIMITS = {
  cityConcerns: 2,
  cityQuestions: 3,
  electionQuestions: 3,
} as const;

export type DailyBucket = keyof typeof DAILY_LIMITS;

/** When the next post in a bucket opens, or null if one is open now. */
export function nextRateAt(bucket: DailyBucket, times: number[], now = Date.now()): Date | null {
  const max = DAILY_LIMITS[bucket];
  const recent = times.filter((t) => t > now - DAY_MS).sort((a, b) => a - b);
  return recent.length >= max ? new Date(recent[recent.length - max] + DAY_MS) : null;
}

/** The signed-in user's next opening in a bucket (null = open now, or no bucket). */
export function useRateWindow(bucket: DailyBucket | null): Date | null {
  const { profile } = useAuth();
  const { data } = useLiveDoc<{ times?: Timestamp[] }>(
    () => (profile && bucket ? doc(db, 'users', profile.uid, 'rateLimits', bucket) : null),
    [profile?.uid, bucket]
  );
  const next = bucket ? nextRateAt(bucket, (data?.times ?? []).map((t) => t.toMillis())) : null;
  useRerenderAt(next);
  return next;
}
