import { httpsCallable } from 'firebase/functions';

import { WARD_DISTRICTS, type Districts } from '@/constants/ward-districts';
import { useAuth } from '@/hooks/use-auth';
import { functions } from '@/lib/firebase';

export type DistrictType = keyof Districts;

export interface MyDistricts {
  /** True when the numbers come from an address: one district per type. */
  exact: boolean;
  /** This person's district(s) of a type, or null when nothing is known. */
  of: <K extends DistrictType>(type: K) => Districts[K][] | null;
}

const UNKNOWN: MyDistricts = { exact: false, of: () => null };

/**
 * Which districts are this person's, for the election tab (2026-09-29).
 * From an address (verified or typed on /my-districts): exactly one of each.
 * From a home ward alone: the districts where that ward's residents live,
 * often one, sometimes a few, since wards and districts don't line up.
 * Districts found in another ward than the current home ward are ignored
 * (the server drops them when the ward changes; this covers the moment
 * between).
 */
export function useMyDistricts(): MyDistricts {
  const { profile } = useAuth();
  if (!profile) return UNKNOWN;
  const found = profile.districts;
  if (found && (profile.wardId == null || found.wardId === profile.wardId)) {
    return { exact: true, of: (type) => [found[type]] };
  }
  const ward = profile.wardId != null ? WARD_DISTRICTS[profile.wardId] : undefined;
  if (!ward) return UNKNOWN;
  return { exact: false, of: (type) => ward[type] as Districts[typeof type][] };
}

export type FindDistrictsResult =
  | { result: 'ok'; wardId: number; districts: Districts }
  | { result: 'notFound' }
  | { result: 'outside' }
  | { result: 'otherWard'; wardId: number; verified: boolean };

/** Look up a typed home address (findMyDistricts in functions). */
export async function findMyDistricts(address: string): Promise<FindDistrictsResult> {
  const call = httpsCallable<{ address: string }, FindDistrictsResult>(functions, 'findMyDistricts');
  return (await call({ address })).data;
}
