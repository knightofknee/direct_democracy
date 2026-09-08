import type { DualTally, TallyLens } from '@/lib/types';

/**
 * Read-side tally helpers. All tally *writes* happen server-side in
 * functions/src/tally.ts - clients only ever write their own ballot docs.
 */

/**
 * Priority → board-score weights, the client mirror of PRIORITY_WEIGHTS in
 * functions/src/tally.ts (the tally of record). Used only for optimistic
 * score bumps; keep both in sync if the scale changes.
 */
export const PRIORITY_WEIGHTS: Record<string, number> = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  // Legacy named ballots cast before the numeric scale, mapped onto it.
  critical: 5,
  high: 4,
  medium: 2,
  low: 1,
};

export function emptyTally(): DualTally {
  return { all: {}, verified: {}, totalAll: 0, totalVerified: 0 };
}

export function tallyFor(tally: DualTally, lens: TallyLens): { counts: Record<string, number>; total: number } {
  switch (lens) {
    case 'all':
      return { counts: tally.all, total: tally.totalAll };
    case 'verified':
      return { counts: tally.verified, total: tally.totalVerified };
  }
}

/** One voter's in-flight ballot change, for optimistic display. */
export interface BallotDelta {
  /** The ballot being replaced (null when this is a first cast). */
  from: string | string[] | null;
  /** The new ballot (null when retracting). */
  to: string | string[] | null;
  /** Whether this voter counts in the item's verified slice (area-scoped). */
  verified: boolean;
}

function keysOf(value: string | string[] | null): string[] {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}

function bump(counts: Record<string, number>, key: string, delta: number) {
  const next = (counts[key] ?? 0) + delta;
  if (next <= 0) delete counts[key];
  else counts[key] = next;
}

/**
 * The tally as it will read once the server trigger folds this voter's
 * change in - mirror of addBallot/removeBallot in functions/src/tally.ts.
 * Used to show a just-cast vote instantly instead of waiting the seconds a
 * Cloud Functions round trip (or cold start) takes; the caller swaps back to
 * the server tally the moment it moves.
 */
export function withBallotDelta(tally: DualTally, delta: BallotDelta): DualTally {
  const t: DualTally = {
    all: { ...tally.all },
    verified: { ...tally.verified },
    totalAll: tally.totalAll,
    totalVerified: tally.totalVerified,
  };
  if (delta.from != null) {
    for (const k of keysOf(delta.from)) {
      bump(t.all, k, -1);
      if (delta.verified) bump(t.verified, k, -1);
    }
    t.totalAll = Math.max(0, t.totalAll - 1);
    if (delta.verified) t.totalVerified = Math.max(0, t.totalVerified - 1);
  }
  if (delta.to != null) {
    for (const k of keysOf(delta.to)) {
      bump(t.all, k, +1);
      if (delta.verified) bump(t.verified, k, +1);
    }
    t.totalAll += 1;
    if (delta.verified) t.totalVerified += 1;
  }
  return t;
}
