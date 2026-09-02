import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserStats } from '@/lib/types';

/**
 * Participation milestones. Stats are counted server-side (Cloud Functions
 * triggers on the user's own posts/ballots); the app celebrates each
 * threshold exactly once per account per device.
 */

export interface Milestone {
  key: string;
  title: string;
  message: string;
}

interface MilestoneTrack {
  stat: keyof UserStats;
  thresholds: number[];
  title: (n: number) => string;
  message: (n: number) => string;
}

const TRACKS: MilestoneTrack[] = [
  {
    stat: 'concerns',
    thresholds: [1, 10, 50],
    title: (n) =>
      n === 1 ? 'First concern raised!' : `${n} concerns raised!`,
    message: (n) =>
      n === 1
        ? 'Your voice is officially on the board. This is how change starts.'
        : 'You keep putting real issues in front of the city. Keep them coming.',
  },
  {
    stat: 'votes',
    thresholds: [1, 10, 100, 500],
    title: (n) => (n === 1 ? 'First vote cast!' : `${n} votes cast!`),
    message: (n) =>
      n === 1
        ? 'Every tally in this app is made of moments like that one.'
        : n >= 100
          ? 'That is a serious voting record. Chicago hears you.'
          : 'Your priorities are shaping the board.',
  },
  {
    stat: 'judgments',
    thresholds: [1, 25, 100],
    title: (n) => (n === 1 ? 'First answer judged!' : `${n} answers judged!`),
    message: () =>
      'Holding officials to straight answers is the whole point. Thank you.',
  },
];

function statValue(stats: UserStats, stat: MilestoneTrack['stat']): number {
  return stats[stat] ?? 0;
}

/** Every milestone key at-or-below the current stats. */
function reachedKeys(stats: UserStats): Set<string> {
  const keys = new Set<string>();
  for (const track of TRACKS) {
    const value = statValue(stats, track.stat);
    for (const t of track.thresholds) {
      if (value >= t) keys.add(`${track.stat}:${t}`);
    }
  }
  return keys;
}

const storageKey = (uid: string) => `dd:celebrated:${uid}`;

/**
 * Diff current stats against what this device has already celebrated.
 * Returns the single best new milestone (highest threshold wins so a burst
 * doesn't queue five popups), after marking everything reached as seen.
 * First call for an account initializes silently - existing users don't get
 * a replay of their whole history.
 */
/**
 * Celebrate at the moment of the action instead of waiting for the Cloud
 * Functions round trip (a cold start can add many seconds). The caller says
 * which stat just went up; if that lands exactly on a threshold this marks
 * the key seen and returns the milestone immediately. The server-driven
 * watcher then finds the key already celebrated and stays quiet - and if the
 * server got there first, the anticipated value overshoots the threshold and
 * this returns null, so there is never a duplicate.
 */
export async function takeAnticipatedMilestone(
  uid: string,
  stats: UserStats,
  stat: MilestoneTrack['stat']
): Promise<Milestone | null> {
  const track = TRACKS.find((t) => t.stat === stat);
  if (!track) return null;
  const value = statValue(stats, stat) + 1;
  if (!track.thresholds.includes(value)) return null;

  const key = `${stat}:${value}`;
  const raw = await AsyncStorage.getItem(storageKey(uid));
  const seen: string[] = raw ? JSON.parse(raw) : [...reachedKeys(stats)];
  if (seen.includes(key)) return null;

  await AsyncStorage.setItem(storageKey(uid), JSON.stringify([...seen, key]));
  return { key, title: track.title(value), message: track.message(value) };
}

export async function takeNewMilestone(
  uid: string,
  stats: UserStats
): Promise<Milestone | null> {
  const reached = reachedKeys(stats);
  const raw = await AsyncStorage.getItem(storageKey(uid));
  const seen: string[] | null = raw ? JSON.parse(raw) : null;

  // Union, never replace: replacing would drop keys the server stats do not
  // (yet) support - an anticipated milestone whose trigger is still in
  // flight, or a threshold crossed then un-crossed by a retraction - and a
  // dropped key means the same celebration fires again later.
  await AsyncStorage.setItem(storageKey(uid), JSON.stringify([...new Set([...(seen ?? []), ...reached])]));

  if (seen === null) return null; // first sighting of this account on this device

  const fresh = [...reached].filter((k) => !seen.includes(k));
  if (fresh.length === 0) return null;

  let best: { track: MilestoneTrack; threshold: number } | null = null;
  for (const key of fresh) {
    const [stat, thresholdStr] = key.split(':');
    const track = TRACKS.find((t) => t.stat === stat);
    const threshold = Number(thresholdStr);
    if (!track) continue;
    if (!best || threshold > best.threshold) best = { track, threshold };
  }
  if (!best) return null;

  return {
    key: `${best.track.stat}:${best.threshold}`,
    title: best.track.title(best.threshold),
    message: best.track.message(best.threshold),
  };
}
