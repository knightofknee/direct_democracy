import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc } from 'firebase/firestore';
import { useEffect, useSyncExternalStore } from 'react';

import { useLiveDoc } from '@/hooks/use-firestore';
import { db } from '@/lib/firebase';
import { inTheRace, type MayorCandidate, type MayorGamesDoc, type MayorTriviaItem } from '@/lib/mayor-games-data';

export * from '@/lib/mayor-games-data';

/**
 * The app's side of the mayor games: the live document and what the phone
 * remembers from blind dates (who it has met this round, and which ones it
 * said it would see again). The data model and every ordering rule are in
 * mayor-games-data.ts.
 */

/** The whole field, live. */
export function useMayorGames(): { data: MayorGamesDoc | null; loading: boolean } {
  return useLiveDoc<MayorGamesDoc>(() => doc(db, 'mayorGames', '2027'), []);
}

// ---------------------------------------------------------------------------
// Blind date memory. On this phone only (AsyncStorage), never sent anywhere:
// `seen` is the round so far, `verdicts` is how each date went ("yes" is a
// second date). One store for every screen, so the tab's "second dates"
// strip moves the moment a date ends.

export type BlindVerdict = 'yes' | 'no';

export interface BlindMemory {
  /** False until storage has been read. */
  ready: boolean;
  seen: string[];
  verdicts: Record<string, BlindVerdict>;
}

const SEEN_KEY = 'mayorGames.blind.seen';
const VERDICTS_KEY = 'mayorGames.blind.verdicts';

let memory: BlindMemory = { ready: false, seen: [], verdicts: {} };
let loadStarted = false;
const listeners = new Set<() => void>();

function commit(next: BlindMemory): void {
  memory = next;
  for (const l of listeners) l();
}

function load(): void {
  if (loadStarted) return;
  loadStarted = true;
  AsyncStorage.multiGet([SEEN_KEY, VERDICTS_KEY])
    .then(([[, rawSeen], [, rawVerdicts]]) => {
      const seen = rawSeen ? (JSON.parse(rawSeen) as unknown) : [];
      const verdicts = rawVerdicts ? (JSON.parse(rawVerdicts) as unknown) : {};
      commit({
        ready: true,
        seen: Array.isArray(seen) ? seen.filter((s): s is string => typeof s === 'string') : [],
        verdicts:
          verdicts && typeof verdicts === 'object' && !Array.isArray(verdicts)
            ? (verdicts as Record<string, BlindVerdict>)
            : {},
      });
    })
    .catch(() => commit({ ...memory, ready: true }));
}

function persist(): void {
  AsyncStorage.multiSet([
    [SEEN_KEY, JSON.stringify(memory.seen)],
    [VERDICTS_KEY, JSON.stringify(memory.verdicts)],
  ]).catch(() => {});
}

export function useBlindMemory(): BlindMemory {
  useEffect(load, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => memory,
    () => memory
  );
}

/** A date ended: the candidate is met, with a verdict when one was given. */
export function endBlindDate(slug: string, verdict: BlindVerdict | null): void {
  const verdicts = { ...memory.verdicts };
  if (verdict) verdicts[slug] = verdict;
  commit({
    ...memory,
    seen: memory.seen.includes(slug) ? memory.seen : [...memory.seen, slug],
    verdicts,
  });
  persist();
}

/** Change of heart after the reveal (null takes the verdict back). */
export function setBlindVerdict(slug: string, verdict: BlindVerdict | null): void {
  const verdicts = { ...memory.verdicts };
  if (verdict) verdicts[slug] = verdict;
  else delete verdicts[slug];
  commit({ ...memory, verdicts });
  persist();
}

/** Everyone is up again; the second dates stay. */
export function startBlindRound(): void {
  commit({ ...memory, seen: [] });
  persist();
}

/**
 * The next blind date: a random candidate not met this round and not the
 * one on screen. Null when the round is over.
 */
export function pickBlindDate(
  candidates: MayorCandidate[],
  seen: string[],
  current: string | null
): string | null {
  const unseen = inTheRace(candidates).filter((c) => !seen.includes(c.slug) && c.slug !== current);
  if (unseen.length === 0) return null;
  return unseen[Math.floor(Math.random() * unseen.length)].slug;
}

/** The candidates this phone would see again, in the order it said so. */
export function secondDates(candidates: MayorCandidate[], verdicts: Record<string, BlindVerdict>): MayorCandidate[] {
  const field = inTheRace(candidates);
  return Object.keys(verdicts)
    .filter((slug) => verdicts[slug] === 'yes')
    .map((slug) => field.find((c) => c.slug === slug))
    .filter((c): c is MayorCandidate => c != null);
}

// ---------------------------------------------------------------------------
// Pick-up lines: the best streak this phone has seen. A number, nothing else.

const BEST_STREAK_KEY = 'mayorGames.lines.best';

export async function loadBestStreak(): Promise<number> {
  try {
    const n = Number(await AsyncStorage.getItem(BEST_STREAK_KEY));
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveBestStreak(n: number): void {
  AsyncStorage.setItem(BEST_STREAK_KEY, String(n)).catch(() => {});
}

// ---------------------------------------------------------------------------
// Former mayor trivia: which facts this phone has shown, so a shuffle never
// repeats one until every fact has had its turn.

const TRIVIA_SEEN_KEY = 'mayorGames.trivia.seen';

export async function loadTriviaSeen(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(TRIVIA_SEEN_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveTriviaSeen(seen: string[]): void {
  AsyncStorage.setItem(TRIVIA_SEEN_KEY, JSON.stringify(seen)).catch(() => {});
}

/**
 * The next fact: a random one not shown yet and not the one on screen.
 * When every fact has been shown the round starts over. Returns the id and
 * the seen list to keep, or null for an empty list.
 */
export function pickTrivia(
  items: MayorTriviaItem[],
  seen: string[],
  current: string | null
): { id: string; seen: string[] } | null {
  if (items.length === 0) return null;
  let kept = seen.filter((id) => items.some((x) => x.id === id));
  let fresh = items.filter((x) => !kept.includes(x.id) && x.id !== current);
  if (fresh.length === 0) {
    kept = current ? [current] : [];
    fresh = items.filter((x) => x.id !== current);
    if (fresh.length === 0) fresh = items;
  }
  const pick = fresh[Math.floor(Math.random() * fresh.length)];
  return { id: pick.id, seen: [...kept.filter((id) => id !== pick.id), pick.id] };
}

