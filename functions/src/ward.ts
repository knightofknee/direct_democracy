/**
 * Address-to-ward lookup for identity verification. Verified means "adult
 * Chicago resident of a ward", so the Didit webhook only grants it with a
 * ward: the address Didit read off the ID (or the proof-of-address document,
 * when the workflow has one) is geocoded and matched against the city's ward
 * boundaries. The address is used once, here, and never stored.
 *
 * Boundaries: functions/data/ward-boundaries.json, full resolution, written
 * by `npm run build-ward-map` alongside the app's map.
 * Geocoder: the US Census Bureau's public geocoder (free, no key). Didit's
 * own geocoded point is the fallback when Census can't match the address.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

type Ring = number[][];
interface WardBoundary {
  ward: number;
  /** Each polygon is an outer ring followed by any holes, [lon, lat]. */
  polygons: Ring[][];
}

let boundaries: WardBoundary[] | null = null;

function wardBoundaries(): WardBoundary[] {
  if (!boundaries) {
    const file = join(__dirname, '..', 'data', 'ward-boundaries.json');
    boundaries = (JSON.parse(readFileSync(file, 'utf8')) as { wards: WardBoundary[] }).wards;
  }
  return boundaries;
}

/** Ray casting: is (lon, lat) inside the ring? */
function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** The Chicago ward containing the point, or null outside the city. */
export function wardForPoint(lon: number, lat: number): number | null {
  for (const w of wardBoundaries()) {
    for (const [outer, ...holes] of w.polygons) {
      if (inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h))) return w.ward;
    }
  }
  return null;
}

/** An address as Didit reports it (ID or proof-of-address document). */
export interface DiditAddress {
  /** Raw OCR line. */
  raw?: string | null;
  formatted?: string | null;
  parsed?: {
    street_1?: string | null;
    city?: string | null;
    region?: string | null;
    postal_code?: string | null;
    document_location?: { latitude?: number | null; longitude?: number | null } | null;
  } | null;
}

interface Point {
  lon: number;
  lat: number;
}

const CENSUS = 'https://geocoding.geo.census.gov/geocoder/locations';

/**
 * One Census geocoder request. Returns the first match, null when the
 * address doesn't match anything, and throws when the service itself fails
 * (so the webhook answers 500 and Didit retries, instead of refusing a
 * resident because a government server hiccuped).
 */
async function census(path: string, params: Record<string, string>): Promise<Point | null> {
  const qs = new URLSearchParams({ ...params, benchmark: 'Public_AR_Current', format: 'json' });
  const resp = await fetch(`${CENSUS}/${path}?${qs}`, { signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) throw new Error(`Census geocoder ${resp.status}`);
  const body = (await resp.json()) as {
    result?: { addressMatches?: { coordinates?: { x?: number; y?: number } }[] };
  };
  const c = body.result?.addressMatches?.[0]?.coordinates;
  return c && typeof c.x === 'number' && typeof c.y === 'number' ? { lon: c.x, lat: c.y } : null;
}

/** Locate one Didit address: structured Census, then one-line, then Didit's point. */
async function locate(a: DiditAddress): Promise<Point | null> {
  const p = a.parsed ?? {};
  const state = (p.region ?? '').replace(/^US-/i, '');
  if (p.street_1 && (p.postal_code || (p.city && state))) {
    const hit = await census('address', {
      street: p.street_1,
      city: p.city ?? '',
      state,
      zip: (p.postal_code ?? '').slice(0, 5),
    });
    if (hit) return hit;
  }
  for (const line of [a.formatted, a.raw]) {
    if (line && line.trim()) {
      const hit = await census('onelineaddress', { address: line.replace(/\s+/g, ' ').trim() });
      if (hit) return hit;
    }
  }
  // Didit geocodes the address too. Only trusted when a street was parsed,
  // so a city-level guess can't drop someone into a ward at random.
  const loc = p.document_location;
  if (p.street_1 && typeof loc?.latitude === 'number' && typeof loc?.longitude === 'number') {
    return { lon: loc.longitude, lat: loc.latitude };
  }
  return null;
}

export type WardResult =
  | { kind: 'ward'; wardId: number }
  /** The address was found, and it isn't in Chicago. */
  | { kind: 'outside' }
  /** No address could be read or located. */
  | { kind: 'unknown' };

/**
 * Resolve a verification's ward from its addresses, most current first
 * (proof of address before the ID). The first address inside a ward wins.
 */
export async function resolveWard(addresses: DiditAddress[]): Promise<WardResult> {
  let located = false;
  for (const a of addresses) {
    const point = await locate(a);
    if (!point) continue;
    located = true;
    const wardId = wardForPoint(point.lon, point.lat);
    if (wardId != null) return { kind: 'ward', wardId };
  }
  return located ? { kind: 'outside' } : { kind: 'unknown' };
}

/** Pull the addresses out of a Didit decision, proof of address first. */
export function decisionAddresses(decision: unknown): DiditAddress[] {
  const d = (decision ?? {}) as {
    poa_verifications?: Record<string, unknown>[];
    id_verifications?: Record<string, unknown>[];
  };
  const out: DiditAddress[] = [];
  for (const poa of d.poa_verifications ?? []) {
    out.push({
      raw: poa.poa_address as string | null,
      formatted: poa.poa_formatted_address as string | null,
      parsed: poa.poa_parsed_address as DiditAddress['parsed'],
    });
  }
  for (const idv of d.id_verifications ?? []) {
    out.push({
      raw: idv.address as string | null,
      formatted: idv.formatted_address as string | null,
      parsed: idv.parsed_address as DiditAddress['parsed'],
    });
  }
  return out.filter((a) => a.raw || a.formatted || a.parsed);
}

/** "44th Ward", for server-written English copy (the app has its own). */
export function wardLabelEn(ward: number): string {
  const mod100 = ward % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[ward % 10] ?? 'th';
  return `${ward}${suffix} Ward`;
}
