/**
 * Ward newsletters: the meetings each ward office announces, and an AI
 * summary of every issue and of each week across the wards (2026-10-05).
 *
 * Sources are scripts/data/ward-newsletters.json: a ward's feed (rssUrl;
 * Mailchimp and WordPress) or, for Constant Contact offices, its archive
 * page (archiveUrl), whose issue links are harvested. Email-only lists are
 * not covered until an inbox is subscribed to them.
 *
 * The reading is done by Claude in the daily scheduled task
 * ("ward-newsletter-digest"), with ONE fixed prompt for every ward
 * (scripts/data/newsletter-prompt.md). This script only moves data:
 *
 *   gcloud auth application-default login
 *   npm run newsletters -- pull --out <queue.json>      new issues, as text, to read
 *   npm run newsletters -- apply <results.json>         write summaries + meetings
 *   npm run newsletters -- recent --days 7 --out <f>    this week's summaries, for the digest
 *   npm run newsletters -- digest <digest.json>         write the week's digest
 *
 * Production collections (public read, Admin SDK only): newsletterIssues,
 * wardMeetings, newsletterDigests. newsletterSeen (no client access) keeps
 * every issue id already handled, so nothing is read twice.
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

const app = initializeApp({ credential: applicationDefault(), projectId: 'direct-democracy-e338a' });
const db = getFirestore(app);

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
/** The first time a source is read, only issues this recent are queued. */
const BACKFILL_DAYS = 14;
/** ...and an archive page (no dates) gives its first few links. */
const BACKFILL_LINKS = 2;
const MAX_TEXT = 40_000;
const MIN_TEXT = 600;

interface Source {
  ward: number;
  url: string | null;
  rssUrl?: string | null;
  /** A page listing issue links (Constant Contact offices without a feed). */
  archiveUrl?: string | null;
  /** The archive page lists its oldest issue first. */
  archiveOldestFirst?: boolean;
  /**
   * Who sends this ward's newsletter to the inbox: full addresses
   * ("info@40thward.org") or domains ("@40thward.org"). Learned from the
   * mail itself; the daily task adds a sender the first time it shows up.
   */
  senders?: string[];
}

/**
 * The newsletter inbox (2026-10-05): a Gmail account subscribed to every
 * ward list, read over IMAP with an app password kept OUTSIDE the repo in
 * ~/.config/direct-democracy/newsletter-inbox.env:
 *   NEWSLETTER_IMAP_USER=...@gmail.com
 *   NEWSLETTER_IMAP_PASSWORD=<16-character app password>
 * Without the file the inbox is skipped and only feeds/archives are read.
 */
const INBOX_ENV = join(homedir(), '.config', 'direct-democracy', 'newsletter-inbox.env');
const INBOX_DAYS = 14;

interface QueuedIssue {
  id: string;
  ward: number;
  title: string;
  /** The public web copy of the issue; null for an email-only issue with none. */
  url: string | null;
  sentAt: string;
  text: string;
  /**
   * The ward's meetings already on its page with no time found (2026-10-12),
   * so the reader can tell when this issue gives one's time (`resolves`).
   */
  undated?: { id: string; title: string; date: string | null }[];
}

interface ResultMeeting {
  title: string;
  kind: 'development' | 'ward' | 'community';
  /**
   * ISO 8601 with the Chicago offset, e.g. 2026-10-14T18:00:00-05:00; null
   * when the issue announces the meeting without a time (2026-10-12).
   */
  start: string | null;
  /** With start null: the day the issue gives (YYYY-MM-DD), else null. */
  date?: string | null;
  end?: string | null;
  place?: string | null;
  address?: string | null;
  online?: boolean;
  url?: string | null;
}

interface Result {
  id: string;
  /** The issue is old news (an archive link with no date): mark it read, write nothing. */
  skip?: boolean;
  /** The send date the issue itself states, when the queue's date is only "first seen". */
  sentAt?: string;
  summary: string;
  summaryEs: string;
  /** The ward office's regular hours / ward night, when the issue states them. */
  officeHours?: { text: string; textEs: string } | null;
  meetings: ResultMeeting[];
  /** Ids from the queue's `undated` list that this issue gives a time for. */
  resolves?: string[];
}

const issueId = (ward: number, url: string) =>
  `w${ward}-${createHash('sha1').update(url.replace(/[?#].*$/, '')).digest('hex').slice(0, 12)}`;

async function get(url: string): Promise<string> {
  const resp = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) });
  if (!resp.ok) throw new Error(`${url} -> ${resp.status}`);
  return resp.text();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;|&#8217;|&#8216;/g, "'")
    .replace(/&rdquo;|&ldquo;|&#8220;|&#8221;/g, '"')
    .replace(/&ndash;|&mdash;|&#8211;|&#8212;/g, '-')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** Readable text from an email's HTML, keeping each link's address (RSVPs live there). */
export function htmlToText(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(head|style|script|title)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\b[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => {
      const label = inner.replace(/<[^>]+>/g, '').trim();
      // Unsubscribe, preference, and share links say nothing about the ward.
      if (/unsubscribe|list-manage\.com\/(profile|unsubscribe)|forward-to-friend|mailto:|facebook\.com\/sharer|twitter\.com\/intent/i.test(href))
        return label;
      // Square brackets: an angle-bracketed URL would be stripped as a tag below.
      return label ? `${label} [${href.slice(0, 200)}]` : '';
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr|table|section)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s)
    // Preheader padding: invisible joiners and soft hyphens by the hundred.
    .replace(/[\u00ad\u034f\u200b-\u200f\u2060\ufeff]/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter((l) => l && !/^[-|\u2022\s]+$/.test(l))
    .join('\n');
  // Mailchimp and Constant Contact footers (copyright, mailing address,
  // "why did I get this") follow the last real content.
  const cut = s.search(/\n(Copyright ©|You are receiving this|Our mailing address is|Want to change how you receive)/i);
  return (cut > 0 ? s.slice(0, cut) : s).slice(0, MAX_TEXT);
}

function rssItems(xml: string): { title: string; link: string; date: string | null; html: string }[] {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => {
    const it = m[0];
    const tag = (name: string) => {
      const t = it.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '';
      return t.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
    };
    return {
      title: decodeEntities(tag('title')),
      link: decodeEntities(tag('link')),
      date: tag('pubDate') || null,
      html: tag('content:encoded') || tag('description'),
    };
  });
}

/** Issue links on a Constant Contact archive page, in page order. */
function archiveLinks(html: string): string[] {
  const links = [...html.matchAll(/href="(https?:\/\/(?:conta\.cc\/[^"]+|myemail\.constantcontact\.com\/[^"]+|campaign\.r20\.constantcontact\.com\/render[^"]+))"/gi)].map(
    (m) => decodeEntities(m[1])
  );
  return [...new Set(links)];
}

async function seen(id: string): Promise<boolean> {
  return (await db.doc(`newsletterSeen/${id}`).get()).exists;
}

async function markSeen(id: string, ward: number | null, how: string) {
  await db.doc(`newsletterSeen/${id}`).set({ ward, how, at: FieldValue.serverTimestamp() });
}

async function pull(out: string) {
  const sources: Source[] = JSON.parse(readFileSync(join(__dirname, 'data', 'ward-newsletters.json'), 'utf8'));
  const queue: QueuedIssue[] = [];
  const problems: string[] = [];
  for (const src of sources) {
    const firstRun = (await db.collection('newsletterSeen').where('ward', '==', src.ward).limit(1).get()).empty;
    try {
      if (src.rssUrl) {
        for (const item of rssItems(await get(src.rssUrl))) {
          if (!item.link) continue;
          const id = issueId(src.ward, item.link);
          if (await seen(id)) continue;
          const sent = item.date ? new Date(item.date) : new Date();
          if (firstRun && Date.now() - sent.getTime() > BACKFILL_DAYS * 86_400_000) {
            await markSeen(id, src.ward, 'backfill-skipped');
            continue;
          }
          const text = htmlToText(item.html);
          // Some feeds carry only the subject line; there is nothing to read.
          if (text.length < MIN_TEXT) {
            await markSeen(id, src.ward, 'empty');
            continue;
          }
          queue.push({ id, ward: src.ward, title: item.title, url: item.link, sentAt: sent.toISOString(), text });
        }
      } else if (src.archiveUrl) {
        const found = archiveLinks(await get(src.archiveUrl));
        const links = src.archiveOldestFirst ? found.reverse() : found;
        for (const [i, link] of links.entries()) {
          const id = issueId(src.ward, link);
          if (await seen(id)) continue;
          if (firstRun && i >= BACKFILL_LINKS) {
            await markSeen(id, src.ward, 'backfill-skipped');
            continue;
          }
          const html = await get(link);
          const title = decodeEntities(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? `Ward ${src.ward} newsletter`);
          // An archive page has no send dates; the day it first appears stands in.
          queue.push({ id, ward: src.ward, title, url: link, sentAt: new Date().toISOString(), text: htmlToText(html) });
        }
      }
    } catch (err) {
      problems.push(`ward ${src.ward}: ${(err as Error).message}`);
    }
  }
  const inbox = await pullInbox(sources, queue, problems);
  const undated = new Map<number, QueuedIssue['undated']>();
  for (const ward of new Set(queue.map((q) => q.ward))) {
    const snap = await db.collection('wardMeetings').where('wardId', '==', ward).where('start', '==', null).get();
    undated.set(
      ward,
      snap.docs
        .filter((d) => (d.get('expiresAt') as Timestamp).toMillis() > Date.now())
        .map((d) => ({ id: d.id, title: d.get('title'), date: d.get('date') ?? null }))
    );
  }
  for (const q of queue) if (undated.get(q.ward)?.length) q.undated = undated.get(q.ward);
  writeFileSync(out, JSON.stringify(queue, null, 2));
  console.log(`${queue.length} new issue(s) from ${new Set(queue.map((q) => q.ward)).size} ward(s) -> ${out}`);
  for (const p of problems) console.warn(`  could not read ${p}`);
  if (inbox) {
    const side = out.replace(/\.json$/, '') + '.inbox.json';
    // A rerun within the same run (after mapping senders) keeps the
    // confirmations the first pull reported, since they are now marked seen.
    if (existsSync(side)) {
      const before: InboxReport = JSON.parse(readFileSync(side, 'utf8'));
      inbox.confirmations = [...(before.confirmations ?? []), ...inbox.confirmations];
    }
    writeFileSync(side, JSON.stringify(inbox, null, 2));
    console.log(
      `inbox: ${inbox.read} message(s) read, ${inbox.unmatched.length} from senders not yet mapped to a ward, ` +
        `${inbox.confirmations.length} new subscription confirmation email(s) -> ${side}`
    );
  }
}

function inboxCredentials(): { user: string; pass: string } | null {
  if (!existsSync(INBOX_ENV)) return null;
  const env = Object.fromEntries(
    readFileSync(INBOX_ENV, 'utf8')
      .split('\n')
      .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])
  );
  const user = env.NEWSLETTER_IMAP_USER;
  const pass = (env.NEWSLETTER_IMAP_PASSWORD ?? '').replace(/\s+/g, '');
  return user && pass ? { user, pass } : null;
}

function wardForSender(sources: Source[], from: string): number | null {
  const addr = from.toLowerCase();
  for (const src of sources) {
    for (const s of src.senders ?? []) {
      const want = s.toLowerCase();
      if (want.startsWith('@') ? addr.endsWith(want) : addr === want) return src.ward;
    }
  }
  return null;
}

/** "View this email in your browser" / "View as webpage": the issue's public copy. */
function webCopyUrl(html: string): string | null {
  const m =
    html.match(/href="(https:\/\/(?:mailchi\.mp|us\d+\.campaign-archive\.com|conta\.cc|myemail\.constantcontact\.com)\/[^"]+)"[^>]*>[^<]*(?:<[^>]+>[^<]*)*?(?:view|browser|webpage|web page|online)/i) ??
    html.match(/href="(https:\/\/(?:mailchi\.mp|us\d+\.campaign-archive\.com|conta\.cc|myemail\.constantcontact\.com)\/[^"]+)"/i);
  return m ? decodeEntities(m[1]) : null;
}

interface InboxReport {
  read: number;
  /** Mail from a sender no ward claims yet: the daily task maps it (senders) and reruns pull. */
  unmatched: { from: string; subject: string; date: string; text: string }[];
  /**
   * Double opt-in emails that arrived since the last pull; reported once
   * each, never clicked by the task. Whether one was clicked can't be seen
   * from the inbox, so an old one is never reported again.
   */
  confirmations: { from: string; subject: string; date: string }[];
}

/** A confirmation email is reported on the first pull that sees it, then never again. */
async function reportConfirmation(report: InboxReport, messageId: string | undefined, from: string, subject: string, date: string) {
  const id = `confirm-${createHash('sha1').update(messageId ?? `${from}${date}${subject}`).digest('hex').slice(0, 12)}`;
  if (await seen(id)) return;
  await markSeen(id, null, 'confirmation');
  report.confirmations.push({ from, subject, date });
}

async function pullInbox(sources: Source[], queue: QueuedIssue[], problems: string[]): Promise<InboxReport | null> {
  const creds = inboxCredentials();
  if (!creds) {
    console.log(`inbox: no ${INBOX_ENV}, skipped`);
    return null;
  }
  const report: InboxReport = { read: 0, unmatched: [], confirmations: [] };
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: creds, logger: false });
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(Date.now() - INBOX_DAYS * 86_400_000);
      const uids = (await client.search({ since }, { uid: true })) || [];
      for await (const msg of client.fetch(uids, { source: true }, { uid: true })) {
        if (!msg.source) continue;
        const mail = await simpleParser(msg.source);
        report.read += 1;
        const from = mail.from?.value?.[0]?.address ?? '';
        const subject = mail.subject ?? '';
        const date = (mail.date ?? new Date()).toISOString();
        if (/confirm|verify your|opt.?in|activate your subscription/i.test(subject)) {
          await reportConfirmation(report, mail.messageId, from, subject, date);
          continue;
        }
        // Welcome notes and form receipts are not issues.
        if (/^(welcome to|thank(s| you) for (subscribing|signing up|joining)|we have received your)/i.test(subject)) continue;
        // Gmail's own account mail.
        if (/@(accounts\.)?google\.com$/i.test(from)) continue;
        const ward = wardForSender(sources, from);
        const html = typeof mail.html === 'string' ? mail.html : '';
        const text = html ? htmlToText(html) : (mail.text ?? '').slice(0, MAX_TEXT);
        // A confirmation can carry the list's name as its subject; its body gives it away.
        if (text.length < 2000 && /confirm (your )?subscription|confirm subscription/i.test(text)) {
          await reportConfirmation(report, mail.messageId, from, subject, date);
          continue;
        }
        if (ward == null) {
          report.unmatched.push({ from, subject, date, text: text.slice(0, 1500) });
          continue;
        }
        // The web copy's id is the one the feed would use, so an issue read
        // from a feed is never read again from the inbox (and back).
        const web = html ? webCopyUrl(html) : null;
        const id = web ? issueId(ward, web) : `w${ward}-m${createHash('sha1').update(mail.messageId ?? `${from}${date}${subject}`).digest('hex').slice(0, 11)}`;
        if (await seen(id)) continue;
        if (queue.some((q) => q.id === id)) continue;
        if (text.length < MIN_TEXT) {
          await markSeen(id, ward, 'empty');
          continue;
        }
        queue.push({ id, ward, title: subject, url: web, sentAt: date, text });
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    problems.push(`inbox: ${(err as Error).message}`);
  }
  return report;
}

const DASH = /[–—]/;

function chicagoDate(iso: string): Date {
  if (!/[+-]\d{2}:\d{2}$|Z$/.test(iso)) throw new Error(`"${iso}" needs a UTC offset`);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`bad date "${iso}"`);
  return d;
}

/** A Chicago calendar day (YYYY-MM-DD) for an instant. */
function chicagoDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

/** Midnight in Chicago at the start of the given day. */
function chicagoMidnight(day: string): Date {
  for (const offset of ['-05:00', '-06:00']) {
    const d = new Date(`${day}T00:00:00${offset}`);
    if (chicagoDay(d) === day && d.toLocaleTimeString('en-GB', { timeZone: 'America/Chicago' }).startsWith('00')) return d;
  }
  throw new Error(`no Chicago midnight for ${day}`);
}

function nextDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** An undated meeting with no day stays on the page this long after its issue. */
const UNDATED_DAYS = 21;

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function apply(file: string, queueFile?: string) {
  const results: Result[] = JSON.parse(readFileSync(file, 'utf8'));
  const queued: QueuedIssue[] = queueFile ? JSON.parse(readFileSync(queueFile, 'utf8')) : [];
  const byId = new Map(queued.map((q) => [q.id, q]));
  let issues = 0;
  let meetings = 0;
  for (const r of results) {
    const q = byId.get(r.id);
    if (!q) throw new Error(`${r.id} is not in the queue file`);
    if (r.skip) {
      await markSeen(r.id, q.ward, 'old');
      continue;
    }
    if (r.sentAt) q.sentAt = chicagoDate(r.sentAt).toISOString();
    for (const text of [r.summary, r.summaryEs, ...r.meetings.map((m) => m.title)]) {
      if (DASH.test(text)) throw new Error(`${r.id}: em or en dash in "${text.slice(0, 60)}"`);
    }
    if (!r.summary.trim() || !r.summaryEs.trim()) throw new Error(`${r.id}: summary and summaryEs are both required`);
    const old = await db.collection('wardMeetings').where('issueId', '==', r.id).get();
    for (const d of old.docs) await d.ref.delete();
    for (const id of r.resolves ?? []) {
      if (!q.undated?.some((u) => u.id === id)) throw new Error(`${r.id}: resolves ${id}, which is not in its undated list`);
      await db.doc(`wardMeetings/${id}`).delete();
    }
    for (const [n, m] of r.meetings.entries()) {
      if (!['development', 'ward', 'community'].includes(m.kind)) throw new Error(`${r.id}: bad kind ${m.kind}`);
      if (m.start == null) {
        // Announced without a time (2026-10-12): listed as "time not found"
        // until its day passes, or for UNDATED_DAYS when no day is given.
        if (m.date != null && !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) throw new Error(`${r.id}: date must be YYYY-MM-DD, got ${m.date}`);
        const expires = m.date
          ? chicagoMidnight(nextDay(m.date))
          : new Date(new Date(q.sentAt).getTime() + UNDATED_DAYS * 86_400_000);
        if (expires.getTime() <= Date.now()) continue;
        const ward = await db.collection('wardMeetings').where('wardId', '==', q.ward).get();
        const repeat = ward.docs.some(
          (d) =>
            d.get('issueId') !== r.id &&
            (sameTitle(d.get('title'), m.title) ||
              (m.date != null && (d.get('date') === m.date || (d.get('start') && chicagoDay((d.get('start') as Timestamp).toDate()) === m.date))))
        );
        if (repeat) continue;
        await db.doc(`wardMeetings/${r.id}-${n}`).set({
          wardId: q.ward,
          issueId: r.id,
          title: m.title.trim(),
          kind: m.kind,
          start: null,
          date: m.date ?? null,
          expiresAt: Timestamp.fromDate(expires),
          end: null,
          place: m.place?.trim() || null,
          address: m.address?.trim() || null,
          online: m.online === true,
          url: m.url && /^https:\/\//.test(m.url) ? m.url : q.url,
          sourceUrl: q.url,
          sourceTitle: q.title,
          createdAt: FieldValue.serverTimestamp(),
        });
        meetings += 1;
        continue;
      }
      const start = chicagoDate(m.start);
      if (start.getTime() < Date.now() - 86_400_000) continue; // already happened
      // A resend or a later issue repeating the same meeting adds nothing.
      const dupes = await db
        .collection('wardMeetings')
        .where('wardId', '==', q.ward)
        .where('start', '==', Timestamp.fromDate(start))
        .get();
      if (dupes.docs.some((d) => d.get('issueId') !== r.id)) continue;
      // The time an undated meeting on the same day was missing: this replaces it.
      const day = chicagoDay(start);
      const waiting = await db.collection('wardMeetings').where('wardId', '==', q.ward).where('date', '==', day).get();
      for (const d of waiting.docs) if (d.get('start') == null) await d.ref.delete();
      await db.doc(`wardMeetings/${r.id}-${n}`).set({
        wardId: q.ward,
        issueId: r.id,
        title: m.title.trim(),
        kind: m.kind,
        start: Timestamp.fromDate(start),
        end: m.end ? Timestamp.fromDate(chicagoDate(m.end)) : null,
        place: m.place?.trim() || null,
        address: m.address?.trim() || null,
        online: m.online === true,
        url: m.url && /^https:\/\//.test(m.url) ? m.url : q.url,
        // (null when neither the meeting nor the issue has a public link)
        sourceUrl: q.url,
        sourceTitle: q.title,
        createdAt: FieldValue.serverTimestamp(),
      });
      meetings += 1;
    }
    await db.doc(`newsletterIssues/${r.id}`).set({
      wardId: q.ward,
      title: q.title,
      url: q.url,
      sentAt: Timestamp.fromDate(new Date(q.sentAt)),
      summary: r.summary.trim(),
      summaryEs: r.summaryEs.trim(),
      meetingCount: r.meetings.length,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (r.officeHours?.text) {
      if (DASH.test(r.officeHours.text) || DASH.test(r.officeHours.textEs)) throw new Error(`${r.id}: dash in office hours`);
      const sentAt = Timestamp.fromDate(new Date(q.sentAt));
      const cards = await db.collection('officials').where('wardId', '==', q.ward).get();
      for (const card of cards.docs) {
        const prev = card.get('officeHours') as { sentAt?: Timestamp } | undefined;
        if (prev?.sentAt && prev.sentAt.toMillis() > sentAt.toMillis()) continue; // a newer issue already set them
        await card.ref.update({
          officeHours: { text: r.officeHours.text.trim(), textEs: r.officeHours.textEs.trim(), sourceUrl: q.url, sentAt },
        });
      }
    }
    await markSeen(r.id, q.ward, 'read');
    issues += 1;
  }
  // Meetings that have passed come off the ward pages.
  const past = await db.collection('wardMeetings').where('start', '<', Timestamp.fromMillis(Date.now() - 86_400_000)).get();
  for (const d of past.docs) await d.ref.delete();
  const expired = await db.collection('wardMeetings').where('expiresAt', '<', Timestamp.now()).get();
  for (const d of expired.docs) await d.ref.delete();
  console.log(
    `Wrote ${issues} issue summaries and ${meetings} upcoming meetings; removed ${past.size + expired.size} past meetings.`
  );
}

async function recent(days: number, out: string) {
  const since = Timestamp.fromMillis(Date.now() - days * 86_400_000);
  const snap = await db.collection('newsletterIssues').where('sentAt', '>=', since).orderBy('sentAt', 'asc').get();
  const rows = snap.docs.map((d) => ({
    id: d.id,
    ward: d.get('wardId'),
    title: d.get('title'),
    sentAt: (d.get('sentAt') as Timestamp).toDate().toISOString(),
    summary: d.get('summary'),
  }));
  writeFileSync(out, JSON.stringify(rows, null, 2));
  console.log(`${rows.length} issue summaries from the last ${days} days -> ${out}`);
}

async function digest(file: string) {
  const d: { weekOf: string; summary: string; summaryEs: string; wards: number[]; issueCount: number } = JSON.parse(
    readFileSync(file, 'utf8')
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.weekOf)) throw new Error('weekOf must be YYYY-MM-DD (the Monday)');
  if (DASH.test(d.summary) || DASH.test(d.summaryEs)) throw new Error('em or en dash in the digest');
  await db.doc(`newsletterDigests/${d.weekOf}`).set({ ...d, createdAt: FieldValue.serverTimestamp() });
  console.log(`Digest for the week of ${d.weekOf} written (${d.issueCount} issues, ${d.wards.length} wards).`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (name: string) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (cmd === 'pull') return pull(flag('out') ?? 'newsletter-queue.json');
  if (cmd === 'apply') return apply(rest[0], flag('queue'));
  if (cmd === 'recent') return recent(Number(flag('days') ?? 7), flag('out') ?? 'newsletter-recent.json');
  if (cmd === 'digest') return digest(rest[0]);
  console.error('usage: newsletters pull --out <f> | apply <results> --queue <queue> | recent --days 7 --out <f> | digest <f>');
  process.exit(1);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
