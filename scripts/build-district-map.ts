/**
 * Regenerates the district data layer: which US House, Illinois Senate,
 * Illinois House, Cook County commissioner, Board of Review, judicial
 * subcircuit, school board subdistrict, and police district every Chicago
 * ward and address belongs to. Re-run after any redistricting (the counts
 * below fail loudly when a map changes shape).
 *
 * Sources, all public:
 * - US House (120th Congress), IL Senate and IL House (2026 districts):
 *   Census TIGERweb, tigerWMS_Current layers 54 / 56 / 58. These match the
 *   Chicago Board of Elections precinct schedules.
 * - Commissioner, Board of Review, judicial subcircuit: Cook County GIS,
 *   electionSrvcLite layers 12 / 11 / 13 (the 2022 subcircuit map).
 * - Police districts: data.cityofchicago.org 24zt-jpfn. District 31 (the
 *   airports' outlying pieces) has no district council and is dropped.
 * - School board subdistricts 1a..10b: the General Assembly's shapefile
 *   (ilsenateredistricting.com), read with the small shapefile reader below.
 * - Precincts (2025-): data.cityofchicago.org i8fv-xe4b, to tell which
 *   districts cover part of Chicago and which ward a census block is in.
 * - Populated 2020 census blocks (interior points only): Census TIGERweb
 *   tigerWMS_Census2020 layer 10, to tell where people actually live.
 *
 * Outputs:
 * - functions/data/district-boundaries.json: every district covering part
 *   of a Chicago precinct, lon/lat at six decimals, for the server's
 *   address-to-district lookup (`districtsForPoint` in functions/src/ward.ts).
 *   Every precinct is sampled with a grid of interior points, skipping
 *   samples within INSET_M of the precinct's own edge (the city's and the
 *   county's lines drift a few meters apart, and a sample on that seam would
 *   claim a district across the street). Shapes are clipped to a box around
 *   the city (about a kilometer of margin), which is exact for every point
 *   in Chicago and drops the suburbs nobody here looks up.
 * - src/constants/ward-districts.ts: WARD_DISTRICTS, the districts of each
 *   type that hold people in each ward: a ward lists a district when some
 *   populated 2020 census block of the ward has its interior point there.
 *   The precinct grid alone would also list empty land (O'Hare puts the
 *   41st Ward in IL Senate 39, where no one in the ward lives). Every
 *   legislative, county, and school board map is drawn from whole census
 *   blocks, so this is exact as of 2020; police districts are not, so a
 *   block straddling a police line counts on its interior point's side.
 *
 *   npm run build-district-map
 */
import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

const OUT_BOUNDARIES = 'functions/data/district-boundaries.json';
const OUT_WARDS = 'src/constants/ward-districts.ts';

const TIGER =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer';
const tiger = (layer: number) =>
  `${TIGER}/${layer}/query?where=STATE%3D%2717%27&outFields=BASENAME&outSR=4326&geometryPrecision=6&f=geojson`;
const COOK = 'https://gis.cookcountyil.gov/traditional/rest/services/electionSrvcLite/MapServer';
const cook = (layer: number) =>
  `${COOK}/${layer}/query?where=1%3D1&outFields=*&outSR=4326&geometryPrecision=6&f=geojson`;
const POLICE = 'https://data.cityofchicago.org/resource/24zt-jpfn.geojson?$limit=100';
const SCHOOL_BOARD =
  'https://www.ilsenateredistricting.com/images/shape-files/ERSB_20_Sub_District_Map_FA1_SB_15.zip';
const PRECINCTS = 'https://data.cityofchicago.org/resource/i8fv-xe4b.geojson?$limit=2000';
const BLOCKS =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/10/query' +
  '?where=STATE%3D%2717%27+AND+COUNTY%3D%27031%27+AND+POP100%3E0' +
  '&outFields=INTPTLON,INTPTLAT,POP100&returnGeometry=false&orderByFields=OID&f=json';

/** Chicago precincts in the 2025 dataset. */
const EXPECTED_PRECINCTS = 1291;
/** Grid spacing inside a precinct, meters (coarser for big precincts). */
const STEP_M = 25;
/** At most this many grid columns or rows per precinct. */
const MAX_SIDE = 48;
/** Samples closer than this to their precinct's edge are skipped, meters. */
const INSET_M = 12;
/** Margin around the city's bounding box for clipping, degrees. */
const CLIP_MARGIN = 0.01;
/**
 * Douglas-Peucker tolerance, degrees: about ten centimeters, the same as the
 * six-decimal rounding. It only drops points lying on a straight run (more
 * than half of the published vertices), so the lines themselves stay put.
 */
const SIMPLIFY_DEG = 1e-6;

type Point = [number, number];
type Ring = Point[];
/** An outer ring followed by any holes, [lon, lat]. */
type Polygon = Ring[];

type DistrictType =
  | 'usHouse'
  | 'ilSenate'
  | 'ilHouse'
  | 'cookCommissioner'
  | 'boardOfReview'
  | 'subcircuit'
  | 'schoolBoard'
  | 'police';

interface Layer {
  type: DistrictType;
  url: string;
  /**
   * How many districts cover some of Chicago's precincts (`area`, what the
   * server file keeps) and how many hold Chicago residents (`residents`,
   * what the ward table can list). A change means a remap.
   */
  expected: { area: number; residents: number };
  /** District id from a feature's properties, or null to drop the feature. */
  key?: (p: Record<string, unknown>) => number | string | null;
}

const intKey = (field: string) => (p: Record<string, unknown>) => {
  const n = Number(p[field]);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const LAYERS: Layer[] = [
  { type: 'usHouse', url: tiger(54), expected: { area: 9, residents: 9 }, key: intKey('BASENAME') },
  { type: 'ilSenate', url: tiger(56), expected: { area: 21, residents: 21 }, key: intKey('BASENAME') },
  // IL House includes a ZZZ water "district", which intKey drops.
  { type: 'ilHouse', url: tiger(58), expected: { area: 38, residents: 37 }, key: intKey('BASENAME') },
  { type: 'cookCommissioner', url: cook(12), expected: { area: 15, residents: 13 }, key: intKey('DISTRICT_INT') },
  { type: 'boardOfReview', url: cook(11), expected: { area: 3, residents: 3 }, key: intKey('DISTRICT_INT') },
  { type: 'subcircuit', url: cook(13), expected: { area: 16, residents: 15 }, key: intKey('DISTRICT') },
  { type: 'schoolBoard', url: SCHOOL_BOARD, expected: { area: 20, residents: 20 } },
  {
    type: 'police',
    url: POLICE,
    expected: { area: 22, residents: 22 },
    key: (p) => {
      const n = intKey('dist_num')(p);
      return n === 31 ? null : n;
    },
  },
];

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

async function download(url: string): Promise<ArrayBuffer> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const resp = await fetch(url, {
        headers: { 'user-agent': BROWSER_UA },
        signal: AbortSignal.timeout(120_000),
      });
      if (!resp.ok) throw new Error(`${resp.status} from ${url}`);
      return await resp.arrayBuffer();
    } catch (err) {
      if (attempt >= 3) throw err;
      console.warn(`  retrying ${url}: ${(err as Error).message}`);
    }
  }
}

interface Feature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

async function geojson(url: string): Promise<Feature[]> {
  const body = JSON.parse(new TextDecoder().decode(await download(url))) as {
    features?: Feature[];
    exceededTransferLimit?: boolean;
    properties?: { exceededTransferLimit?: boolean };
    error?: unknown;
  };
  if (!body.features) throw new Error(`No features from ${url}: ${JSON.stringify(body.error)}`);
  if (body.exceededTransferLimit || body.properties?.exceededTransferLimit) {
    throw new Error(`${url} hit the server's record limit - page the query.`);
  }
  return body.features;
}

function polygonsOf(geometry: Feature['geometry']): Polygon[] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates as Polygon];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as Polygon[];
  throw new Error(`Unexpected geometry ${geometry.type}`);
}

/** Cook County's populated 2020 census blocks as interior points, paged. */
async function populatedBlocks(): Promise<{ lon: number; lat: number; pop: number }[]> {
  const out: { lon: number; lat: number; pop: number }[] = [];
  const page = 20_000;
  for (let offset = 0; ; offset += page) {
    const url = `${BLOCKS}&resultOffset=${offset}&resultRecordCount=${page}`;
    const body = JSON.parse(new TextDecoder().decode(await download(url))) as {
      features?: { attributes: { INTPTLON: string; INTPTLAT: string; POP100: number } }[];
      error?: unknown;
    };
    if (!body.features) throw new Error(`No blocks from ${url}: ${JSON.stringify(body.error)}`);
    for (const { attributes: a } of body.features) {
      out.push({ lon: Number(a.INTPTLON), lat: Number(a.INTPTLAT), pop: a.POP100 });
    }
    if (body.features.length < page) break;
  }
  if (out.some((b) => !Number.isFinite(b.lon) || !Number.isFinite(b.lat))) {
    throw new Error('A census block came back without an interior point.');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shapefile (polygons only) and dBase readers, just enough for the school
// board file: shape type 5, records in the same order as the .dbf rows.

function signedArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[i][0] - ring[j][0]) * (ring[i][1] + ring[j][1]);
  }
  return a / 2;
}

function readShp(buf: Buffer): (Polygon[] | null)[] {
  const out: (Polygon[] | null)[] = [];
  let off = 100;
  while (off < buf.length) {
    const contentBytes = buf.readInt32BE(off + 4) * 2;
    const at = off + 8;
    off = at + contentBytes;
    const shapeType = buf.readInt32LE(at);
    if (shapeType === 0) {
      out.push(null);
      continue;
    }
    if (shapeType !== 5) throw new Error(`Shapefile record type ${shapeType}, expected polygons`);
    const numParts = buf.readInt32LE(at + 36);
    const numPoints = buf.readInt32LE(at + 40);
    const parts: number[] = [];
    for (let i = 0; i < numParts; i += 1) parts.push(buf.readInt32LE(at + 44 + 4 * i));
    parts.push(numPoints);
    const pts = at + 44 + 4 * numParts;
    const rings: Ring[] = [];
    for (let i = 0; i < numParts; i += 1) {
      const ring: Ring = [];
      for (let k = parts[i]; k < parts[i + 1]; k += 1) {
        ring.push([buf.readDoubleLE(pts + 16 * k), buf.readDoubleLE(pts + 16 * k + 8)]);
      }
      rings.push(ring);
    }
    // Shapefile outer rings run clockwise (positive area by the formula
    // above), holes counterclockwise. Each hole joins the outer holding it.
    const polys: Polygon[] = rings.filter((r) => signedArea(r) > 0).map((r) => [r]);
    for (const hole of rings.filter((r) => signedArea(r) < 0)) {
      const home = polys.find((p) => inRing(hole[0][0], hole[0][1], p[0]));
      if (!home) throw new Error('Shapefile hole outside every outer ring');
      home.push(hole);
    }
    out.push(polys);
  }
  return out;
}

function readDbf(buf: Buffer): Record<string, string>[] {
  const count = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  const fields: { name: string; len: number }[] = [];
  for (let o = 32; buf[o] !== 0x0d; o += 32) {
    fields.push({
      name: buf.toString('latin1', o, o + 11).replace(/\0.*$/, ''),
      len: buf[o + 16],
    });
  }
  const rows: Record<string, string>[] = [];
  for (let r = 0; r < count; r += 1) {
    let o = headerLen + r * recordLen + 1;
    const row: Record<string, string> = {};
    for (const f of fields) {
      row[f.name] = buf.toString('latin1', o, o + f.len).trim();
      o += f.len;
    }
    rows.push(row);
  }
  return rows;
}

async function schoolBoardDistricts(): Promise<Map<string, Polygon[]>> {
  const dir = mkdtempSync(join(tmpdir(), 'school-board-'));
  try {
    const zip = join(dir, 'districts.zip');
    writeFileSync(zip, Buffer.from(await download(SCHOOL_BOARD)));
    execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
    const base = readdirSync(dir).find((f) => f.toLowerCase().endsWith('.shp'));
    if (!base) throw new Error('No .shp in the school board zip');
    const prj = readFileSync(join(dir, base.replace(/\.shp$/i, '.prj')), 'utf8');
    if (!prj.includes('WGS_1984') || prj.startsWith('PROJCS')) {
      throw new Error(`School board shapefile is not plain WGS84 lon/lat: ${prj}`);
    }
    const shapes = readShp(readFileSync(join(dir, base)));
    const rows = readDbf(readFileSync(join(dir, base.replace(/\.shp$/i, '.dbf'))));
    if (shapes.length !== rows.length) throw new Error('School board .shp and .dbf disagree');
    const out = new Map<string, Polygon[]>();
    rows.forEach((row, i) => {
      const n = Number(row.DISTRICT);
      const id = `${Math.ceil(n / 2)}${n % 2 ? 'a' : 'b'}`;
      if (row.LONGNAME.toLowerCase() !== `district ${id}`) {
        throw new Error(`School board DISTRICT ${n} is labeled "${row.LONGNAME}", expected ${id}`);
      }
      out.set(id, [...(out.get(id) ?? []), ...(shapes[i] ?? [])]);
    });
    return out;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Geometry.

/** Ray casting, the same test functions/src/ward.ts uses. */
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

/**
 * Even-odd point-in-shape over every ring of a district at once, with the
 * edges bucketed into latitude bands so a test only walks the edges near
 * its own latitude. Same answer as outer-minus-holes for valid polygons.
 */
class ShapeIndex {
  private bands: Float64Array[];
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;
  private bandH: number;

  constructor(
    polygons: Polygon[],
    private bandCount = 256
  ) {
    const rings = polygons.flat();
    for (const r of rings) {
      for (const [x, y] of r) {
        this.minX = Math.min(this.minX, x);
        this.minY = Math.min(this.minY, y);
        this.maxX = Math.max(this.maxX, x);
        this.maxY = Math.max(this.maxY, y);
      }
    }
    this.bandH = (this.maxY - this.minY) / bandCount || 1;
    const lists: number[][] = Array.from({ length: bandCount }, () => []);
    for (const r of rings) {
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [x1, y1] = r[j];
        const [x2, y2] = r[i];
        if (y1 === y2) continue;
        const b0 = this.band(Math.min(y1, y2));
        const b1 = this.band(Math.max(y1, y2));
        for (let b = b0; b <= b1; b += 1) lists[b].push(x1, y1, x2, y2);
      }
    }
    this.bands = lists.map((l) => Float64Array.from(l));
  }

  private band(y: number): number {
    return Math.max(0, Math.min(this.bandCount - 1, Math.floor((y - this.minY) / this.bandH)));
  }

  contains(x: number, y: number): boolean {
    if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) return false;
    const e = this.bands[this.band(y)];
    let inside = false;
    for (let k = 0; k < e.length; k += 4) {
      const x1 = e[k];
      const y1 = e[k + 1];
      const x2 = e[k + 2];
      const y2 = e[k + 3];
      if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
    }
    return inside;
  }
}

/** Sutherland-Hodgman against an axis-aligned box. Exact for points inside it. */
function clipRing(ring: Ring, box: { minX: number; minY: number; maxX: number; maxY: number }): Ring {
  const edges: [(p: Point) => boolean, (a: Point, b: Point) => Point][] = [
    [(p) => p[0] >= box.minX, (a, b) => [box.minX, a[1] + ((b[1] - a[1]) * (box.minX - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= box.maxX, (a, b) => [box.maxX, a[1] + ((b[1] - a[1]) * (box.maxX - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= box.minY, (a, b) => [a[0] + ((b[0] - a[0]) * (box.minY - a[1])) / (b[1] - a[1]), box.minY]],
    [(p) => p[1] <= box.maxY, (a, b) => [a[0] + ((b[0] - a[0]) * (box.maxY - a[1])) / (b[1] - a[1]), box.maxY]],
  ];
  let pts = ring.slice(0, -1);
  for (const [inside, cross] of edges) {
    if (!pts.length) break;
    const next: Point[] = [];
    for (let i = 0; i < pts.length; i += 1) {
      const cur = pts[i];
      const prev = pts[(i + pts.length - 1) % pts.length];
      if (inside(cur)) {
        if (!inside(prev)) next.push(cross(prev, cur));
        next.push(cur);
      } else if (inside(prev)) {
        next.push(cross(prev, cur));
      }
    }
    pts = next;
  }
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  const out: Ring = [];
  for (const [x, y] of pts) {
    const p: Point = [round(x), round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) {
    out.pop();
  }
  if (out.length < 3 || signedArea([...out, out[0]]) === 0) return [];
  return [...out, out[0]];
}

function perpDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas-Peucker on a closed ring (first and last points stay). */
function simplify(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 5) return ring;
  const keep = new Array<boolean>(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  // Split at the point farthest from the start so a ring never collapses.
  let far = 1;
  for (let i = 1; i < ring.length - 1; i += 1) {
    if (perpDistance(ring[i], ring[0], ring[0]) > perpDistance(ring[far], ring[0], ring[0])) far = i;
  }
  keep[far] = true;
  const stack: [number, number][] = [
    [0, far],
    [far, ring.length - 1],
  ];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const d = perpDistance(ring[i], ring[first], ring[last]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > tolerance && index > 0) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

function clipPolygons(polys: Polygon[], box: Parameters<typeof clipRing>[1]): Polygon[] {
  const out: Polygon[] = [];
  const clip = (r: Ring) => {
    const c = clipRing(r, box);
    return c.length ? simplify(c, SIMPLIFY_DEG) : c;
  };
  for (const [outer, ...holes] of polys) {
    const o = clip(outer);
    if (o.length < 4) continue;
    out.push([o, ...holes.map(clip).filter((h) => h.length >= 4)]);
  }
  return out;
}

const vertexCount = (polys: Polygon[]) => polys.reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0);

/** Distance from a point to a segment, in meters (local flat projection). */
function segDistM(p: Point, a: Point, b: Point, kx: number): number {
  const M = 111_320;
  const px = p[0] * kx * M;
  const py = p[1] * M;
  const ax = a[0] * kx * M;
  const ay = a[1] * M;
  const dx = b[0] * kx * M - ax;
  const dy = b[1] * M - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Interior sample points of a precinct: grid points inside it and at least
 * INSET_M from its edge. A precinct too thin for that falls back to its
 * deepest inside point, so every precinct counts somewhere.
 */
function samplePrecinct(polys: Polygon[]): { points: Point[]; fallback: boolean } {
  const shape = new ShapeIndex(polys, 32);
  const rings = polys.flat();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rings) {
    for (const [x, y] of r) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const kx = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const wM = (maxX - minX) * kx * 111_320;
  const hM = (maxY - minY) * 111_320;
  let step = Math.max(STEP_M, Math.max(wM, hM) / MAX_SIDE);
  let best = null as { p: Point; d: number } | null;
  for (let tries = 0; tries < 6; tries += 1) {
    const points: Point[] = [];
    const cols = Math.max(1, Math.ceil(wM / step));
    const rows = Math.max(1, Math.ceil(hM / step));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const p: Point = [minX + ((i + 0.5) / cols) * (maxX - minX), minY + ((j + 0.5) / rows) * (maxY - minY)];
        if (!shape.contains(p[0], p[1])) continue;
        let d = Infinity;
        for (const r of rings) {
          for (let k = 1; k < r.length && d >= INSET_M; k += 1) d = Math.min(d, segDistM(p, r[k - 1], r[k], kx));
        }
        if (d >= INSET_M) points.push(p);
        else if (!best || d > best.d) best = { p, d };
      }
    }
    if (points.length) return { points, fallback: false };
    if (best) return { points: [best.p], fallback: true };
    step /= 2;
  }
  throw new Error('A precinct has no interior point at all');
}

// ---------------------------------------------------------------------------

function sortIds<T extends number | string>(ids: Iterable<T>): T[] {
  return [...ids].sort((a, b) =>
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : parseInt(String(a), 10) - parseInt(String(b), 10) || String(a).localeCompare(String(b))
  );
}

async function main() {
  console.log('Downloading precincts...');
  const precinctFeatures = await geojson(PRECINCTS);
  if (precinctFeatures.length !== EXPECTED_PRECINCTS) {
    throw new Error(
      `Expected ${EXPECTED_PRECINCTS} precincts, got ${precinctFeatures.length} - check the dataset, then update EXPECTED_PRECINCTS.`
    );
  }
  const precincts = precinctFeatures.map((f) => ({
    ward: Number(f.properties.ward),
    precinct: Number(f.properties.precinct),
    polygons: polygonsOf(f.geometry),
  }));
  const wardsSeen = new Set(precincts.map((p) => p.ward));
  if (wardsSeen.size !== 50 || [...wardsSeen].some((w) => !(w >= 1 && w <= 50))) {
    throw new Error('Precincts do not cover wards 1..50 exactly.');
  }

  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of precincts) {
    for (const r of p.polygons.flat()) {
      for (const [x, y] of r) {
        box.minX = Math.min(box.minX, x - CLIP_MARGIN);
        box.minY = Math.min(box.minY, y - CLIP_MARGIN);
        box.maxX = Math.max(box.maxX, x + CLIP_MARGIN);
        box.maxY = Math.max(box.maxY, y + CLIP_MARGIN);
      }
    }
  }

  // Every layer's districts, clipped to the city box.
  const layers: { layer: Layer; districts: { n: number | string; polygons: Polygon[]; index: ShapeIndex }[] }[] = [];
  for (const layer of LAYERS) {
    console.log(`Downloading ${layer.type}...`);
    const byId = new Map<number | string, Polygon[]>();
    if (layer.type === 'schoolBoard') {
      for (const [id, polys] of await schoolBoardDistricts()) byId.set(id, polys);
    } else {
      for (const f of await geojson(layer.url)) {
        const id = layer.key!(f.properties);
        if (id == null) continue;
        byId.set(id, [...(byId.get(id) ?? []), ...polygonsOf(f.geometry)]);
      }
    }
    const districts = [];
    for (const n of sortIds(byId.keys())) {
      const polygons = clipPolygons(byId.get(n)!, box);
      if (polygons.length) districts.push({ n, polygons, index: new ShapeIndex(polygons) });
    }
    layers.push({ layer, districts });
  }

  // Sample every precinct and place each sample in each layer.
  console.log('Sampling precincts...');
  const used = new Map<DistrictType, Set<number | string>>(LAYERS.map((l) => [l.type, new Set()]));
  const misses = new Map<DistrictType, number>();
  const overlaps = new Map<DistrictType, number>();
  let samples = 0;
  const fallbacks: string[] = [];
  for (const pr of precincts) {
    const { points, fallback } = samplePrecinct(pr.polygons);
    if (fallback) fallbacks.push(`${pr.ward}-${pr.precinct}`);
    samples += points.length;
    for (const { layer, districts } of layers) {
      for (const [x, y] of points) {
        const hits = districts.filter((d) => d.index.contains(x, y));
        if (!hits.length) misses.set(layer.type, (misses.get(layer.type) ?? 0) + 1);
        if (hits.length > 1) overlaps.set(layer.type, (overlaps.get(layer.type) ?? 0) + 1);
        for (const h of hits) used.get(layer.type)!.add(h.n);
      }
    }
  }
  console.log(
    `  ${samples} samples in ${precincts.length} precincts` +
      (fallbacks.length ? `; ${fallbacks.length} too thin for the inset used their deepest point (${fallbacks.join(', ')})` : '')
  );
  for (const { layer } of layers) {
    const m = misses.get(layer.type) ?? 0;
    const o = overlaps.get(layer.type) ?? 0;
    if (m || o) console.log(`  ${layer.type}: ${m} samples in no district, ${o} in two`);
  }

  // Where people live: every populated 2020 census block's interior point,
  // placed in its ward (through the precinct holding it) and its districts.
  console.log('Placing populated census blocks...');
  const blocks = await populatedBlocks();
  const precinctIndex = precincts.map((pr) => ({ ward: pr.ward, index: new ShapeIndex(pr.polygons, 32) }));
  const byWard = new Map<number, Map<DistrictType, Map<number | string, number>>>();
  let chicagoBlocks = 0;
  const blockMisses = new Map<DistrictType, number>();
  for (const b of blocks) {
    const home = precinctIndex.find((pr) => pr.index.contains(b.lon, b.lat));
    if (!home) continue;
    chicagoBlocks += 1;
    const ward = byWard.get(home.ward) ?? new Map<DistrictType, Map<number | string, number>>();
    byWard.set(home.ward, ward);
    for (const { layer, districts } of layers) {
      const pop = ward.get(layer.type) ?? new Map<number | string, number>();
      ward.set(layer.type, pop);
      const hit = districts.find((d) => d.index.contains(b.lon, b.lat));
      if (!hit) {
        blockMisses.set(layer.type, (blockMisses.get(layer.type) ?? 0) + b.pop);
        continue;
      }
      pop.set(hit.n, (pop.get(hit.n) ?? 0) + b.pop);
      // A district with residents is kept for the server even if the
      // precinct grid somehow missed it.
      used.get(layer.type)!.add(hit.n);
    }
  }
  console.log(`  ${chicagoBlocks} populated blocks in Chicago (of ${blocks.length} in Cook County)`);
  for (const [type, pop] of blockMisses) console.log(`  ${type}: ${pop} residents in no district`);
  for (let w = 1; w <= 50; w += 1) {
    for (const l of LAYERS) {
      if (!byWard.get(w)?.get(l.type)?.size) throw new Error(`Ward ${w} has no ${l.type} district.`);
    }
  }

  // Counts guard: a change means a remap (or a broken download).
  const counts: string[] = [];
  const changed: string[] = [];
  for (const { layer } of layers) {
    const area = sortIds(used.get(layer.type)!);
    const residents = sortIds(
      new Set([...byWard.values()].flatMap((ward) => [...ward.get(layer.type)!.keys()]))
    );
    counts.push(`${layer.type} ${area.length}/${residents.length}`);
    if (area.length !== layer.expected.area) {
      changed.push(`${layer.type} area: ${area.length} districts, expected ${layer.expected.area} (${area.join(', ')})`);
    }
    if (residents.length !== layer.expected.residents) {
      changed.push(
        `${layer.type} residents: ${residents.length} districts, expected ${layer.expected.residents} (${residents.join(', ')})`
      );
    }
  }
  console.log(`  Chicago districts (area/residents): ${counts.join(', ')}`);
  if (changed.length) {
    throw new Error(
      `District counts changed:\n  ${changed.join('\n  ')}\nIf a new map took effect, check it and update LAYERS.`
    );
  }

  // Server boundaries: only the districts that hold Chicago precincts.
  const types: Record<string, { n: number | string; polygons: Polygon[] }[]> = {};
  const source: Record<string, string> = { precincts: PRECINCTS, blocks: BLOCKS };
  for (const { layer, districts } of layers) {
    source[layer.type] = layer.url;
    types[layer.type] = districts
      .filter((d) => used.get(layer.type)!.has(d.n))
      .map((d) => ({ n: d.n, polygons: d.polygons }));
    const v = types[layer.type].reduce((s, d) => s + vertexCount(d.polygons), 0);
    console.log(`  ${layer.type}: ${types[layer.type].length} districts, ${v} vertices`);
  }
  source.fetchedAt = new Date().toISOString();
  mkdirSync(dirname(OUT_BOUNDARIES), { recursive: true });
  const json = JSON.stringify({ source, types });
  writeFileSync(OUT_BOUNDARIES, json);
  console.log(`✓ ${OUT_BOUNDARIES}: ${(json.length / 1024).toFixed(0)} KB`);

  // App table: ward -> districts of each type.
  const fmt = (ids: (number | string)[]) =>
    ids.map((id) => (typeof id === 'string' ? `'${id}'` : String(id))).join(', ');
  const lines: string[] = [];
  for (let w = 1; w <= 50; w += 1) {
    const ward = byWard.get(w)!;
    const fields = LAYERS.map((l) => `${l.type}: [${fmt(sortIds(ward.get(l.type)!.keys()))}]`);
    lines.push(`  ${w}: {\n    ${fields.join(',\n    ')},\n  },`);
  }
  const file =
    `/**\n` +
    ` * The districts of each type that hold people in each Chicago ward.\n` +
    ` * Generated by \`npm run build-district-map\` (scripts/build-district-map.ts);\n` +
    ` * do not edit by hand. A ward lists a district when some populated 2020\n` +
    ` * census block of the ward has its interior point in it, so a ward only\n` +
    ` * lists districts where its residents live, split precincts included.\n` +
    ` * Built ${source.fetchedAt.slice(0, 10)} from:\n` +
    ` * - US House (120th Congress), IL Senate, IL House (2026 districts): Census\n` +
    ` *   TIGERweb tigerWMS_Current layers 54, 56, 58.\n` +
    ` * - Cook County commissioner, Board of Review, judicial subcircuit (2022\n` +
    ` *   map): Cook County GIS electionSrvcLite layers 12, 11, 13.\n` +
    ` * - Chicago Board of Education subdistricts 1a..10b: the General Assembly's\n` +
    ` *   ERSB_20_Sub_District_Map_FA1_SB_15 shapefile.\n` +
    ` * - Police districts: data.cityofchicago.org 24zt-jpfn (district 31, which\n` +
    ` *   has no district council, left out).\n` +
    ` * - Precincts (2025-): data.cityofchicago.org i8fv-xe4b.\n` +
    ` * - Populated 2020 census blocks: Census TIGERweb tigerWMS_Census2020\n` +
    ` *   layer 10.\n` +
    ` * A ward usually sits in several districts of a type, so a ward alone never\n` +
    ` * pins down one person's district; the address lookup on the server does.\n` +
    ` */\n\n` +
    `export interface Districts {\n` +
    `  usHouse: number;\n  ilSenate: number;\n  ilHouse: number;\n  cookCommissioner: number;\n` +
    `  boardOfReview: number;\n  subcircuit: number;\n  /** '1a'..'10b' */\n  schoolBoard: string;\n  police: number;\n}\n\n` +
    `export type WardDistricts = { [K in keyof Districts]: Districts[K][] };\n\n` +
    `export const WARD_DISTRICTS: Record<number, WardDistricts> = {\n${lines.join('\n')}\n};\n`;
  writeFileSync(OUT_WARDS, file);
  console.log(`✓ ${OUT_WARDS}: 50 wards, ${(file.length / 1024).toFixed(1)} KB`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
