import AsyncStorage from '@react-native-async-storage/async-storage';

import { tr } from '@/lib/i18n';
import type { UserStats } from '@/lib/types';

/**
 * Participation milestones. Stats are counted server-side (Cloud Functions
 * triggers on the user's own posts/ballots); the app celebrates each
 * threshold exactly once per account per device.
 */

export interface Milestone {
  key: string;
  /** The whole celebration: a short title, no commentary under it. */
  title: string;
}

interface MilestoneTrack {
  stat: keyof UserStats;
  thresholds: number[];
  title: (n: number) => string;
}

const TRACKS: MilestoneTrack[] = [
  {
    stat: 'concerns',
    thresholds: [1, 10, 50],
    title: (n) =>
      n === 1 ? tr('First concern raised!') : tr('{n} concerns raised!').replace('{n}', String(n)),
  },
  {
    stat: 'votes',
    thresholds: [1, 10, 100, 500],
    title: (n) => (n === 1 ? tr('First vote cast!') : tr('{n} votes cast!').replace('{n}', String(n))),
  },
  {
    stat: 'judgments',
    thresholds: [1, 25, 100],
    title: (n) => (n === 1 ? tr('First answer judged!') : tr('{n} answers judged!').replace('{n}', String(n))),
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
  return { key, title: track.title(value) };
}

/**
 * Record every milestone the server-counted stats have reached, without
 * celebrating any of them. A celebration is a reaction to something the
 * person just did on this device (takeAnticipatedMilestone, at the tap);
 * stats that arrive later, from another device or a sign-in, only mark what
 * is already behind them, so nothing fires out of the blue.
 */
export async function markReachedMilestones(uid: string, stats: UserStats): Promise<void> {
  const raw = await AsyncStorage.getItem(storageKey(uid));
  const seen: string[] = raw ? JSON.parse(raw) : [];
  // Union, never replace: an anticipated key whose trigger is still in
  // flight must stay marked, or it would fire again later.
  await AsyncStorage.setItem(
    storageKey(uid),
    JSON.stringify([...new Set([...seen, ...reachedKeys(stats)])])
  );
}
