"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCivicMeetings = syncCivicMeetings;
const firestore_1 = require("firebase-admin/firestore");
const FEED = 'https://ccpsa.chicago.gov/wp-json/tribe/events/v1/events';
const DAYS_AHEAD = 75;
function decode(s) {
    return s
        .replace(/&#8211;|&#8212;/g, '-')
        .replace(/&#8217;|&#8216;/g, "'")
        .replace(/&#038;|&amp;/g, '&')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/\s+/g, ' ')
        .trim();
}
/** "2026-10-20 18:00:00" in Chicago -> the instant. */
function chicagoLocal(s) {
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
        if (Number(shown) === h)
            return guess;
    }
    return new Date(Date.UTC(y, mo - 1, day, h + 6, mi));
}
async function syncCivicMeetings(db) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
    const until = new Date(Date.now() + DAYS_AHEAD * 86_400_000).toISOString().slice(0, 10);
    const events = [];
    for (let page = 1; page <= 10; page++) {
        const resp = await fetch(`${FEED}?start_date=${today}&end_date=${until}&per_page=50&page=${page}`, {
            signal: AbortSignal.timeout(20_000),
        });
        if (!resp.ok)
            throw new Error(`CCPSA feed page ${page} -> ${resp.status}`);
        const body = (await resp.json());
        events.push(...body.events);
        if (!body.total_pages || page >= body.total_pages)
            break;
    }
    const seen = new Set();
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
            start: firestore_1.Timestamp.fromDate(chicagoLocal(e.start_date)),
            end: e.end_date ? firestore_1.Timestamp.fromDate(chicagoLocal(e.end_date)) : null,
            venue: !place || /^tbd$/i.test(place) ? null : place,
            address: venue?.address ? decode(venue.address) : null,
            url: e.url,
            syncedAt: firestore_1.FieldValue.serverTimestamp(),
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
//# sourceMappingURL=civic.js.map