/**
 * Server-side tally arithmetic — the only place aggregate counts are written.
 * Mirrors the shapes in src/lib/types.ts (the app package and this functions
 * package don't share code, so the ~60 lines are duplicated by design; keep
 * both in sync if the ballot model changes).
 */

export interface DualTally {
  all: Record<string, number>;
  verified: Record<string, number>;
  registered: Record<string, number>;
  totalAll: number;
  totalVerified: number;
  totalRegistered: number;
}

export type VoteValue = string | string[];

export interface VoterSlices {
  verified: boolean;
  registeredVoter: boolean;
}

export const PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

export const ANSWER_JUDGMENT_QUORUM = 5;

function keysOf(value: VoteValue): string[] {
  return Array.isArray(value) ? value : [value];
}

function bump(counts: Record<string, number>, key: string, delta: number) {
  const next = (counts[key] ?? 0) + delta;
  if (next <= 0) delete counts[key];
  else counts[key] = next;
}

function clone(tally: DualTally): DualTally {
  return {
    all: { ...tally.all },
    verified: { ...tally.verified },
    registered: { ...tally.registered },
    totalAll: tally.totalAll,
    totalVerified: tally.totalVerified,
    totalRegistered: tally.totalRegistered,
  };
}

/** Add one ballot. */
export function addBallot(tally: DualTally, value: VoteValue, voter: VoterSlices): DualTally {
  const t = clone(tally);
  const slices: [Record<string, number>, boolean][] = [
    [t.all, true],
    [t.verified, voter.verified],
    [t.registered, voter.registeredVoter],
  ];
  for (const [counts, applies] of slices) {
    if (!applies) continue;
    for (const k of keysOf(value)) bump(counts, k, +1);
  }
  t.totalAll += 1;
  if (voter.verified) t.totalVerified += 1;
  if (voter.registeredVoter) t.totalRegistered += 1;
  return t;
}

/** Remove one ballot, using the slices stored on that ballot. */
export function removeBallot(tally: DualTally, value: VoteValue, voter: VoterSlices): DualTally {
  const t = clone(tally);
  const slices: [Record<string, number>, boolean][] = [
    [t.all, true],
    [t.verified, voter.verified],
    [t.registered, voter.registeredVoter],
  ];
  for (const [counts, applies] of slices) {
    if (!applies) continue;
    for (const k of keysOf(value)) bump(counts, k, -1);
  }
  t.totalAll = Math.max(0, t.totalAll - 1);
  if (voter.verified) t.totalVerified = Math.max(0, t.totalVerified - 1);
  if (voter.registeredVoter) t.totalRegistered = Math.max(0, t.totalRegistered - 1);
  return t;
}

export function weightedScore(counts: Record<string, number>, weights: Record<string, number>): number {
  let score = 0;
  for (const [key, count] of Object.entries(counts)) {
    score += (weights[key] ?? 0) * count;
  }
  return score;
}
