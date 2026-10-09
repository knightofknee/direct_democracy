/**
 * Which wards each Chicago neighborhood's residents live in, so a news story
 * that names a neighborhood can be listed on those wards' pages (syncNews in
 * functions/src/news.ts). Re-run after the ward map changes.
 *
 * Sources, all public:
 * - Neighborhoods: data.cityofchicago.org y6yq-dbs2 (the city's 98
 *   neighborhoods, the names newsrooms actually use: Wicker Park, Pilsen's
 *   Lower West Side, Bronzeville's Grand Boulevard).
 * - Populated 2020 census blocks (interior points): Census TIGERweb, the
 *   same layer build-district-map reads.
 * - Wards: functions/data/ward-boundaries.json (build-ward-map).
 *
 * A neighborhood lists a ward when at least SHARE of its residents live in
 * that ward, so a sliver across a ward line never tags the whole story
 * there. Parks and other places nobody lives in (Grant Park, Millennium
 * Park) list the ward most of their land is in.
 *
 * Output: functions/data/neighborhood-wards.json, { name: wards[] }, with the
 * aliases below folded in. Names that would mislabel stories are left out
 * on purpose (DROPPED).
 *
 *   npm run build-neighborhood-wards
 */
import { writeFileSync } from 'fs';

import { wardForPoint } from '../functions/src/ward';

const OUT = 'functions/data/neighborhood-wards.json';
const NEIGHBORHOODS = 'https://data.cityofchicago.org/resource/y6yq-dbs2.json?$limit=200';
const BLOCKS =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/10/query' +
  '?where=STATE%3D%2717%27+AND+COUNTY%3D%27031%27+AND+POP100%3E0' +
  '&outFields=INTPTLON,INTPTLAT,POP100&returnGeometry=false&orderByFields=OID&f=json';
const EXPECTED_NEIGHBORHOODS = 98;
/** A ward is listed when it holds at least this share of the neighborhood's residents. */
const SHARE = 0.15;

/** The dataset's spelling, fixed to the one newsrooms print. */
const RENAMED: Record<string, string> = {
  'Mckinley Park': 'McKinley Park',
  'Millenium Park': 'Millennium Park',
  'Little Italy, UIC': 'Little Italy',
  Loop: 'the Loop',
};

/** Names stories use for (parts of) a dataset neighborhood. */
const ALIASES: Record<string, string[]> = {
  Bronzeville: ['Grand Boulevard', 'Douglas'],
  Pilsen: ['Lower West Side'],
  'Back of the Yards': ['New City'],
  Lakeview: ['Lake View'],
  Sauganash: ['Sauganash,Forest Glen'],
  'Forest Glen': ['Sauganash,Forest Glen'],
  'South Lawndale': ['Little Village'],
  'South Loop': ['Near South Side', 'Printers Row'],
  Ravenswood: ['Lincoln Square', 'North Center'],
  'West Rogers Park': ['West Ridge'],
};

/**
 * Left out: a sports venue and an airport (stories about the game or a
 * flight, not the ward), compound names no story prints, and plain words or
 * other places' names that would mislabel stories (Douglas the name,
 * Oakland the city, Clearing and East Side the words).
 */
const DROPPED = new Set([
  'United Center',
  "O'Hare",
  'Rush & Division',
  'Sheffield & DePaul',
  'Sauganash,Forest Glen',
  'Douglas',
  'Oakland',
  'Clearing',
  'East Side',
]);

type Ring = number[][];
type Polygon = Ring[];

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygons(lon: number, lat: number, polygons: Polygon[]): boolean {
  return polygons.some(([outer, ...holes]) => inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h)));
}

async function getJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!resp.ok) throw new Error(`${resp.status} from ${url}`);
  return (await resp.json()) as T;
}

async function populatedBlocks(): Promise<{ lon: number; lat: number; pop: number }[]> {
  const out: { lon: number; lat: number; pop: number }[] = [];
  const page = 20_000;
  for (let offset = 0; ; offset += page) {
    const body = await getJson<{
      features?: { attributes: { INTPTLON: string; INTPTLAT: string; POP100: number } }[];
    }>(`${BLOCKS}&resultOffset=${offset}&resultRecordCount=${page}`);
    if (!body.features) throw new Error('No census blocks came back.');
    for (const { attributes: a } of body.features) {
      out.push({ lon: Number(a.INTPTLON), lat: Number(a.INTPTLAT), pop: a.POP100 });
    }
    if (body.features.length < page) break;
  }
  return out;
}

/** The ward most of a place's land is in, from a grid of points inside it. */
function wardByLand(polygons: Polygon[]): number | null {
  const xs = polygons.flatMap((p) => p[0].map((c) => c[0]));
  const ys = polygons.flatMap((p) => p[0].map((c) => c[1]));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const counts = new Map<number, number>();
  for (let i = 0; i <= 30; i++) {
    for (let j = 0; j <= 30; j++) {
      const lon = x0 + ((x1 - x0) * i) / 30;
      const lat = y0 + ((y1 - y0) * j) / 30;
      if (!inPolygons(lon, lat, polygons)) continue;
      const ward = wardForPoint(lon, lat);
      if (ward != null) counts.set(ward, (counts.get(ward) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

async function main() {
  const rows = await getJson<{ pri_neigh: string; the_geom: { type: string; coordinates: unknown } }[]>(NEIGHBORHOODS);
  if (rows.length !== EXPECTED_NEIGHBORHOODS) {
    throw new Error(`Expected ${EXPECTED_NEIGHBORHOODS} neighborhoods, got ${rows.length}: the map changed, check the lists above.`);
  }
  const shapes = rows.map((r) => ({
    name: r.pri_neigh.trim(),
    polygons:
      r.the_geom.type === 'MultiPolygon'
        ? (r.the_geom.coordinates as Polygon[])
        : [r.the_geom.coordinates as Polygon],
  }));
  for (const name of [...Object.keys(RENAMED), ...DROPPED, ...Object.values(ALIASES).flat()]) {
    if (!shapes.some((s) => s.name === name)) throw new Error(`No neighborhood named "${name}" in the dataset.`);
  }

  console.log('Reading populated census blocks...');
  const blocks = await populatedBlocks();
  const people = new Map<string, Map<number, number>>();
  for (const b of blocks) {
    const shape = shapes.find((s) => inPolygons(b.lon, b.lat, s.polygons));
    if (!shape) continue;
    const ward = wardForPoint(b.lon, b.lat);
    if (ward == null) continue;
    const byWard = people.get(shape.name) ?? new Map<number, number>();
    byWard.set(ward, (byWard.get(ward) ?? 0) + b.pop);
    people.set(shape.name, byWard);
  }

  const wardsOf = new Map<string, number[]>();
  for (const s of shapes) {
    const byWard = people.get(s.name);
    const total = byWard ? [...byWard.values()].reduce((a, b) => a + b, 0) : 0;
    let wards: number[];
    if (total > 0) {
      wards = [...byWard!].filter(([, n]) => n / total >= SHARE).map(([w]) => w);
    } else {
      const ward = wardByLand(s.polygons);
      wards = ward == null ? [] : [ward];
    }
    if (wards.length === 0) throw new Error(`No ward found for ${s.name}.`);
    wardsOf.set(s.name, wards.sort((a, b) => a - b));
  }

  const out: Record<string, number[]> = {};
  for (const [name, wards] of wardsOf) {
    if (DROPPED.has(name)) continue;
    out[RENAMED[name] ?? name] = wards;
  }
  for (const [alias, names] of Object.entries(ALIASES)) {
    out[alias] = [...new Set(names.flatMap((n) => wardsOf.get(n)!))].sort((a, b) => a - b);
  }
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 1)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} names to ${OUT}.`);
  for (const [name, wards] of Object.entries(sorted)) console.log(`  ${name}: ${wards.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
