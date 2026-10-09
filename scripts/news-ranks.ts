/**
 * Rechecks the news tab's traffic rule (2026-10-08): a newsroom is in only
 * when its site is among the top million on the latest Tranco list
 * (tranco-list.eu, a public research ranking of site popularity). Prints
 * every included and not-included outlet's rank, then the outlets being
 * watched, and flags any that crossed the line. Read-only: moving an outlet
 * is an edit to SOURCES / NOT_INCLUDED in functions/src/news.ts and a
 * deploy of syncNewsFeeds.
 *
 *   npm run news-ranks
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { NOT_INCLUDED, SOURCES } from '../functions/src/news';

const BAR = 1_000_000;
const LIST = 'https://tranco-list.eu/top-1m.csv.zip';

/**
 * Newsrooms covering Chicago that are not in the app, and why, so a change
 * in either their rank or their feed is noticed. Keep docs/content-follow-ups.md
 * in step.
 */
const WATCH: { name: string; domain: string; why: string }[] = [
  { name: 'Austin Weekly News', domain: 'austinweeklynews.com', why: 'feed works; below the bar' },
  { name: 'Borderless Magazine', domain: 'borderlessmag.org', why: 'feed works; below the bar' },
  { name: 'City Bureau', domain: 'citybureau.org', why: 'feed works; below the bar' },
  { name: 'Illinois Answers Project', domain: 'illinoisanswers.org', why: 'feed works; below the bar' },
  { name: 'The TRiiBE', domain: 'thetriibe.com', why: 'below the bar; its host also blocks our server' },
  { name: 'Axios Chicago', domain: 'axios.com', why: 'blocks feed readers; follow-up email' },
  { name: 'Chicago Defender', domain: 'chicagodefender.com', why: 'blocks feed readers; follow-up email' },
  { name: 'Chicago Magazine', domain: 'chicagomag.com', why: 'no usable feed found' },
  { name: 'AustinTalks', domain: 'austintalks.org', why: 'feed does not answer' },
  { name: 'Windy City Times', domain: 'windycitytimes.com', why: 'no usable feed found' },
  { name: 'Dziennik Zwiazkowy', domain: 'dziennikzwiazkowy.com', why: 'no usable feed found' },
  { name: 'Lawndale News', domain: 'lawndalenews.com', why: 'no usable feed found' },
  { name: 'Gazette Chicago', domain: 'gazettechicago.com', why: 'no usable feed found' },
];

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'tranco-'));
  try {
    const resp = await fetch(LIST, { signal: AbortSignal.timeout(180_000) });
    if (!resp.ok) throw new Error(`${resp.status} from ${LIST}`);
    writeFileSync(join(dir, 'list.zip'), Buffer.from(await resp.arrayBuffer()));
    execFileSync('unzip', ['-q', '-o', join(dir, 'list.zip'), '-d', dir]);
    const rank = new Map<string, number>();
    for (const line of readFileSync(join(dir, 'top-1m.csv'), 'utf8').split('\n')) {
      const [n, domain] = line.trim().split(',');
      if (domain) rank.set(domain, Number(n));
    }
    const show = (r: number | undefined) => (r ? r.toLocaleString('en-US') : 'not in the top million');
    const problems: string[] = [];

    console.log('Included:');
    for (const s of SOURCES) {
      const r = rank.get(s.domain);
      console.log(`  ${s.name.padEnd(28)} ${s.domain.padEnd(26)} ${show(r)}`);
      if (!r || r > BAR) problems.push(`${s.name} is now below the bar: take it out of SOURCES.`);
    }
    console.log('Not included (blocked, asked, declined):');
    for (const s of NOT_INCLUDED) {
      const r = rank.get(s.domain);
      console.log(`  ${s.name.padEnd(28)} ${s.domain.padEnd(26)} ${show(r)}  ${s.status}`);
      if (!r || r > BAR) problems.push(`${s.name} is now below the bar: take it off NOT_INCLUDED.`);
    }
    console.log('Watched:');
    for (const w of WATCH) {
      const r = rank.get(w.domain);
      console.log(`  ${w.name.padEnd(28)} ${w.domain.padEnd(26)} ${show(r)}  (${w.why})`);
      if (r && r <= BAR && w.why.includes('below the bar')) problems.push(`${w.name} is now above the bar: check its feed and add it.`);
    }
    console.log(problems.length ? `\nChanges needed:\n- ${problems.join('\n- ')}` : '\nEvery outlet is on the right side of the bar.');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
