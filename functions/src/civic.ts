/**
 * Police District Council meetings (and the citywide Community Commission
 * for Public Safety and Accountability), from CCPSA's public events feed
 * (The Events Calendar REST API on ccpsa.chicago.gov; no key). Synced daily
 * into civicMeetings/{eventId}: world-readable, admin-written. A ward page
 * shows the councils of the police districts its residents live in
 * (WARD_DISTRICTS in the app). 2026-10-05.
 *
 * The feed's own quirks: start_date is Chicago local time even when the
 * event's timezone says UTC+0; a rescheduled meeting keeps its old date
 * and says so in the title (the new date is its own event); an unknown
 * venue is "TBD".
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const FEED = 'https://ccpsa.chicago.gov/wp-json/tribe/events/v1/events';
const DAYS_AHEAD = 75;

interface FeedEvent {
  id: number;
  title: string;
  url: string;
  start_date: string; // "2026-10-20 18:00:00", Chicago local
  end_date: string;
  venue?: { venue?: string; address?: string; city?: string } | [];
  organizer?: { organizer?: string }[];
}

function decode(s: string): string {
  return s
    .replace(/&#8211;|&#8212;/g, '-')
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#038;|&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** "2026-10-20 18:00:00" in Chicago -> the instant. */
function chicagoLocal(s: string): Date {
  const [d, t = '00:00:00'] = s.split(' ');
  const [y, mo, day] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  for (const offset of [5, 6]) {
    const guess = new Date(Date.UTC(y, mo - 1, day, h + offset, mi));
    const shown = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(guess);
    if (Number(shown) === h) return guess;
  }
  return new Date(Date.UTC(y, mo - 1, day, h + 6, mi));
}

export async function syncCivicMeetings(db: Firestore): Promise<string> {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
  const until = new Date(Date.now() + DAYS_AHEAD * 86_400_000).toISOString().slice(0, 10);
  const events: FeedEvent[] = [];
  for (let page = 1; page <= 10; page++) {
    const resp = await fetch(`${FEED}?start_date=${today}&end_date=${until}&per_page=50&page=${page}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) throw new Error(`CCPSA feed page ${page} -> ${resp.status}`);
    const body = (await resp.json()) as { events: FeedEvent[]; total_pages?: number };
    events.push(...body.events);
    if (!body.total_pages || page >= body.total_pages) break;
  }

  const seen = new Set<string>();
  let skipped = 0;
  for (const e of events) {
    const title = decode(e.title);
    if (/reschedul|cancel|postpone/i.test(title)) {
      skipped += 1;
      continue;
    }
    const organizer = (e.organizer ?? []).map((o) => o.organizer ?? '').join(' ');
    const district = organizer.match(/(\d+)(?:st|nd|rd|th)\s+District Council/i);
    const commission = !district && /Commission/i.test(organizer);
    if (!district && !commission) {
      skipped += 1;
      continue;
    }
    const venue = Array.isArray(e.venue) ? undefined : e.venue;
    const place = decode(venue?.venue ?? '');
    const id = String(e.id);
    seen.add(id);
    await db.doc(`civicMeetings/${id}`).set({
      kind: commission ? 'commission' : 'district-council',
      policeDistrict: district ? Number(district[1]) : null,
      title,
      start: Timestamp.fromDate(chicagoLocal(e.start_date)),
      end: e.end_date ? Timestamp.fromDate(chicagoLocal(e.end_date)) : null,
      venue: !place || /^tbd$/i.test(place) ? null : place,
      address: venue?.address ? decode(venue.address) : null,
      url: e.url,
      syncedAt: FieldValue.serverTimestamp(),
    });
  }
  // Past meetings and ones the feed dropped (cancelled, moved) go.
  const all = await db.collection('civicMeetings').get();
  let removed = 0;
  for (const d of all.docs) {
    if (!seen.has(d.id)) {
      await d.ref.delete();
      removed += 1;
    }
  }
  return `${seen.size} meetings, ${skipped} skipped, ${removed} removed`;
}
