/**
 * Development and zoning by ward (2026-10-05): the zoning changes a
 * resident can weigh in on and the hearings where they can, synced daily
 * into zoningItems/{id} (world-readable, admin-written, no client writes).
 *
 * - council-<record>: zoning map amendments in committee at the City
 *   Clerk (eLMS, matterCategory ZONING RECLASSIFICATIONS). The Clerk has no
 *   ward field, so the ward is the filing alderman's office when an alderman
 *   filed it, else the first address in the title, geocoded once. When one
 *   is on an upcoming Committee on Zoning agenda, the agenda (a text PDF
 *   that names the ward, applicant, requested change, and purpose of every
 *   item) adds the hearing and those details.
 * - zba-<case>: cases on the Zoning Board of Appeals' posted agenda
 *   (variations and special uses; every item names its ward).
 * - cpc-<month>-<n>: items on the Chicago Plan Commission's monthly hearing
 *   page (Planned Developments, the big projects; one item can span wards).
 *
 * Text is shown as the city writes it. A matter that leaves committee and
 * a hearing that has passed drop out on the next run.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { extractText, getDocumentProxy } from 'unpdf';

import { pointForAddress, wardForPoint } from './ward';

const ELMS = 'https://api.chicityclerkelms.chicago.gov';
const CHICAGO = 'https://www.chicago.gov';
/** chicago.gov answers bots with a 403 page; it serves browsers. */
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const ZONING_COMMITTEE = 'Committee on Zoning, Landmarks and Building Standards';
const ZBA_INDEX = `${CHICAGO}/content/city/en/depts/dcd/zoning-board-of-appeals/meetings--calendars-and-minutes.html`;
const CPC_INDEX = `${CHICAGO}/content/city/en/depts/dcd/chicago-plan-commission/meetings--agendas---video-archives.html`;
/** Older filings still in committee are usually abandoned; skip them. */
const FILED_WITHIN_DAYS = 540;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type ZoningSource = 'council' | 'zba' | 'cpc';

interface Hearing {
  body: string;
  date: Timestamp;
  location: string | null;
  commentDeadline: Timestamp | null;
  agendaUrl: string | null;
}

async function elms<T>(path: string): Promise<T> {
  // Same quirk as council.ts: no accept header, and a string body is
  // JSON encoded twice.
  const resp = await fetch(`${ELMS}${path}`, { signal: AbortSignal.timeout(20_000) });
  if (!resp.ok) throw new Error(`eLMS ${path} -> ${resp.status}`);
  const body: unknown = await resp.json();
  return (typeof body === 'string' ? JSON.parse(body) : body) as T;
}

async function fetchCity(url: string): Promise<Response> {
  const resp = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) });
  if (!resp.ok) throw new Error(`${url} -> ${resp.status}`);
  return resp;
}

async function pdfText(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetchCity(url)).arrayBuffer());
  const { text } = await extractText(await getDocumentProxy(buf), { mergePages: true });
  return text;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function decodeHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** "October 16, 2026" + "9:00 A.M." -> that moment in Chicago. */
function chicagoTime(dateText: string, timeText = '10:00 A.M.'): Date | null {
  const d = dateText.match(/([A-Z][a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  const t = timeText.match(/(\d{1,2}):(\d{2})\s*([AP])\.?M/i);
  if (!d) return null;
  const month = MONTHS.findIndex((m) => m.startsWith(d[1].slice(0, 3)));
  if (month < 0) return null;
  let hour = t ? Number(t[1]) % 12 : 10;
  if (t && t[3].toUpperCase() === 'P') hour += 12;
  const minute = t ? Number(t[2]) : 0;
  // Chicago is UTC-5 in daylight time, UTC-6 otherwise; find which applies.
  for (const offset of [5, 6]) {
    const guess = new Date(Date.UTC(Number(d[3]), month, Number(d[2]), hour + offset, minute));
    const shown = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(guess);
    if (Number(shown) === hour) return guess;
  }
  return null;
}

/**
 * The first street address in a Clerk title: "Zoning Reclassification Map
 * No. 2-I at 2400 W Grenshaw St a.k.a. 1124 S Western Ave - App No. 23149T1"
 * -> "2400 W Grenshaw St". A range "7353-7359 S Indiana Ave" keeps its
 * first number.
 */
export function titleAddress(title: string): string | null {
  const m = title.match(/\bat\s+(.+?)\s*-\s*App\b/i) ?? title.match(/\bat\s+(.+)$/i);
  if (!m) return null;
  const segment = m[1].split(/\s+a\.?k\.?a\.?\s+/i)[0];
  // The first number that a street name follows: "4916, 4918 and 4920 W
  // Irving Park Rd" -> "4920 W Irving Park Rd" (same block, same ward).
  const a = segment.match(
    /(\d+)[A-Z]?(?:-\d+[A-Z]?)?\s+((?!and\b|&)(?:[NSEW]\.?\s+)?\d*[A-Za-z][^,;&]*?)(?=\s*(?:,|;|&|\s+and\s+|$))/i
  );
  return a ? `${a[1]} ${a[2].trim()}` : null;
}

function appNumber(title: string): string | null {
  const m = title.match(/App(?:lication)?\.?\s*No\.?\s*([A-Z0-9-]+)/i);
  return m && m[1] !== 'TBD' ? m[1] : null;
}

/** Zoning map amendments still in committee, each with its ward. */
async function syncCouncilFilings(db: Firestore, seen: Set<string>): Promise<number> {
  const since = new Date(Date.now() - FILED_WITHIN_DAYS * 86_400_000).toISOString();
  const filter = `matterCategory eq 'ZONING RECLASSIFICATIONS' and introductionDate gt ${since}`;
  let skip = 0;
  let written = 0;
  for (;;) {
    const page = await elms<{
      data: {
        matterId: string;
        recordNumber: string;
        title: string;
        status: string;
        filingOffice: string | null;
        introductionDate: string;
      }[];
      meta: { count: number };
    }>(`/matter?filter=${encodeURIComponent(filter)}&top=500&skip=${skip}`);
    for (const m of page.data) {
      if (!m.status.startsWith('4-')) continue; // only what's still before the committee
      const id = `council-${m.recordNumber}`;
      seen.add(id);
      const ref = db.doc(`zoningItems/${id}`);
      const existing = (await ref.get()).data();
      let wardIds = existing?.wardIds as number[] | undefined;
      const address = titleAddress(m.title);
      if (!wardIds?.length) {
        const office = Number(m.filingOffice);
        if (Number.isInteger(office) && office >= 1 && office <= 50) {
          wardIds = [office];
        } else if (address) {
          try {
            const point = await pointForAddress(`${address}, Chicago, IL`);
            const ward = point ? wardForPoint(point.lon, point.lat) : null;
            wardIds = ward ? [ward] : [];
          } catch (err) {
            console.warn(`Geocoding ${address} failed; retried next run:`, err);
            continue;
          }
        } else {
          wardIds = [];
        }
      }
      await ref.set(
        {
          source: 'council',
          recordNumber: m.recordNumber,
          appNumber: appNumber(m.title),
          // A hearing agenda's address is the city's own wording; keep it.
          address: existing?.hearing ? existing.address : address,
          title: m.title,
          wardIds,
          filedAt: Timestamp.fromDate(new Date(m.introductionDate)),
          url: `https://chicityclerkelms.chicago.gov/Matter/?matterId=${m.matterId}`,
          syncedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      written += 1;
    }
    skip += page.data.length;
    if (page.data.length === 0 || skip >= page.meta.count) break;
  }
  return written;
}

interface AgendaItem {
  ward: number;
  recordNumber: string;
  address: string | null;
  applicant: string | null;
  changeRequest: string | null;
  purpose: string | null;
}

/** Map amendments on a Committee on Zoning agenda ("NO. 23135 (3rd WARD) ..."). */
export function parseZoningAgenda(text: string): AgendaItem[] {
  const items: AgendaItem[] = [];
  const blocks = text.split(/\n(?=NO\.\s*\S+\s*\(\d+\w*\s*WARD\))/i).slice(1);
  for (const block of blocks) {
    const head = block.match(/^NO\.\s*\S+\s*\((\d+)\w*\s*WARD\)/i);
    const doc = block.match(/DOCUMENT\s*#\s*([A-Za-z]+\d{4}-\s*\d+)/);
    if (!head || !doc) continue;
    const field = (name: string) => {
      const m = block.match(new RegExp(`${name}:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Za-z ]+:|\\nAdministrative Adjustment|$)`));
      // A page break leaves the page number behind the last field.
      return m ? clean(m[1]).replace(/\s+\d{1,3}$/, '') || null : null;
    };
    items.push({
      ward: Number(head[1]),
      // "O2026- 0026090" (a stray space) is the same record as O2026-0026090.
      recordNumber: doc[1].replace(/\s+/g, ''),
      address: field('Common Address'),
      applicant: field('Applicant'),
      changeRequest: field('Change Request'),
      purpose: field('Purpose'),
    });
  }
  return items;
}

/** Upcoming Committee on Zoning hearings: put each agenda item's hearing on its filing. */
async function syncZoningHearings(db: Firestore, seen: Set<string>): Promise<number> {
  const now = new Date().toISOString();
  const meetings = await elms<{ data: { meetingId: string; status: string; date: string; location: string | null }[] }>(
    `/meeting?filter=${encodeURIComponent(`body eq '${ZONING_COMMITTEE}' and date ge ${now}`)}&sort=${encodeURIComponent('date asc')}&top=10`
  );
  let written = 0;
  for (const m of meetings.data) {
    if (/cancel/i.test(m.status)) continue;
    const agenda = await elms<{
      publicCommentDeadline?: string | null;
      files?: { path: string; attachmentType: string; sort?: number }[];
    }>(`/meeting-agenda/${m.meetingId}`);
    const pdf = (agenda.files ?? [])
      .filter((f) => f.attachmentType === 'Agenda')
      .sort((x, y) => (y.sort ?? 0) - (x.sort ?? 0))[0]?.path;
    if (!pdf) continue; // the agenda lands a week or so before the hearing
    const hearing: Hearing = {
      body: ZONING_COMMITTEE,
      date: Timestamp.fromDate(new Date(m.date)),
      location: m.location ?? null,
      commentDeadline: agenda.publicCommentDeadline
        ? Timestamp.fromDate(new Date(agenda.publicCommentDeadline))
        : null,
      agendaUrl: pdf,
    };
    for (const item of parseZoningAgenda(await pdfText(pdf))) {
      const id = `council-${item.recordNumber}`;
      seen.add(id);
      await db.doc(`zoningItems/${id}`).set(
        {
          source: 'council',
          recordNumber: item.recordNumber,
          // The agenda names the ward; it outranks a geocoded guess.
          wardIds: [item.ward],
          ...(item.address ? { address: item.address } : {}),
          applicant: item.applicant,
          changeRequest: item.changeRequest,
          purpose: item.purpose,
          hearing,
          syncedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      written += 1;
    }
  }
  return written;
}

/** Cases on a Zoning Board of Appeals agenda ("362-26-Z ZONING DISTRICT: RS-3 WARD: 47"). */
export function parseZbaAgenda(text: string): {
  dateText: string | null;
  location: string | null;
  items: { caseNo: string; ward: number; time: string; applicant: string | null; address: string | null; subject: string | null }[];
} {
  const header = text.match(/(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY)\W+([A-Z][a-z]+ \d{1,2}, \d{4})/i);
  const location = text.match(/\n(121 N\. LaSalle[^\n]*)/i)?.[1] ?? null;
  const items = [];
  let time = '9:00 A.M.';
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].match(/^\s*(\d{1,2}:\d{2}\s*[AP]\.M\.)\s*$/i);
    if (t) time = t[1];
    const head = lines[i].match(/^\s*(\d+-\d{2}-[SZ])\s+ZONING DISTRICT:.*WARD:\s*(\d+)/);
    if (!head) continue;
    const block: string[] = [];
    for (let j = i + 1; j < lines.length && !/^\s*\d+-\d{2}-[SZ]\s+ZONING DISTRICT/.test(lines[j]); j++) {
      if (/^\s*\d{1,2}:\d{2}\s*[AP]\.M\.\s*$/i.test(lines[j])) break;
      block.push(lines[j]);
    }
    const body = block.join('\n');
    const field = (name: string) => {
      const m = body.match(new RegExp(`${name}:\\s*([\\s\\S]*?)(?=\\n[A-Z ]+:|$)`));
      return m ? clean(m[1]) || null : null;
    };
    items.push({
      caseNo: head[1],
      ward: Number(head[2]),
      time,
      applicant: field('APPLICANT'),
      address: field('PREMISES AFFECTED'),
      // Page numbers and section headings trail the last subject line.
      subject:
        field('SUBJECT')
          ?.replace(/\s+(Approval of the written resolutions|Adjournment|Regular Call|Continuances?)\b.*$/i, '')
          .replace(/\s+\d{1,3}$/, '') ?? null,
    });
  }
  return { dateText: header?.[1] ?? null, location, items };
}

async function syncZba(db: Firestore, seen: Set<string>): Promise<number> {
  const index = await (await fetchCity(ZBA_INDEX)).text();
  const pdfs = [...new Set([...index.matchAll(/href="([^"]+_Agenda\.pdf)"/gi)].map((m) => m[1]))];
  let written = 0;
  for (const path of pdfs) {
    const url = path.startsWith('http') ? path : `${CHICAGO}${path}`;
    const agenda = parseZbaAgenda(await pdfText(url));
    const day = agenda.dateText ? chicagoTime(agenda.dateText, '11:59 P.M.') : null;
    if (!agenda.dateText || !day || day.getTime() < Date.now()) continue;
    for (const item of agenda.items) {
      const date = chicagoTime(agenda.dateText, item.time) ?? day;
      const id = `zba-${item.caseNo}`;
      seen.add(id);
      await db.doc(`zoningItems/${id}`).set({
        source: 'zba',
        caseNo: item.caseNo,
        kind: item.caseNo.endsWith('-S') ? 'special-use' : 'variation',
        wardIds: [item.ward],
        address: item.address,
        applicant: item.applicant,
        purpose: item.subject,
        hearing: {
          body: 'Zoning Board of Appeals',
          date: Timestamp.fromDate(date),
          location: agenda.location,
          commentDeadline: null,
          agendaUrl: url,
        } satisfies Hearing,
        url,
        syncedAt: FieldValue.serverTimestamp(),
      });
      written += 1;
    }
  }
  return written;
}

/** Wards named in a Plan Commission address cell: "(Lake View, 44th Ward)", "(7th and 10th Wards)". */
export function cpcWards(cell: string): number[] {
  const m = cell.match(/\(([^()]*Wards?)\)\s*$/i);
  if (!m) return [];
  return [...m[1].matchAll(/(\d+)(?:st|nd|rd|th)/g)].map((x) => Number(x[1])).filter((n) => n >= 1 && n <= 50);
}

async function syncPlanCommission(db: Firestore, seen: Set<string>): Promise<number> {
  const index = await (await fetchCity(CPC_INDEX)).text();
  const now = new Date();
  let written = 0;
  // This month's hearing and next month's, whichever are posted.
  for (const offset of [0, 1]) {
    const when = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const name = `${MONTHS[when.getUTCMonth()]}_${when.getUTCFullYear()}_Plan_Commission_Hearing.html`;
    const path = index.match(new RegExp(`href="([^"]*${name})"`))?.[1];
    if (!path) continue;
    const pageUrl = path.startsWith('http') ? path : `${CHICAGO}${path}`;
    const html = await (await fetchCity(pageUrl)).text();
    const note = decodeHtml(html.match(/NOTE:[\s\S]{0,400}?<\/h\d>/i)?.[0] ?? '');
    const dateText =
      note.match(/([A-Z][a-z]+ \d{1,2})(?:st|nd|rd|th)?\s+meeting/)?.[1] ??
      decodeHtml(html).match(/Chicago Plan Commission\s+([A-Z][a-z]+ \d{1,2}, \d{4})/)?.[1];
    const timeText = note.match(/(\d{1,2}:\d{2}\s*[AP]M)/i)?.[1]?.replace(/([AP])M/i, '$1.M.');
    const date = dateText
      ? chicagoTime(/\d{4}/.test(dateText) ? dateText : `${dateText}, ${when.getUTCFullYear()}`, timeText)
      : null;
    if (!date || date.getTime() < Date.now() - 86_400_000) continue;
    const location = clean(note.match(/held at [^,]*,?\s*in ([^\n]+?)\.?$/m)?.[1] ?? '') || null;
    const table = html.match(/Address \(Community Area, Ward\)[\s\S]*?<\/table>/i)?.[0] ?? '';
    // The match starts inside the header row, so every <tr> here is an item.
    const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
    let n = 0;
    for (const row of rows) {
      const cells = [...row[0].matchAll(/<td[\s\S]*?<\/td>/gi)].map((c) => c[0]);
      if (cells.length < 2) continue;
      const place = clean(decodeHtml(cells[0]));
      const wards = cpcWards(place);
      if (wards.length === 0) continue;
      const files = [...cells.slice(2).join('').matchAll(/href="([^"]+\.pdf)"/gi)].map((f) =>
        f[1].startsWith('http') ? f[1] : `${CHICAGO}${f[1]}`
      );
      n += 1;
      const id = `cpc-${date.toISOString().slice(0, 7)}-${n}`;
      seen.add(id);
      await db.doc(`zoningItems/${id}`).set({
        source: 'cpc',
        wardIds: wards,
        address: clean(place.replace(/\([^()]*Wards?\)\s*$/i, '')) || null,
        purpose: clean(decodeHtml(cells[1])),
        hearing: {
          body: 'Chicago Plan Commission',
          date: Timestamp.fromDate(date),
          location,
          commentDeadline: null,
          agendaUrl: pageUrl,
        } satisfies Hearing,
        url: files[0] ?? pageUrl,
        syncedAt: FieldValue.serverTimestamp(),
      });
      written += 1;
    }
  }
  return written;
}

/**
 * The whole sync. Each source runs on its own; a source that fails keeps
 * its existing items (only the sources that finished prune what they no
 * longer list).
 */
export async function syncZoning(db: Firestore): Promise<string> {
  const report: string[] = [];
  const pruneable: ZoningSource[] = [];
  const seen = new Set<string>();
  const steps: [ZoningSource | 'council-hearings', () => Promise<number>][] = [
    ['council', () => syncCouncilFilings(db, seen)],
    ['council-hearings', () => syncZoningHearings(db, seen)],
    ['zba', () => syncZba(db, seen)],
    ['cpc', () => syncPlanCommission(db, seen)],
  ];
  let councilOk = true;
  for (const [name, run] of steps) {
    try {
      report.push(`${name} ${await run()}`);
      if (name !== 'council-hearings') pruneable.push(name);
    } catch (err) {
      console.error(`Zoning ${name} sync failed:`, err);
      if (name.startsWith('council')) councilOk = false;
      report.push(`${name} failed`);
    }
  }
  let removed = 0;
  for (const source of pruneable) {
    if (source === 'council' && !councilOk) continue;
    const docs = await db.collection('zoningItems').where('source', '==', source).get();
    for (const d of docs.docs) {
      if (!seen.has(d.id)) {
        await d.ref.delete();
        removed += 1;
      }
    }
  }
  return `${report.join(', ')}, ${removed} removed`;
}
