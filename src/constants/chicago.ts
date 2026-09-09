import { getLocale } from '@/lib/i18n';

/**
 * Chicago-only for launch, and we lean into it: the city, its 50 wards, and
 * its aldermen are first-class concepts. When the app opens to other cities,
 * this file becomes a per-city config loaded from Firestore instead.
 */

export const CITY = {
  id: 'chicago',
  name: 'Chicago',
  nickname: 'The City That Works',
  wardCount: 50,
} as const;

export interface Ward {
  id: number;
  /** Rough neighborhood shorthand so a ward number means something at a glance. */
  areas: string;
}

/**
 * Neighborhood labels are approximate - ward boundaries slice through
 * neighborhoods and shift with remaps. Good enough for display; never used
 * for eligibility (ward assignment comes from verified address).
 */
export const WARDS: Ward[] = [
  { id: 1, areas: 'Wicker Park, Ukrainian Village' },
  { id: 2, areas: 'Lincoln Park, Old Town' },
  { id: 3, areas: 'Bronzeville, South Loop' },
  { id: 4, areas: 'Kenwood, Oakland' },
  { id: 5, areas: 'Hyde Park, South Shore' },
  { id: 6, areas: 'Chatham, Park Manor' },
  { id: 7, areas: 'South Shore, South Chicago' },
  { id: 8, areas: 'Avalon Park, Calumet Heights' },
  { id: 9, areas: 'Roseland, Pullman' },
  { id: 10, areas: 'East Side, Hegewisch' },
  { id: 11, areas: 'Bridgeport, Chinatown' },
  { id: 12, areas: 'McKinley Park, Brighton Park' },
  { id: 13, areas: 'Clearing, West Lawn' },
  { id: 14, areas: 'Gage Park, Archer Heights' },
  { id: 15, areas: 'Back of the Yards, West Englewood' },
  { id: 16, areas: 'Englewood, Chicago Lawn' },
  { id: 17, areas: 'Auburn Gresham, Marquette Park' },
  { id: 18, areas: 'Ashburn, Wrightwood' },
  { id: 19, areas: 'Beverly, Mount Greenwood' },
  { id: 20, areas: 'Woodlawn, Washington Park' },
  { id: 21, areas: 'Auburn Gresham, Morgan Park' },
  { id: 22, areas: 'Little Village' },
  { id: 23, areas: 'Garfield Ridge, Midway' },
  { id: 24, areas: 'North Lawndale' },
  { id: 25, areas: 'Pilsen, Chinatown' },
  { id: 26, areas: 'Humboldt Park' },
  { id: 27, areas: 'West Town, Near West Side' },
  { id: 28, areas: 'East Garfield Park, Austin' },
  { id: 29, areas: 'Austin, Galewood' },
  { id: 30, areas: 'Belmont Cragin, Portage Park' },
  { id: 31, areas: 'Hermosa, Belmont Cragin' },
  { id: 32, areas: 'Bucktown, Roscoe Village' },
  { id: 33, areas: 'Albany Park, Irving Park' },
  { id: 34, areas: 'The Loop, West Loop' },
  { id: 35, areas: 'Logan Square, Avondale' },
  { id: 36, areas: 'Montclare, Belmont Cragin' },
  { id: 37, areas: 'West Humboldt Park, Austin' },
  { id: 38, areas: 'Portage Park, Dunning' },
  { id: 39, areas: 'North Park, Sauganash' },
  { id: 40, areas: 'Andersonville, Lincoln Square' },
  { id: 41, areas: 'Edison Park, Norwood Park, O’Hare' },
  { id: 42, areas: 'The Loop, River North' },
  { id: 43, areas: 'Lincoln Park' },
  { id: 44, areas: 'Lakeview, Wrigleyville' },
  { id: 45, areas: 'Jefferson Park, Portage Park' },
  { id: 46, areas: 'Uptown, Buena Park' },
  { id: 47, areas: 'North Center, Lincoln Square' },
  { id: 48, areas: 'Edgewater, Andersonville' },
  { id: 49, areas: 'Rogers Park' },
  { id: 50, areas: 'West Ridge' },
];

export function wardById(id: number | null | undefined): Ward | null {
  if (id == null) return null;
  return WARDS.find((w) => w.id === id) ?? null;
}

export function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

/**
 * Ward 51 does not exist in Chicago - it is the hidden test ward. It never
 * appears in the ward picker or public lists; only accounts whose wardId is
 * set to 51 by the operator (verify-user/set-official scripts) ever see it,
 * which keeps test officials, polls, and concerns out of the real 50 wards.
 * It labels as "51st Ward" like any other so operator screenshots read
 * naturally; anyone who knows Chicago knows there is no ward 51.
 */
export const TEST_WARD = 51;

export function wardLabel(id: number | null | undefined): string {
  if (id == null) return getLocale() === 'es' ? 'Toda la ciudad' : 'Citywide';
  return getLocale() === 'es' ? `Distrito ${id}` : `${ordinal(id)} Ward`;
}
