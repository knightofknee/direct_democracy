/**
 * Search engines and link previews for the web version. The web export is a
 * single-page app, so every URL used to serve the same index.html: one
 * title, no description, and an empty root div for any crawler that does not
 * run JavaScript (Bing, and the link previews in iMessage, Slack, Facebook).
 *
 * This writes, for each public page, a copy of dist-web/index.html at
 * dist-web/<route> as an EXTENSIONLESS file (dist-web/official/<uid>), with:
 *   - a specific <title>, meta description, canonical link, Open Graph and
 *     Twitter card tags in <head>;
 *   - the page's real content as plain HTML inside the root div.
 * The app mounts with createRoot (single output never sets
 * __EXPO_ROUTER_HYDRATE__), so its first render replaces that content; it is
 * never hydrated, and the signed-in first render never has to match it.
 * Also writes dist-web/sitemap.xml.
 *
 * On waldgrave.com, real files in public/ win over the rewrite that sends
 * every other path to index.html, and next.config.js serves extensionless
 * files under /directdemocracy/app as text/html. A page with no file here
 * (signed-in screens, policies, concerns) still gets the plain index.html.
 *
 * Reads PRODUCTION Firestore, read-only, with Application Default
 * Credentials. Run by `npm run publish-web` between export and copy; on its
 * own:
 *
 *   gcloud auth application-default login
 *   npm run export-web && npm run build-seo-pages
 *
 * Exits non-zero, before writing anything, when a collection that must have
 * documents comes back empty, so a broken publish never ships empty pages.
 * English text only for now (the *Es fields exist for a later pass).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import path from 'path';

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { ordinal, TEST_WARD } from '@/constants/chicago';
import {
  GENERAL_ELECTION,
  GENERAL_ELECTION_DATE,
  generalRaceLabel,
  isKnownRace,
  JUDICIAL_2026,
  MUNICIPAL_2027_FILING,
  MUNICIPAL_ELECTION,
  MUNICIPAL_ELECTION_DATE,
  municipalRaceLabel,
  raceInfo,
  WRITE_IN_2026,
} from '@/constants/elections';
import { SCHOOL_BOARD_ELECTION_DATE, SCHOOL_BOARD_RACES } from '@/constants/school-board';
import type {
  Candidate,
  ElectionCandidateCard,
  ElectionRaceNote,
  Official,
  Policy,
  SchoolBoardCandidate,
} from '@/lib/types';

const PROJECT_ID = 'direct-democracy-e338a';
const SITE = 'https://www.waldgrave.com';
const BASE_PATH = '/directdemocracy/app';
const OUT = path.join(__dirname, '..', 'dist-web');
const APP_NAME = 'direct democracy';

/** Top-level names this script owns inside dist-web, cleared before writing. */
const OWNED = [
  'election-candidate',
  'election-race',
  'school-board',
  'school-board-candidate',
  'candidate',
  'official',
  'ward-race',
  'officials',
  'sitemap.xml',
];

/** Tab URLs listed in the sitemap beside the generated pages ('' is the app's home). */
const TAB_ROUTES = ['', 'election', 'news', 'ward'];

// ---------------------------------------------------------------------------
// Text and HTML helpers

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Collapses whitespace and cuts at a word boundary, ending with an ellipsis. */
function cut(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const slice = flat.slice(0, max + 1);
  const space = slice.lastIndexOf(' ');
  const head = (space > max * 0.6 ? slice.slice(0, space) : flat.slice(0, max)).replace(/[\s,;:.]+$/, '');
  return `${head}…`;
}

/**
 * Policy bodies use a tiny markup (## headings, "- " bullets); flatten it to
 * prose. A line with no closing punctuation gets a colon before bullets and
 * a period otherwise, so "Key Ideas" and its list don't run together.
 */
function plainPolicy(body: string): string {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.replace(/^#+\s*/, ''));
  return lines
    .map((line, i) => {
      const text = line.replace(/^#+\s*/, '').replace(/^[-*]\s+/, '').replace(/\*\*/g, '').trim();
      if (/[.!?:;]$/.test(text)) return text;
      return `${text}${/^[-*]\s/.test(lines[i + 1] ?? '') ? ':' : '.'}`;
    })
    .join(' ');
}

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Only ids that are safe as a file name with no extension get a page. */
function safeId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id);
}

const href = (route: string) => (route ? `${BASE_PATH}/${route}` : BASE_PATH);
const absolute = (route: string) => `${SITE}${href(route)}`;
const link = (route: string, text: string) => `<a href="${esc(href(route))}">${esc(text)}</a>`;
const outLink = (url: string, text: string) => `<a href="${esc(url)}" rel="nofollow noopener">${esc(text)}</a>`;
const para = (text: string | null | undefined) => (text ? `<p>${esc(text)}</p>` : '');
/** Operator text with blank-line paragraphs. */
const paras = (text: string | null | undefined) =>
  (text ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => para(p))
    .join('\n');
const list = (items: string[]) => (items.length ? `<ul>\n${items.map((i) => `<li>${i}</li>`).join('\n')}\n</ul>` : '');

interface Page {
  /** Route under the base path, no leading slash ('official/abc'). */
  route: string;
  /** Page title before the " | direct democracy" suffix. */
  title: string;
  description: string;
  ogType: 'website' | 'profile';
  /** Inner HTML for the root div. */
  body: string;
}

// ---------------------------------------------------------------------------
// Labels

function wardOrdinal(n: number): string {
  return `${ordinal(n)} Ward`;
}

/**
 * A race's label by its election, as the candidate screen labels it. (Each
 * race id names one race; until 2026-10-09 'treasurer' named both the state
 * and the city treasurer, and the check below still guards against a repeat.)
 */
function raceLabel(election: string, race: string): string {
  return election === GENERAL_ELECTION ? generalRaceLabel(race) : municipalRaceLabel(race);
}

/** What a candidate runs for, readable after "candidate for". */
function raceTitle(election: string, race: string): string {
  const ward = race.match(/^ward-(\d+)$/);
  if (ward) return `${wardOrdinal(Number(ward[1]))} alderman`;
  return raceLabel(election, race);
}

function electionDate(election: string): string {
  return election === GENERAL_ELECTION ? GENERAL_ELECTION_DATE : MUNICIPAL_ELECTION_DATE;
}

/** The page a race lives on: ward races have their own screen. */
function raceRoute(race: string): string {
  const ward = race.match(/^ward-(\d+)$/);
  return ward ? `ward-race/${Number(ward[1])}` : `election-race/${race}`;
}

function schoolBoardLabel(race: string): string {
  return race === 'president'
    ? 'Chicago Board of Education President'
    : `Chicago Board of Education, ${SCHOOL_BOARD_RACES.find((r) => r.id === race)?.label ?? `District ${race}`}`;
}

/** Ballot names first, the incumbent first among them, then alphabetical (the race screen's order). */
function ballotOrder<T extends { name: string; incumbent: boolean; writeIn?: boolean }>(a: T, b: T): number {
  return (
    Number(!!a.writeIn) - Number(!!b.writeIn) ||
    Number(b.incumbent) - Number(a.incumbent) ||
    a.name.localeCompare(b.name)
  );
}

function chips(c: { party?: string | null; incumbent: boolean; writeIn?: boolean; ctuEndorsed?: boolean }): string {
  return [c.party, c.incumbent && 'Incumbent', c.writeIn && 'Write-in', c.ctuEndorsed && 'CTU endorsed']
    .filter(Boolean)
    .join(', ');
}

/** The same facts as a sentence, for a card's own page. */
function chipSentence(c: Parameters<typeof chips>[0]): string {
  return [c.party && `Party: ${c.party}.`, c.incumbent && 'Incumbent.', c.writeIn && 'Declared write-in.', c.ctuEndorsed && 'Endorsed by the Chicago Teachers Union.']
    .filter(Boolean)
    .join(' ');
}

function sources(urls: string[] | undefined): string {
  if (!urls?.length) return '';
  return `<p>Compiled from public sources:</p>\n${list(urls.map((u) => outLink(u, host(u))))}`;
}

const electionTabLink = `<p>${link('election', 'Every race on the Chicago ballot')}</p>`;

// ---------------------------------------------------------------------------
// Pages

function electionCandidatePage(c: ElectionCandidateCard, raceHasPage: boolean): Page {
  const retention = c.race === 'judicial-retention';
  const what = raceTitle(c.election, c.race);
  const title = retention
    ? `${c.name}, judge up for retention`
    : `${c.name}, ${c.writeIn ? 'write-in candidate' : 'candidate'} for ${what}`;
  const date = electionDate(c.election);
  const chipLine = chipSentence(c);
  const ratings = (c.ratings ?? []).map((r) =>
    r.url ? `${esc(r.source)}: ${outLink(r.url, r.rating)}` : `${esc(r.source)}: ${esc(r.rating)}`
  );
  const body = [
    `<h1>${esc(c.name)}</h1>`,
    para(`${retention ? 'Judge up for retention' : what}, on the Chicago ballot ${date}.${chipLine ? ` ${chipLine}` : ''}`),
    c.writeIn ? para(WRITE_IN_2026.explainer) : '',
    c.seat || c.court ? para([c.seat, c.court].filter(Boolean).join(', ')) : '',
    c.website ? `<p>${outLink(c.website, `Campaign site (${host(c.website)})`)}</p>` : '',
    ratings.length ? `<h2>Ratings</h2>\n${list(ratings)}` : '',
    `<h2>${retention ? 'Record' : 'Running on'}</h2>`,
    para(c.runningOn),
    c.priorCareer ? `<h2>Background</h2>\n${para(c.priorCareer)}` : '',
    sources(c.sourceUrls),
    raceHasPage ? `<p>${link(raceRoute(c.race), `Everyone in this race: ${raceLabel(c.election, c.race)}`)}</p>` : '',
    electionTabLink,
  ];
  return {
    route: `election-candidate/${c.id}`,
    title,
    description: cut(`${title}. ${c.runningOn}`, 155),
    ogType: 'profile',
    body: body.filter(Boolean).join('\n'),
  };
}

function candidateItem(c: { id: string; name: string; runningOn: string } & Parameters<typeof chips>[0], route: string): string {
  const chipLine = chips(c);
  return `${link(route, c.name)}${chipLine ? ` (${esc(chipLine)})` : ''}: ${esc(cut(c.runningOn, 220))}`;
}

function electionRacePage(race: string, election: string, cards: ElectionCandidateCard[], note: ElectionRaceNote | null): Page {
  const info = raceInfo(race);
  const retention = race === 'judicial-retention';
  const sorted = [...cards].sort(retention ? (a, b) => a.name.localeCompare(b.name) : ballotOrder);
  const printed = sorted.filter((c) => !c.writeIn);
  const writeIns = sorted.filter((c) => c.writeIn);
  const date = electionDate(election);
  const item = (c: ElectionCandidateCard) => candidateItem(c, `election-candidate/${c.id}`);
  const body = [
    `<h1>${esc(info.label)}</h1>`,
    para(info.detail),
    para(`On the Chicago ballot ${date}.`),
    race.startsWith('judicial-')
      ? `<p>${esc(JUDICIAL_2026.detail)} ${outLink(JUDICIAL_2026.guideUrl, JUDICIAL_2026.guideLabel)}, ${outLink(JUDICIAL_2026.cbaUrl, JUDICIAL_2026.cbaLabel)}.</p>`
      : '',
    note ? para(note.note) : '',
    `<h2>${retention ? 'Judges' : 'On the ballot'}</h2>`,
    printed.length ? list(printed.map(item)) : para('No candidates are listed yet.'),
    writeIns.length ? `<h2>Write-in candidates</h2>\n${para(WRITE_IN_2026.explainer)}\n${list(writeIns.map(item))}` : '',
    electionTabLink,
  ];
  const names = printed.map((c) => c.name).join(', ');
  return {
    route: `election-race/${race}`,
    title: `${info.label}, ${date} ballot`,
    description: cut(
      `${info.label} on the Chicago ballot ${date}. ${info.detail}${names ? ` ${retention ? 'Judges' : 'Candidates'}: ${names}.` : ''}`,
      155
    ),
    ogType: 'website',
    body: body.filter(Boolean).join('\n'),
  };
}

function wardRacePage(ward: number, alderman: Official | null, cards: ElectionCandidateCard[], note: ElectionRaceNote | null): Page {
  const label = wardOrdinal(ward);
  const incumbentCard = cards.find((c) => c.incumbent) ?? null;
  const challengers = cards.filter((c) => c !== incumbentCard).sort(ballotOrder);
  const body = [
    `<h1>${esc(label)}: race for alderman</h1>`,
    para(`Alderman, on the ballot ${MUNICIPAL_ELECTION_DATE}. ${MUNICIPAL_2027_FILING}.`),
    alderman ? `<h2>The incumbent</h2>\n<p>${link(`official/${alderman.uid}`, alderman.name)}, ${esc(alderman.title)}</p>` : '',
    incumbentCard
      ? `<p>${link(`election-candidate/${incumbentCard.id}`, "What they say they're running on")}: ${esc(cut(incumbentCard.runningOn, 220))}</p>`
      : '',
    note ? para(note.note) : '',
    `<h2>${challengers.length ? 'Declared challengers' : 'Challengers'}</h2>`,
    challengers.length
      ? list(challengers.map((c) => candidateItem(c, `election-candidate/${c.id}`)))
      : para(
          'No declared challengers on record here yet. Candidates file October 19-26, 2026; this page fills in as they go public and file.'
        ),
    `<p>${link('officials', 'Every Chicago alderman')}</p>`,
    electionTabLink,
  ];
  const others = challengers.map((c) => c.name).join(', ');
  return {
    route: `ward-race/${ward}`,
    title: `${label} race for alderman, ${MUNICIPAL_ELECTION_DATE}`,
    description: cut(
      `The ${label} race for alderman on the ${MUNICIPAL_ELECTION_DATE} Chicago ballot.${
        alderman ? ` Alderman now: ${alderman.name}.` : ''
      }${others ? ` Declared challengers: ${others}.` : ' No challengers have declared yet.'}`,
      155
    ),
    ogType: 'website',
    body: body.filter(Boolean).join('\n'),
  };
}

function schoolBoardRacePage(race: string, cards: SchoolBoardCandidate[]): Page {
  const info = SCHOOL_BOARD_RACES.find((r) => r.id === race)!;
  const sorted = [...cards].sort(ballotOrder);
  const printed = sorted.filter((c) => !c.writeIn);
  const writeIns = sorted.filter((c) => c.writeIn);
  const item = (c: SchoolBoardCandidate) => candidateItem(c, `school-board-candidate/${c.id}`);
  const label = schoolBoardLabel(race);
  const body = [
    `<h1>${esc(label)}</h1>`,
    para(`${info.detail}. On the Chicago ballot ${SCHOOL_BOARD_ELECTION_DATE}. School board districts do not follow ward lines.`),
    '<h2>On the ballot</h2>',
    printed.length ? list(printed.map(item)) : para('No candidates are listed yet.'),
    writeIns.length ? `<h2>Write-in candidates</h2>\n${para(WRITE_IN_2026.explainer)}\n${list(writeIns.map(item))}` : '',
    electionTabLink,
  ];
  const names = printed.map((c) => c.name).join(', ');
  return {
    route: `school-board/${race}`,
    title: `${label}, ${SCHOOL_BOARD_ELECTION_DATE} ballot`,
    description: cut(
      `${label}, on the Chicago ballot ${SCHOOL_BOARD_ELECTION_DATE}. ${info.detail}.${names ? ` Candidates: ${names}.` : ''}`,
      155
    ),
    ogType: 'website',
    body: body.filter(Boolean).join('\n'),
  };
}

function schoolBoardCandidatePage(c: SchoolBoardCandidate): Page {
  const label = schoolBoardLabel(c.race);
  const title = `${c.name}, ${c.writeIn ? 'write-in candidate' : 'candidate'} for ${label}`;
  const chipLine = chipSentence(c);
  const body = [
    `<h1>${esc(c.name)}</h1>`,
    para(`${label}, on the Chicago ballot ${SCHOOL_BOARD_ELECTION_DATE}.${chipLine ? ` ${chipLine}` : ''}`),
    c.writeIn ? para(WRITE_IN_2026.explainer) : '',
    c.website ? `<p>${outLink(c.website, `Campaign site (${host(c.website)})`)}</p>` : '',
    '<h2>Running on</h2>',
    para(c.runningOn),
    c.priorCareer ? `<h2>Background</h2>\n${para(c.priorCareer)}` : '',
    sources(c.sourceUrls),
    `<p>${link(`school-board/${c.race}`, `Everyone in this race: ${label}`)}</p>`,
    electionTabLink,
  ];
  return {
    route: `school-board-candidate/${c.id}`,
    title,
    description: cut(`${title}. ${c.runningOn}`, 155),
    ogType: 'profile',
    body: body.filter(Boolean).join('\n'),
  };
}

function mayoralCandidatePage(c: Candidate, policies: Policy[], others: Candidate[]): Page {
  const live = policies.filter((p) => !p.archived).sort((a, b) => a.order - b.order);
  // Grouped by section header, in site order (the platform screen's layout).
  const sections: { name: string; items: Policy[] }[] = [];
  for (const p of live) {
    const last = sections[sections.length - 1];
    if (last && last.name === (p.section ?? '')) last.items.push(p);
    else sections.push({ name: p.section ?? '', items: [p] });
  }
  const policyHtml = sections
    .map((s) =>
      [
        s.name ? `<h3>${esc(s.name)}</h3>\n` : '',
        list(
          s.items.map(
            (p) => `${link(`candidate/${c.uid}/${p.id}`, p.title)}: ${esc(cut(plainPolicy(p.body), 220))}`
          )
        ),
      ].join('')
    )
    .join('\n');
  const summary = c.aiSummary;
  const body = [
    `<h1>${esc(c.name)}</h1>`,
    para(c.directory ? c.office : `${c.office}, Chicago, on the ballot ${MUNICIPAL_ELECTION_DATE}`),
    para(c.bio),
    c.websiteUrl ? `<p>${outLink(c.websiteUrl, 'Campaign website')}</p>` : '',
    // A success note opens the campaign's platform page in the app, so it links there.
    c.platformNote && c.platformNoteTone === 'success' && c.sourceUrl
      ? `<p>${outLink(c.sourceUrl, c.platformNote)}</p>`
      : para(c.platformNote),
    summary
      ? `<h2>AI summary</h2>\n<h3>The platform</h3>\n${paras(summary.summary)}\n<h3>Next to the other candidates</h3>\n${paras(summary.comparison)}`
      : '',
    '<h2>the more perfect platform</h2>',
    c.sourceUrl ? `<p>${outLink(c.sourceUrl, `Imported from ${host(c.sourceUrl)}`)}</p>` : '',
    live.length ? policyHtml : para('No policies are listed yet.'),
    others.length
      ? `<h2>The other mayoral candidates</h2>\n${list(others.map((o) => link(`candidate/${o.uid}`, o.name)))}`
      : '',
    electionTabLink,
  ];
  const title = c.directory ? `${c.name}, ${c.office}` : `${c.name}, ${c.office}, Chicago 2027`;
  const titles = live.map((p) => p.title).join('; ');
  return {
    route: `candidate/${c.uid}`,
    title,
    description: cut(
      `${c.name}, ${c.office}${c.directory ? '' : ` in Chicago, ${MUNICIPAL_ELECTION_DATE}`}.${
        titles ? ` ${c.directory ? 'Listed' : 'Platform'}: ${titles}.` : ''
      }`,
      155
    ),
    ogType: c.directory ? 'website' : 'profile',
    body: body.filter(Boolean).join('\n'),
  };
}

function officialPage(o: Official & { wardId: number }): Page {
  const contact = [
    ...(o.officeAddresses ?? []).map((a) => `Ward office: ${esc(a)}`),
    o.phone ? `Phone: ${esc(o.phone)}` : '',
    o.contactEmail ? `Email: ${outLink(`mailto:${o.contactEmail}`, o.contactEmail)}` : '',
    o.websiteUrl ? outLink(o.websiteUrl, `Website (${host(o.websiteUrl)})`) : '',
    o.newsletterUrl ? outLink(o.newsletterUrl, 'Ward newsletter') : '',
  ].filter(Boolean);
  const body = [
    `<h1>${esc(o.name)}</h1>`,
    para(`${o.title}, Chicago City Council.`),
    para(o.bio),
    contact.length ? `<h2>Contact</h2>\n${list(contact)}` : '',
    o.officeHours?.text ? `<h2>Office hours</h2>\n${para(o.officeHours.text)}` : '',
    '<h2>Questions on direct democracy</h2>',
    para(
      `Residents ask ${o.name} questions here in public and judge whether each response answers it. Questions asked: ${
        o.questionsAsked ?? 0
      }. Responded to: ${o.questionsResponded ?? 0}.`
    ),
    `<p>${link(`ward-race/${o.wardId}`, `The ${wardOrdinal(o.wardId)} race for alderman, ${MUNICIPAL_ELECTION_DATE}`)}</p>`,
    `<p>${link('officials', 'Every Chicago alderman')}</p>`,
  ];
  const office = o.officeAddresses?.[0]?.split(',')[0];
  return {
    route: `official/${o.uid}`,
    title: `${o.name}, ${o.title}`,
    description: cut(
      `${o.name}, ${o.title}, Chicago City Council.${
        office ? ` Ward office: ${office}.` : ''
      } Ask a question in public and see how residents judge the answers.`,
      155
    ),
    ogType: 'profile',
    body: body.filter(Boolean).join('\n'),
  };
}

function officialsPage(aldermen: (Official & { wardId: number })[]): Page {
  const body = [
    '<h1>Chicago aldermen</h1>',
    para(
      'Every Chicago alderman, by ward. Each one has a page where residents ask questions in public, rate the alderman, and judge whether the answers are real.'
    ),
    list(
      aldermen.map(
        (o) =>
          `${link(`official/${o.uid}`, o.name)}, ${esc(o.title)} (${link(`ward-race/${o.wardId}`, '2027 race')})`
      )
    ),
  ];
  return {
    route: 'officials',
    title: 'Chicago aldermen, all 50 wards',
    description: cut(
      'All 50 Chicago aldermen by ward, with ward office contacts. Ask an alderman a question in public and see how residents judge the answers.',
      155
    ),
    ogType: 'website',
    body: body.filter(Boolean).join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Rendering

const TITLE_TAG = `<title>${APP_NAME}</title>`;
const ROOT_DIV = '<div id="root"></div>';

function render(template: string, page: Page): string {
  const url = absolute(page.route);
  const fullTitle = `${page.title} | ${APP_NAME}`;
  const head = [
    `<title>${esc(fullTitle)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:site_name" content="${APP_NAME}" />`,
    `<meta property="og:type" content="${page.ogType}" />`,
    '<meta name="twitter:card" content="summary" />',
  ].join('\n    ');
  // The body style only undoes the app's scroll lock and flex row for the
  // moment before the app mounts (or for good, without JavaScript).
  const root = `<div id="root"><main style="flex:1;overflow:auto;padding:16px;font-family:system-ui,sans-serif;line-height:1.5;max-width:44rem">\n${page.body}\n</main></div>`;
  return template.replace(TITLE_TAG, head).replace(ROOT_DIV, root);
}

function sitemap(routes: string[]): string {
  const urls = routes.map((r) => `  <url><loc>${esc(absolute(r))}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// ---------------------------------------------------------------------------

function fail(message: string): never {
  console.error(`build-seo-pages: ${message}`);
  process.exit(1);
}

async function main() {
  const indexPath = path.join(OUT, 'index.html');
  if (!existsSync(indexPath)) fail(`${indexPath} not found; run \`npm run export-web\` first.`);
  const template = readFileSync(indexPath, 'utf8');
  for (const marker of [TITLE_TAG, ROOT_DIV]) {
    if (template.split(marker).length !== 2) fail(`expected exactly one ${marker} in dist-web/index.html`);
  }

  const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID }));
  const [electionSnap, notesSnap, schoolSnap, candidateSnap, officialSnap] = await Promise.all([
    db.collection('electionCandidates').get(),
    db.collection('electionRaceNotes').get(),
    db.collection('schoolBoardCandidates').get(),
    db.collection('candidates').get(),
    db.collection('officials').get(),
  ]);

  const electionCards = electionSnap.docs.map((d) => ({ ...(d.data() as ElectionCandidateCard), id: d.id }));
  const notes = new Map(notesSnap.docs.map((d) => [d.id, { ...(d.data() as ElectionRaceNote), id: d.id }]));
  const schoolCards = schoolSnap.docs.map((d) => ({ ...(d.data() as SchoolBoardCandidate), id: d.id }));
  const candidates = candidateSnap.docs
    .map((d) => ({ ...(d.data() as Candidate), uid: d.id }))
    .sort((a, b) => Number(!!a.directory) - Number(!!b.directory) || a.name.localeCompare(b.name));
  const aldermen = officialSnap.docs
    .map((d) => ({ ...(d.data() as Official), uid: d.id }))
    .filter((o): o is Official & { wardId: number } =>
      typeof o.wardId === 'number' && o.wardId >= 1 && o.wardId <= 50 && o.wardId !== TEST_WARD
    )
    .sort((a, b) => a.wardId - b.wardId);

  const empty = [
    ['electionCandidates', electionCards.length],
    ['schoolBoardCandidates', schoolCards.length],
    ['candidates', candidates.length],
    ['officials (wards 1-50)', aldermen.length],
  ].filter(([, n]) => n === 0);
  if (empty.length) fail(`Firestore returned no documents for ${empty.map(([c]) => c).join(', ')}; refusing to publish empty pages.`);
  if (aldermen.length !== 50) console.warn(`build-seo-pages: warning, ${aldermen.length} aldermen found, expected 50`);

  const policyLists = await Promise.all(
    candidates.map((c) =>
      db
        .collection('candidates')
        .doc(c.uid)
        .collection('policies')
        .get()
        .then((s) => s.docs.map((d) => ({ ...(d.data() as Policy), id: d.id })))
    )
  );

  const pages: Page[] = [];
  const counts: Record<string, number> = {};
  const add = (kind: string, page: Page) => {
    const id = page.route.split('/').pop()!;
    if (!safeId(id)) {
      console.warn(`build-seo-pages: skipping ${page.route} (id is not a safe file name)`);
      return;
    }
    pages.push(page);
    counts[kind] = (counts[kind] ?? 0) + 1;
  };

  // Races: every known race id that has a card (ward races use /ward-race).
  const byRace = new Map<string, ElectionCandidateCard[]>();
  for (const c of electionCards) {
    const key = `${c.election}--${c.race}`;
    byRace.set(key, [...(byRace.get(key) ?? []), c]);
  }
  const racePages = new Set<string>();
  for (const [key, cards] of [...byRace].sort(([a], [b]) => a.localeCompare(b))) {
    const { election, race } = cards[0];
    if (/^ward-\d+$/.test(race)) continue;
    if (!isKnownRace(race)) {
      console.warn(`build-seo-pages: no race page for unknown race ${key}`);
      continue;
    }
    if (raceInfo(race).election !== election) {
      // The app's /election-race/<id> resolves this id to the other ballot's race.
      console.warn(`build-seo-pages: no race page for ${key}: /election-race/${race} opens the ${raceInfo(race).election} race`);
      continue;
    }
    racePages.add(key);
    add('election races', electionRacePage(race, election, cards, notes.get(key) ?? null));
  }
  for (const c of [...electionCards].sort((a, b) => a.id.localeCompare(b.id))) {
    const ward = c.race.match(/^ward-(\d+)$/);
    const hasPage = ward ? Number(ward[1]) >= 1 && Number(ward[1]) <= 50 : racePages.has(`${c.election}--${c.race}`);
    add('election candidates', electionCandidatePage(c, hasPage));
  }

  for (let ward = 1; ward <= 50; ward++) {
    const race = `ward-${ward}`;
    add(
      'ward races',
      wardRacePage(
        ward,
        aldermen.find((o) => o.wardId === ward) ?? null,
        electionCards.filter((c) => c.election === MUNICIPAL_ELECTION && c.race === race),
        notes.get(`${MUNICIPAL_ELECTION}--${race}`) ?? null
      )
    );
  }

  for (const r of SCHOOL_BOARD_RACES) {
    add('school board races', schoolBoardRacePage(r.id, schoolCards.filter((c) => c.race === r.id)));
  }
  for (const c of [...schoolCards].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!SCHOOL_BOARD_RACES.some((r) => r.id === c.race)) {
      console.warn(`build-seo-pages: ${c.id} has unknown school board race ${c.race}`);
    }
    add('school board candidates', schoolBoardCandidatePage(c));
  }

  candidates.forEach((c, i) => {
    const others = candidates.filter((o) => o.uid !== c.uid);
    add('mayoral candidates', mayoralCandidatePage(c, policyLists[i], others));
  });

  for (const o of aldermen) add('aldermen', officialPage(o));
  add('officials directory', officialsPage(aldermen));

  // Write: clear what this script owns, then every page and the sitemap.
  for (const name of OWNED) rmSync(path.join(OUT, name), { recursive: true, force: true });
  for (const page of pages) {
    const file = path.join(OUT, ...page.route.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, render(template, page));
  }
  const sitemapRoutes = [...TAB_ROUTES, ...pages.map((p) => p.route)];
  writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap(sitemapRoutes));

  for (const [kind, n] of Object.entries(counts)) console.log(`${kind.padEnd(26)} ${n}`);
  console.log(`${'pages written'.padEnd(26)} ${pages.length}`);
  console.log(`${'sitemap URLs'.padEnd(26)} ${sitemapRoutes.length}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
