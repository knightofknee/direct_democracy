import type { DualTally, TallyLens } from '@/lib/types';

/**
 * Read-side tally helpers. All tally *writes* happen server-side in
 * functions/src/tally.ts - clients only ever write their own ballot docs.
 */

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
