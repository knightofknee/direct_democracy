"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOT_INCLUDED = exports.SOURCES = void 0;
exports.parseFeed = parseFeed;
exports.tagStory = tagStory;
exports.storyLang = storyLang;
exports.storyId = storyId;
exports.syncNews = syncNews;
/**
 * The news tab (2026-10-07): headlines from every newsroom that covers
 * Chicago or Illinois government and publishes a public feed, newest first,
 * never ranked and never hidden by the app (each person turns sources off
 * for themselves). Only the headline, its link, and its time are kept; a tap
 * reads the story on the newsroom's own site.
 *
 * The inclusion rule is the same for every outlet, because the app is run
 * by someone on the ballot and the list must not read as curated: a
 * newsroom that covers Chicago or Illinois government is in when its site
 * is among the top million on the Tranco list (tranco-list.eu, a public
 * research ranking of site popularity; Brian 2026-10-08: traffic is the
 * main qualifier) and its feed is public and answers a reader that says who
 * it is (FEED_UA). `npm run news-ranks` rechecks every rank. One that turns
 * feed readers away is listed as not included, with its status, until it
 * agrees ('blocked' -> 'asked' -> included, or 'declined', which the app
 * says plainly). A national site's Chicago section (CBS, Chalkbeat) counts
 * by its whole domain's rank.
 *
 * Each story is also tagged with the wards and officials it names (WARD
 * MATCHING below), so ward and official pages can list it under "In the
 * news". The tags come from plain text rules, never AI, and are set once
 * when the story is first seen.
 *
 * Written every 20 minutes into newsSources/{id} and newsItems/{id}
 * (world-readable, admin-written); stories older than KEEP_DAYS are deleted.
 */
const crypto = __importStar(require("crypto"));
const fs_1 = require("fs");
const path_1 = require("path");
const fast_xml_parser_1 = require("fast-xml-parser");
const firestore_1 = require("firebase-admin/firestore");
/** Honest about who is reading: an outlet that refuses it is asked, not worked around. */
const FEED_UA = 'directdemocracy-news/1.0 (+https://www.waldgrave.com/directdemocracy)';
const KEEP_DAYS = 14;
/** Newest stories taken from one feed per run. */
const PER_FEED = 40;
/**
 * Feeds checked with FEED_UA from the function's own servers (2026-10-07;
 * the Crusader, Reporter, Capitol Fax and Telemundo added 2026-10-08).
 * Borderless, City Bureau, the Illinois Answers Project, Austin Weekly News
 * and The TRiiBE are outside Tranco's top million (2026-10-08), so not in.
 */
exports.SOURCES = [
    { id: 'suntimes', domain: 'suntimes.com', name: 'Chicago Sun-Times', homepage: 'https://chicago.suntimes.com', feed: 'https://chicago.suntimes.com/rss/index.xml', lang: 'en', spanishPath: '/la-voz/' },
    { id: 'wbez', domain: 'wbez.org', name: 'WBEZ', homepage: 'https://www.wbez.org', feed: 'https://www.wbez.org/rss/', lang: 'en' },
    { id: 'blockclub', domain: 'blockclubchicago.org', name: 'Block Club Chicago', homepage: 'https://blockclubchicago.org', feed: 'https://blockclubchicago.org/feed/', lang: 'en', chicagoOnly: true },
    { id: 'reader', domain: 'chicagoreader.com', name: 'Chicago Reader', homepage: 'https://chicagoreader.com', feed: 'https://chicagoreader.com/feed/', lang: 'en', chicagoOnly: true },
    { id: 'wttw', domain: 'wttw.com', name: 'WTTW News', homepage: 'https://news.wttw.com', feed: 'https://news.wttw.com/rss.xml', lang: 'en' },
    { id: 'chalkbeat', domain: 'chalkbeat.org', name: 'Chalkbeat Chicago', homepage: 'https://www.chalkbeat.org/chicago/', feed: 'https://www.chalkbeat.org/arc/outboundfeeds/rss/category/chicago/?outputType=xml', lang: 'en', chicagoOnly: true },
    { id: 'southsideweekly', domain: 'southsideweekly.com', name: 'South Side Weekly', homepage: 'https://southsideweekly.com', feed: 'https://southsideweekly.com/feed/', lang: 'en', chicagoOnly: true },
    { id: 'injusticewatch', domain: 'injusticewatch.org', name: 'Injustice Watch', homepage: 'https://www.injusticewatch.org', feed: 'https://www.injusticewatch.org/feed/', lang: 'en' },
    { id: 'capitolnews', domain: 'capitolnewsillinois.com', name: 'Capitol News Illinois', homepage: 'https://capitolnewsillinois.com', feed: 'https://capitolnewsillinois.com/feed/', lang: 'en' },
    { id: 'abc7', domain: 'abc7chicago.com', name: 'ABC7 Chicago', homepage: 'https://abc7chicago.com', feed: 'https://abc7chicago.com/feed/', lang: 'en' },
    { id: 'nbc5', domain: 'nbcchicago.com', name: 'NBC 5 Chicago', homepage: 'https://www.nbcchicago.com', feed: 'https://www.nbcchicago.com/?rss=y', lang: 'en' },
    { id: 'cbschicago', domain: 'cbsnews.com', name: 'CBS News Chicago', homepage: 'https://www.cbsnews.com/chicago/', feed: 'https://www.cbsnews.com/chicago/latest/rss/main', lang: 'en' },
    { id: 'wgn', domain: 'wgntv.com', name: 'WGN-TV', homepage: 'https://wgntv.com', feed: 'https://wgntv.com/feed/', lang: 'en' },
    { id: 'fox32', domain: 'fox32chicago.com', name: 'FOX 32 Chicago', homepage: 'https://www.fox32chicago.com', feed: 'https://www.fox32chicago.com/rss/category/news', lang: 'en' },
    { id: 'crusader', domain: 'chicagocrusader.com', name: 'Chicago Crusader', homepage: 'https://chicagocrusader.com', feed: 'https://chicagocrusader.com/feed/', lang: 'en', chicagoOnly: true },
    { id: 'reporter', domain: 'chicagoreporter.com', name: 'The Chicago Reporter', homepage: 'https://www.chicagoreporter.com', feed: 'https://www.chicagoreporter.com/feed/', lang: 'en' },
    { id: 'capitolfax', domain: 'capitolfax.com', name: 'Capitol Fax', homepage: 'https://capitolfax.com', feed: 'https://capitolfax.com/feed/', lang: 'en' },
    { id: 'telemundo', domain: 'telemundochicago.com', name: 'Telemundo Chicago', homepage: 'https://www.telemundochicago.com', feed: 'https://www.telemundochicago.com/?rss=y', lang: 'es' },
    { id: 'laraza', domain: 'laraza.com', name: 'La Raza', homepage: 'https://laraza.com', feed: 'https://www.laraza.com/feed/', lang: 'es' },
];
/**
 * Newsrooms that are not in, and why. 'blocked': its site turns feed readers
 * away (checked 2026-10-07); 'asked': permission requested; 'declined': it
 * said no. Moving one into SOURCES once it agrees is the whole change.
 */
exports.NOT_INCLUDED = [
    { id: 'tribune', domain: 'chicagotribune.com', name: 'Chicago Tribune', homepage: 'https://www.chicagotribune.com', status: 'blocked' },
    { id: 'crains', domain: 'chicagobusiness.com', name: "Crain's Chicago Business", homepage: 'https://www.chicagobusiness.com', status: 'blocked' },
    // Answers a feed reader at home but not from a data center: its host
    // answers 429 on every run.
    { id: 'hpherald', domain: 'hpherald.com', name: 'Hyde Park Herald', homepage: 'https://www.hpherald.com', status: 'blocked' },
];
const parser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    processEntities: true,
    htmlEntities: true,
    isArray: (name) => name === 'item' || name === 'entry' || name === 'link',
});
function text(v) {
    if (v == null)
        return '';
    if (typeof v === 'string' || typeof v === 'number')
        return String(v);
    if (typeof v === 'object' && '#text' in v)
        return String(v['#text']);
    return '';
}
function plain(s) {
    return s
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#0?39;|&#8217;|&#8216;|&rsquo;|&lsquo;/g, "'")
        .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;|&quot;/g, '"')
        .replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, '-')
        .replace(/&#8230;|&hellip;/g, '...')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/\s+/g, ' ')
        .trim();
}
function linkOf(links) {
    for (const l of links ?? []) {
        if (typeof l === 'string')
            return l.trim();
        const o = l;
        if (o['@href'] && (!o['@rel'] || o['@rel'] === 'alternate'))
            return o['@href'].trim();
        if (o['#text'])
            return String(o['#text']).trim();
    }
    return '';
}
function dateOf(...values) {
    for (const v of values) {
        const d = new Date(text(v));
        if (!Number.isNaN(d.getTime()))
            return d;
    }
    return null;
}
/** RSS 2.0 or Atom, whichever the feed is. */
function parseFeed(xml) {
    const doc = parser.parse(xml);
    const items = doc.rss?.channel?.item ?? doc['rdf:RDF']?.item ?? doc.feed?.entry ?? [];
    return items
        .map((it) => ({
        title: plain(text(it.title)),
        url: linkOf(it.link),
        published: dateOf(it.pubDate, it.published, it.updated, it['dc:date']),
        teaser: plain(text(it.description ?? it.summary ?? it.content)).slice(0, 600),
    }))
        .filter((s) => s.title && /^https:\/\//.test(s.url));
}
async function fetchFeed(source) {
    const resp = await fetch(source.feed, {
        headers: { 'user-agent': FEED_UA, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok)
        throw new Error(`${resp.status} from ${source.feed}`);
    const body = await resp.text();
    const stories = parseFeed(body);
    // A feed that answers with no stories is a challenge page or a broken
    // feed, not a quiet newsroom: record what came back.
    if (stories.length === 0)
        throw new Error(`no stories in the feed (${resp.headers.get('content-type')}: ${body.slice(0, 120)})`);
    return stories;
}
// ---------------------------------------------------------------------------
// WARD MATCHING: a story is listed on a ward's page when its headline or
// teaser names the ward ("25th Ward", "Ward 25"), the ward's alderman by
// full name, or a neighborhood at least 15% of whose residents live in that
// ward (functions/data/neighborhood-wards.json, build-neighborhood-wards).
// An official's page lists stories naming them in full.
let neighborhoods = null;
function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** Longest names first, so "West Rogers Park" is read before "Rogers Park". */
function neighborhoodRules() {
    if (!neighborhoods) {
        const file = (0, path_1.join)(__dirname, '..', 'data', 'neighborhood-wards.json');
        const map = JSON.parse((0, fs_1.readFileSync)(file, 'utf8'));
        neighborhoods = Object.entries(map)
            .sort(([a], [b]) => b.length - a.length)
            .map(([name, wards]) => {
            // "the Loop" also matches "The Loop" at the start of a sentence.
            const pattern = name.startsWith('the ') ? `[Tt]he ${escapeRe(name.slice(4))}` : escapeRe(name);
            return [new RegExp(`(?<![\\w'])${pattern}(?![\\w'])`, 'g'), wards];
        });
    }
    return neighborhoods;
}
/** First names newsrooms shorten ("Ald. Bill Conway" for William Conway). */
const NICKNAMES = {
    William: ['Bill', 'Will'],
    James: ['Jim'],
    Raymond: ['Ray'],
    Timothy: ['Tim'],
    Matthew: ['Matt'],
    Michael: ['Mike'],
    Gregory: ['Greg'],
    Anthony: ['Tony'],
    Nicholas: ['Nick'],
    Daniel: ['Dan'],
    Christopher: ['Chris'],
    Patricia: ['Pat'],
};
const SUFFIX = /,?\s+(?:Jr\.?|Sr\.?|II|III|IV)$/;
const ORDINAL = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
/**
 * Every way a story names an official, longest first: the name as stored
 * ("Walter R. Burnett"), without middle initials and with or without the
 * suffix ("Walter Burnett Jr."), with a short first name ("Bill Conway"),
 * "Ald. Burnett" when no other alderman shares the last name, and the
 * Chicago style "Burnett (27th)".
 */
const ruleCache = new WeakMap();
function officialRules(officials) {
    const cached = ruleCache.get(officials);
    if (cached)
        return cached;
    const parts = officials.map((o) => {
        const suffix = SUFFIX.exec(o.name)?.[0].trim().replace(/^,\s*/, '') ?? '';
        const words = o.name.replace(SUFFIX, '').split(/\s+/);
        const first = words[0];
        const rest = words.slice(1).filter((w) => !/^[A-Z]\.$/.test(w));
        return { o, first, last: rest.join(' '), suffix };
    });
    const lastCount = new Map();
    for (const p of parts)
        if (p.o.wardId != null)
            lastCount.set(p.last, (lastCount.get(p.last) ?? 0) + 1);
    const rules = [];
    for (const { o, first, last, suffix } of parts) {
        if (!last)
            continue;
        const names = new Set([o.name]);
        for (const f of [first, ...(NICKNAMES[first] ?? [])]) {
            names.add(`${f} ${last}`);
            if (suffix)
                names.add(`${f} ${last} ${suffix}`);
        }
        for (const n of names)
            rules.push([escapeRe(n), o]);
        if (o.wardId != null) {
            rules.push([`${escapeRe(last)} \\(${ORDINAL(o.wardId)}(?: [Ww]ard)?\\)`, o]);
            if (lastCount.get(last) === 1)
                rules.push([`(?:Ald\\.|Alder(?:man|woman|person)?) ${escapeRe(last)}`, o]);
        }
    }
    const built = rules
        .sort(([a], [b]) => b.length - a.length)
        .map(([pattern, o]) => [new RegExp(`(?<![\\w'])${pattern}(?![\\w'-])`, 'g'), o]);
    ruleCache.set(officials, built);
    return built;
}
/** The wards and officials a story names. Case-sensitive on purpose: names are capitalized. */
function tagStory(title, teaser, source, officials) {
    const body = `${title}. ${teaser}`;
    const wards = new Set();
    const officialIds = new Set();
    for (const m of body.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)[ -][Ww]ard\b|\b[Ww]ard (\d{1,2})\b/g)) {
        const n = Number(m[1] ?? m[2]);
        if (n >= 1 && n <= 50)
            wards.add(n);
    }
    // Longest form first, blanked once matched, so "Ald. Rodriguez Sanchez"
    // is never also read as "Ald. Rodriguez".
    let rest = body;
    for (const [re, o] of officialRules(officials)) {
        const next = rest.replace(re, ' ');
        if (next === rest)
            continue;
        rest = next;
        officialIds.add(o.uid);
        if (o.wardId != null && o.wardId >= 1 && o.wardId <= 50)
            wards.add(o.wardId);
    }
    // A neighborhood name means Chicago's only in a Chicago-only newsroom or a
    // story that says Chicago. The South Shore Line is the Indiana train.
    if (source.chicagoOnly || /\bChicago/.test(body)) {
        // A matched name is blanked out, so a shorter name inside it
        // ("Rogers Park" in "West Rogers Park") is not read again.
        rest = body.replace(/South Shore Line/g, '');
        for (const [re, ws] of neighborhoodRules()) {
            const next = rest.replace(re, ' ');
            if (next !== rest)
                for (const w of ws)
                    wards.add(w);
            rest = next;
        }
    }
    return { wardIds: [...wards].sort((a, b) => a - b), officialIds: [...officialIds] };
}
// ---------------------------------------------------------------------------
// Sync
/**
 * A story's language: the source's, unless the headline is plainly another
 * (Chalkbeat translates some stories into Spanish and Chinese; the
 * Sun-Times' La Voz lives under its own path).
 */
function storyLang(source, url, title) {
    if (/[\u4e00-\u9fff]/.test(title))
        return 'zh';
    if (source.spanishPath && new URL(url).pathname.startsWith(source.spanishPath))
        return 'es';
    if (source.lang === 'es')
        return 'es';
    const spanish = (title.match(/(?:^|\s)(?:de|del|la|las|los|el|y|para|con|una|por|en|sobre|según)(?=\s)/gi) ?? []).length;
    // An ñ alone is not enough: English headlines say "Quinceañera" too.
    return /[¿¡]/.test(title) || spanish >= 3 || (/ñ/.test(title) && spanish >= 2) ? 'es' : 'en';
}
function storyId(url) {
    return crypto.createHash('sha1').update(url).digest('hex').slice(0, 24);
}
async function syncNews(db) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - KEEP_DAYS * 86_400_000);
    const officialSnap = await db.collection('officials').get();
    const officials = officialSnap.docs
        .map((d) => ({ uid: d.id, name: String(d.get('name') ?? '').trim(), wardId: d.get('wardId') ?? null }))
        // Ward 51 is the hidden test ward; its fictional alderman is never news.
        .filter((o) => o.name && o.wardId !== 51);
    const report = [];
    let added = 0;
    const sourceWrites = db.batch();
    for (const [order, source] of exports.SOURCES.entries()) {
        const ref = db.collection('newsSources').doc(source.id);
        const base = { name: source.name, homepage: source.homepage, lang: source.lang, order, included: true };
        try {
            const stories = (await fetchFeed(source))
                .filter((s) => !s.published || (s.published >= cutoff && s.published.getTime() <= now.getTime() + 86_400_000))
                .slice(0, PER_FEED);
            const refs = stories.map((s) => db.collection('newsItems').doc(storyId(s.url)));
            const existing = refs.length ? await db.getAll(...refs) : [];
            const batch = db.batch();
            let fresh = 0;
            stories.forEach((s, i) => {
                if (existing[i].exists)
                    return;
                const tags = tagStory(s.title, s.teaser, source, officials);
                batch.set(refs[i], {
                    sourceId: source.id,
                    title: s.title.slice(0, 300),
                    url: s.url,
                    lang: storyLang(source, s.url, s.title),
                    // A feed without dates gets the time it was first seen.
                    publishedAt: firestore_1.Timestamp.fromDate(s.published && s.published <= now ? s.published : now),
                    wardIds: tags.wardIds,
                    officialIds: tags.officialIds,
                    fetchedAt: firestore_1.Timestamp.fromDate(now),
                });
                fresh += 1;
            });
            if (fresh)
                await batch.commit();
            added += fresh;
            sourceWrites.set(ref, { ...base, lastOkAt: firestore_1.Timestamp.fromDate(now), lastError: null }, { merge: true });
            report.push(`${source.id} +${fresh}/${stories.length}`);
        }
        catch (err) {
            console.error(`News feed ${source.id} failed:`, err);
            sourceWrites.set(ref, { ...base, lastError: String(err.message ?? err).slice(0, 200) }, { merge: true });
            report.push(`${source.id} FAILED`);
        }
    }
    for (const [order, o] of exports.NOT_INCLUDED.entries()) {
        sourceWrites.set(db.collection('newsSources').doc(o.id), {
            name: o.name,
            homepage: o.homepage,
            order: exports.SOURCES.length + order,
            included: false,
            status: o.status,
        });
    }
    // A source taken off the list goes, and so do its stories: a headline
    // whose newsroom is gone would show with no name on it.
    const known = new Set([...exports.SOURCES, ...exports.NOT_INCLUDED].map((s) => s.id));
    const included = new Set(exports.SOURCES.map((s) => s.id));
    for (const d of (await db.collection('newsSources').get()).docs) {
        if (!known.has(d.id))
            sourceWrites.delete(d.ref);
        if (!included.has(d.id) && d.get('included') !== false) {
            const orphans = await db.collection('newsItems').where('sourceId', '==', d.id).limit(400).get();
            const batch = db.batch();
            orphans.docs.forEach((o) => batch.delete(o.ref));
            if (!orphans.empty)
                await batch.commit();
        }
    }
    await sourceWrites.commit();
    // Old stories go; a page of deletes per run keeps up with 20 feeds.
    const old = await db.collection('newsItems').where('publishedAt', '<', firestore_1.Timestamp.fromDate(cutoff)).limit(400).get();
    if (!old.empty) {
        const batch = db.batch();
        old.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
    return `${added} new, ${old.size} expired; ${report.join(', ')}`;
}
//# sourceMappingURL=news.js.map