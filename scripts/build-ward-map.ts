/**
 * Regenerates src/constants/ward-map.ts from the city's ward-boundary
 * dataset (data.cityofchicago.org p293-wvbd, "Boundaries - Wards (2023-)").
 * Re-run after a remap. Boundaries are simplified (Douglas-Peucker) and
 * projected into a fixed SVG viewBox so the app ships plain path strings -
 * no GeoJSON parsing, no map SDK.
 *
 *   npm run build-ward-map
 */
import { writeFileSync } from 'fs';

const SOURCE = 'https://data.cityofchicago.org/resource/p293-wvbd.geojson?$limit=60';
const OUT = 'src/constants/ward-map.ts';
const VIEW_WIDTH = 1000;
/** Simplification tolerance in viewBox units (1 unit is roughly 25 meters). */
const TOLERANCE = 1.4;

type Ring = [number, number][];

function perpDistance(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function simplify(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 4) return ring;
  const keep = new Array<boolean>(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  const stack: [number, number][] = [[0, ring.length - 1]];
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

/** Area-weighted centroid of a ring (for placing the ward-number label). */
function centroid(ring: Ring): { x: number; y: number; area: number } {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const cross = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    area += cross;
    cx += (ring[i][0] + ring[i + 1][0]) * cross;
    cy += (ring[i][1] + ring[i + 1][1]) * cross;
  }
  area /= 2;
  return area === 0
    ? { x: ring[0][0], y: ring[0][1], area: 0 }
    : { x: cx / (6 * area), y: cy / (6 * area), area: Math.abs(area) };
}

async function main() {
  const resp = await fetch(SOURCE, { headers: { accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Fetching ward boundaries failed: ${resp.status}`);
  const geo = (await resp.json()) as {
    features: {
      properties: { ward: string };
      geometry: { type: string; coordinates: number[][][] | number[][][][] };
    }[];
  };
  if (geo.features.length !== 50) {
    throw new Error(`Expected 50 wards, got ${geo.features.length} - check the dataset.`);
  }

  // Equirectangular projection is plenty at city scale: x scaled by cos of
  // the city's mid-latitude so shapes keep their proportions.
  const allPoints: [number, number][] = [];
  const ringsByWard = new Map<number, Ring[]>();
  for (const f of geo.features) {
    const polys =
      f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates as number[][][]]
        : (f.geometry.coordinates as number[][][][]);
    const rings: Ring[] = [];
    for (const poly of polys) {
      for (const ring of poly) {
        rings.push(ring.map(([lon, lat]) => [lon, lat] as [number, number]));
      }
    }
    ringsByWard.set(Number(f.properties.ward), rings);
    for (const r of rings) allPoints.push(...r);
  }

  const lats = allPoints.map((p) => p[1]);
  const midLat = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const kx = Math.cos(midLat);
  const project = ([lon, lat]: [number, number]): [number, number] => [lon * kx, -lat];

  const projected = new Map<number, Ring[]>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [ward, rings] of ringsByWard) {
    const p = rings.map((r) => r.map(project) as Ring);
    projected.set(ward, p);
    for (const r of p) {
      for (const [x, y] of r) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const scale = VIEW_WIDTH / (maxX - minX);
  const viewHeight = Math.round((maxY - minY) * scale);
  const toView = ([x, y]: [number, number]): [number, number] => [
    (x - minX) * scale,
    (y - minY) * scale,
  ];

  const shapes: { id: number; d: string; cx: number; cy: number }[] = [];
  for (const [ward, rings] of [...projected.entries()].sort((a, b) => a[0] - b[0])) {
    const viewRings = rings.map((r) => simplify(r.map(toView) as Ring, TOLERANCE));
    let d = '';
    let best = { x: 0, y: 0, area: -1 };
    for (const r of viewRings) {
      if (r.length < 4) continue;
      d +=
        `M${r[0][0].toFixed(1)} ${r[0][1].toFixed(1)}` +
        r
          .slice(1, -1)
          .map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`)
          .join('') +
        'Z';
      const c = centroid(r);
      if (c.area > best.area) best = { x: c.x, y: c.y, area: c.area };
    }
    shapes.push({ id: ward, d, cx: Math.round(best.x), cy: Math.round(best.y) });
  }

  const file =
    `/**\n` +
    ` * Chicago's 50 ward boundaries as SVG paths, generated by\n` +
    ` * scripts/build-ward-map.ts from the city's Ward Boundaries dataset\n` +
    ` * (data.cityofchicago.org p293-wvbd). Re-run \`npm run build-ward-map\`\n` +
    ` * after a remap. Coordinates live in the WARD_MAP_VIEW box; (cx, cy) is\n` +
    ` * the largest ring's centroid, for the ward-number label.\n` +
    ` */\n\n` +
    `export const WARD_MAP_VIEW = { width: ${VIEW_WIDTH}, height: ${viewHeight} } as const;\n\n` +
    `export interface WardShape {\n  id: number;\n  d: string;\n  cx: number;\n  cy: number;\n}\n\n` +
    `export const WARD_SHAPES: WardShape[] = [\n` +
    shapes
      .map((s) => `  { id: ${s.id}, cx: ${s.cx}, cy: ${s.cy}, d: '${s.d}' },`)
      .join('\n') +
    `\n];\n`;

  writeFileSync(OUT, file);
  const kb = (file.length / 1024).toFixed(1);
  console.log(`✓ ${OUT}: 50 wards, viewBox ${VIEW_WIDTH}x${viewHeight}, ${kb} KB`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
