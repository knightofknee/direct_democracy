import AsyncStorage from '@react-native-async-storage/async-storage';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { WARD_DISTRICTS, type Districts } from '@/constants/ward-districts';
import { useAuth } from '@/hooks/use-auth';
import { functions } from '@/lib/firebase';

export type DistrictType = keyof Districts;

export interface MyDistricts {
  /** True when the numbers come from an address: one district per type. */
  exact: boolean;
  /** With `exact`, the ward the address is in. */
  wardId: number | null;
  /** This person's district(s) of a type, or null when nothing is known. */
  of: <K extends DistrictType>(type: K) => Districts[K][] | null;
}

const UNKNOWN: MyDistricts = { exact: false, wardId: null, of: () => null };

/**
 * Store screenshots only (scripts/store-screenshots.ts): districts the
 * headless browser stands in with, so the ballot planner shows without
 * signing in to anyone's account. Read from `dev.shotDistricts` in local
 * storage, and only in a development build on the web, so no release
 * binary or published web build ever looks at it.
 */
const SHOT_DISTRICTS: Districts | null = (() => {
  if (!__DEV__ || Platform.OS !== 'web') return null;
  try {
    const raw = globalThis.localStorage?.getItem('dev.shotDistricts');
    return raw ? (JSON.parse(raw) as Districts) : null;
  } catch {
    return null;
  }
})();

/**
 * Which districts are this person's, for the elections tab (2026-09-29).
 * From an address (verified or typed on /my-districts): exactly one of each.
 * From a home ward alone: the districts where that ward's residents live,
 * often one, sometimes a few, since wards and districts don't line up.
 * Districts found in another ward than the current home ward are ignored
 * (the server drops them when the ward changes; this covers the moment
 * between).
 */
export function useMyDistricts(): MyDistricts {
  const { profile } = useAuth();
  const device = useDeviceDistricts();
  if (SHOT_DISTRICTS) return { exact: true, wardId: 42, of: (type) => [SHOT_DISTRICTS[type]] };
  if (!profile) {
    return device ? { exact: true, wardId: device.wardId, of: (type) => [device[type]] } : UNKNOWN;
  }
  const found = profile.districts;
  if (found && (profile.wardId == null || found.wardId === profile.wardId)) {
    return { exact: true, wardId: found.wardId, of: (type) => [found[type]] };
  }
  const ward = profile.wardId != null ? WARD_DISTRICTS[profile.wardId] : undefined;
  if (!ward) return UNKNOWN;
  return { exact: false, wardId: null, of: (type) => ward[type] as Districts[typeof type][] };
}

// ---------------------------------------------------------------------------
// Signed out: the districts an address lookup found, kept on this phone only
// (2026-11-09, the police district finder). The server stores nothing for a
// signed-out lookup; signing in switches to the account's own districts.

type Found = Districts & { wardId: number };

const DEVICE_KEY = 'districts.device';
let deviceDistricts: Found | null = null;
let deviceLoaded = false;
const deviceListeners = new Set<() => void>();

function setDevice(next: Found | null): void {
  deviceDistricts = next;
  for (const l of deviceListeners) l();
}

function loadDevice(): void {
  if (deviceLoaded) return;
  deviceLoaded = true;
  AsyncStorage.getItem(DEVICE_KEY)
    .then((raw) => {
      if (raw) setDevice(JSON.parse(raw) as Found);
    })
    .catch(() => {});
}

function useDeviceDistricts(): Found | null {
  useEffect(loadDevice, []);
  return useSyncExternalStore(
    (l) => {
      deviceListeners.add(l);
      return () => deviceListeners.delete(l);
    },
    () => deviceDistricts,
    () => deviceDistricts
  );
}

/** Keep (or with null, forget) a signed-out lookup's districts on this phone. */
export function rememberDeviceDistricts(found: Found | null): void {
  setDevice(found);
  if (found) AsyncStorage.setItem(DEVICE_KEY, JSON.stringify(found)).catch(() => {});
  else AsyncStorage.removeItem(DEVICE_KEY).catch(() => {});
}

export type FindDistrictsResult =
  | { result: 'ok'; wardId: number; districts: Districts }
  | { result: 'notFound' }
  | { result: 'outside' }
  | { result: 'otherWard'; wardId: number; verified: boolean };

/**
 * Look up a typed home address (findMyDistricts in functions). Signed in,
 * the server keeps the district numbers on the account; signed out, it
 * keeps nothing and the caller remembers them on the phone.
 */
export async function findMyDistricts(address: string): Promise<FindDistrictsResult> {
  const call = httpsCallable<{ address: string }, FindDistrictsResult>(functions, 'findMyDistricts');
  return (await call({ address })).data;
}
