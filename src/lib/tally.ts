import type { DualTally, TallyLens, VoteValue } from '@/lib/types';

export function emptyTally(): DualTally {
  return {
    all: {},
    verified: {},
    registered: {},
    totalAll: 0,
    totalVerified: 0,
    totalRegistered: 0,
  };
}

function keysOf(value: VoteValue): string[] {
  return Array.isArray(value) ? value : [value];
}

function bump(counts: Record<string, number>, key: string, delta: number) {
  const next = (counts[key] ?? 0) + delta;
  if (next <= 0) delete counts[key];
  else counts[key] = next;
}

interface VoterSlices {
  verified: boolean;
  registeredVoter: boolean;
}

/**
 * Pure tally arithmetic shared by every votable thing (concerns, polls).
 * One ballot per person: removing the previous value before applying the new
 * one keeps totals correct when someone changes their vote. Approval-style
 * ballots may carry several option keys but still count as one voter in totals.
 */
export function applyVote(
  tally: DualTally,
  previous: VoteValue | null,
  next: VoteValue,
  voter: VoterSlices
): DualTally {
  const t: DualTally = {
    all: { ...tally.all },
    verified: { ...tally.verified },
    registered: { ...tally.registered },
    totalAll: tally.totalAll,
    totalVerified: tally.totalVerified,
    totalRegistered: tally.totalRegistered,
  };

  const slices: [Record<string, number>, boolean][] = [
    [t.all, true],
    [t.verified, voter.verified],
    [t.registered, voter.registeredVoter],
  ];

  for (const [counts, applies] of slices) {
    if (!applies) continue;
    if (previous !== null) for (const k of keysOf(previous)) bump(counts, k, -1);
    for (const k of keysOf(next)) bump(counts, k, +1);
  }

  if (previous === null) {
    t.totalAll += 1;
    if (voter.verified) t.totalVerified += 1;
    if (voter.registeredVoter) t.totalRegistered += 1;
  }

  return t;
}

/**
 * Remove a ballot from the tallies entirely — used before re-adding when a
 * voter changes their vote. Slices come from the stored ballot, not the
 * voter's current status, so later verification can't corrupt the decrement.
 */
export function removeBallot(
  tally: DualTally,
  value: VoteValue,
  slices: VoterSlices
): DualTally {
  const t: DualTally = {
    all: { ...tally.all },
    verified: { ...tally.verified },
    registered: { ...tally.registered },
    totalAll: Math.max(0, tally.totalAll - 1),
    totalVerified: slices.verified ? Math.max(0, tally.totalVerified - 1) : tally.totalVerified,
    totalRegistered: slices.registeredVoter
      ? Math.max(0, tally.totalRegistered - 1)
      : tally.totalRegistered,
  };
  const drop = (counts: Record<string, number>) => {
    for (const key of keysOf(value)) bump(counts, key, -1);
  };
  drop(t.all);
  if (slices.verified) drop(t.verified);
  if (slices.registeredVoter) drop(t.registered);
  return t;
}

export function tallyFor(tally: DualTally, lens: TallyLens): { counts: Record<string, number>; total: number } {
  switch (lens) {
    case 'all':
      return { counts: tally.all, total: tally.totalAll };
    case 'verified':
      return { counts: tally.verified, total: tally.totalVerified };
    case 'registered':
      return { counts: tally.registered, total: tally.totalRegistered };
  }
}

/** Weighted sum over a counts map, e.g. priority score for the big board. */
export function weightedScore(counts: Record<string, number>, weights: Record<string, number>): number {
  let score = 0;
  for (const [key, count] of Object.entries(counts)) {
    score += (weights[key] ?? 0) * count;
  }
  return score;
}
