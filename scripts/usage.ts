/**
 * Which tabs and screens get opened, and which are ignored, from the
 * anonymous counts in usageDaily (src/lib/usage.ts, onUsageEvent). Plain
 * text, read-only. "Device-days" adds up, per day, the devices that opened
 * a screen at least once that day; a device opening it on 3 days counts 3.
 *
 *   gcloud auth application-default login
 *   npm run usage                 (last 14 Chicago days, today included)
 *   npm run usage -- --days 30
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';

import { PAGE_HELP } from '../src/constants/page-help';
import { MAYOR_GAMES } from '../src/lib/mayor-games-data';

const PROJECT_ID = 'direct-democracy-e338a';

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore(app);

const TABS: [string, string][] = [
  ['(tabs)/index', 'home'],
  ['(tabs)/ward', 'wards'],
  ['(tabs)/news', 'news'],
  ['(tabs)/election', 'election'],
  ['(tabs)/profile', 'profile'],
  ['(tabs)/command', 'command'],
];

function chicagoDay(offsetDays: number): string {
  const s = new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [m, d, y] = s.split('/');
  return `${y}-${m}-${d}`;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const days = Math.max(1, Number(arg('--days') ?? 14) || 14);
  const from = chicagoDay(-(days - 1));
  const to = chicagoDay(0);
  const snap = await db
    .collection('usageDaily')
    .where(FieldPath.documentId(), '>=', from)
    .where(FieldPath.documentId(), '<=', to)
    .get();

  const views: Record<string, number> = {};
  const devices: Record<string, number> = {};
  const platforms: Record<string, { events: number; views: number; versions: Record<string, number> }> = {};
  for (const doc of snap.docs) {
    const d = doc.data();
    for (const [r, n] of Object.entries((d.views ?? {}) as Record<string, number>)) views[r] = (views[r] ?? 0) + n;
    for (const [r, n] of Object.entries((d.devices ?? {}) as Record<string, number>)) devices[r] = (devices[r] ?? 0) + n;
    for (const [p, v] of Object.entries((d.platforms ?? {}) as Record<string, { events?: number; views?: number; versions?: Record<string, number> }>)) {
      const t = (platforms[p] ??= { events: 0, views: 0, versions: {} });
      t.events += v.events ?? 0;
      t.views += v.views ?? 0;
      for (const [ver, n] of Object.entries(v.versions ?? {})) t.versions[ver] = (t.versions[ver] ?? 0) + n;
    }
  }

  const pad = (s: string | number, n: number) => String(s).padStart(n);
  const row = (name: string, r: string) =>
    `  ${name.padEnd(30)}${pad(views[r] ?? 0, 8)}${pad(devices[r] ?? 0, 13)}${pad(((devices[r] ?? 0) / days).toFixed(1), 15)}`;
  const header = `  ${'screen'.padEnd(30)}${pad('views', 8)}${pad('device-days', 13)}${pad('devices/day', 15)}`;

  console.log(`Screen use, ${from} to ${to} (${days} days, ${snap.size} with data)\n`);

  console.log('Tabs');
  console.log(header);
  for (const [r, name] of TABS) console.log(row(name, r));

  const tabRoutes = new Set(TABS.map(([r]) => r));
  const others = Object.keys({ ...views, ...devices })
    .filter((r) => !tabRoutes.has(r))
    .sort((a, b) => (devices[b] ?? 0) - (devices[a] ?? 0) || (views[b] ?? 0) - (views[a] ?? 0));
  console.log('\nOther screens, by device-days');
  console.log(header);
  if (others.length === 0) console.log('  (none)');
  for (const r of others) console.log(row(r, r));

  // The command tab has one help entry per role; both are one screen.
  // The five games share one help entry and are counted apart (src/lib/usage.ts).
  const known = [...new Set(Object.keys(PAGE_HELP).map((k) => k.split('#')[0]))].flatMap((k) =>
    k === 'game/[kind]' ? MAYOR_GAMES.map((g) => `game/${g.kind}`) : [k]
  );
  const never = known.filter((r) => !views[r]).sort();
  console.log('\nNever opened (has a help entry, no views in the window)');
  if (never.length === 0) console.log('  (none)');
  for (const r of never) console.log(`  ${r}`);

  console.log('\nPlatforms (events are sends, about one per minute of use)');
  for (const [p, t] of Object.entries(platforms).sort()) {
    const versions = Object.entries(t.versions)
      .sort((a, b) => b[1] - a[1])
      .map(([v, n]) => `${v} ${n}`)
      .join(', ');
    console.log(`  ${p.padEnd(8)} ${t.events} events, ${t.views} views${versions ? `; versions: ${versions}` : ''}`);
  }
  if (Object.keys(platforms).length === 0) console.log('  (none)');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
