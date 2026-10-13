import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { GENERAL_ELECTION } from '@/constants/elections';

/**
 * The ballot planner (2026-10-09): a person's own picks for the November 3
 * ballot, so they can walk into the booth (or fill in a mail ballot) with
 * their choices made. Kept ON THIS DEVICE ONLY (AsyncStorage, localStorage
 * on the web): never sent to the server, never tied to the account, and
 * nobody, the app included, can see them. Sharing the list is the person's
 * own act (My ballot's share button).
 *
 * A contest is one choice on the ballot: a race id ('governor', 'us-house-7',
 * a school board seat as 'sb-4b'), or one vacancy in a judicial race
 * (`${race}#${seat}`). Judges up for retention are each a yes-or-no, and so
 * is the advisory question.
 */
export interface BallotPicks {
  /** Contest -> the candidate ids picked (one, except MWRD's three seats). */
  picks: Record<string, string[]>;
  /** Retention: judge's candidate id -> yes or no. */
  retain: Record<string, 'yes' | 'no'>;
  /** The advisory question. */
  question: 'yes' | 'no' | null;
}

const KEY = `ballot.v1.${GENERAL_ELECTION}`;
const EMPTY: BallotPicks = { picks: {}, retain: {}, question: null };

let state: BallotPicks = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function emit(next: BallotPicks) {
  state = next;
  for (const l of listeners) l();
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<BallotPicks>;
      state = { picks: parsed.picks ?? {}, retain: parsed.retain ?? {}, question: parsed.question ?? null };
      for (const l of listeners) l();
    })
    .catch(() => {});
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** How many candidates a contest takes: MWRD's six-year seats are a vote for three. */
export function maxPicks(contest: string): number {
  return contest === 'mwrd' ? 3 : 1;
}

/** The contest a candidate's pick belongs to (judicial vacancies are one contest each). */
export function contestOf(race: string, seat?: string | null): string {
  return seat ? `${race}#${seat}` : race;
}

export function useBallot() {
  const picks = useSyncExternalStore(subscribe, () => state, () => state);
  return {
    ...picks,
    /** Tap a candidate: picks them, or takes the pick back. Single-choice contests swap. */
    toggle(contest: string, id: string): 'picked' | 'unpicked' | 'full' {
      const current = state.picks[contest] ?? [];
      if (current.includes(id)) {
        const rest = current.filter((c) => c !== id);
        const nextPicks = { ...state.picks };
        if (rest.length) nextPicks[contest] = rest;
        else delete nextPicks[contest];
        emit({ ...state, picks: nextPicks });
        return 'unpicked';
      }
      const max = maxPicks(contest);
      if (max > 1 && current.length >= max) return 'full';
      emit({ ...state, picks: { ...state.picks, [contest]: max === 1 ? [id] : [...current, id] } });
      return 'picked';
    },
    /** Yes or no on a judge; tapping the same answer again clears it. */
    setRetain(id: string, answer: 'yes' | 'no') {
      const retain = { ...state.retain };
      if (retain[id] === answer) delete retain[id];
      else retain[id] = answer;
      emit({ ...state, retain });
    },
    setQuestion(answer: 'yes' | 'no') {
      emit({ ...state, question: state.question === answer ? null : answer });
    },
    clear() {
      emit(EMPTY);
    },
  };
}
