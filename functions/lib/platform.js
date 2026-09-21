"use strict";
/**
 * Campaign-site platform parser. Turns a candidate's policy page into the
 * app's Policy shape so the site stays the single source of truth and nothing
 * is hand-entered twice.
 *
 * Three page layouts are recognized, tried in order until one yields policies:
 *
 * 1. Grouped lists (waldgrave.com/chigui): <h4 class="... groupHead"> sections
 *    each followed by a <ul class="... policies"> of
 *    <li class="... policyItem"><b>Title:</b> body</li>. Matched on those
 *    stable class names, never the styled-jsx hashes that change every build.
 * 2. Elementor popup cards (alexiforus.com): a grid of call-to-action cards
 *    whose "keep reading" links open Elementor popups; the popup documents are
 *    embedded in the same page as data-elementor-type="popup" blocks holding
 *    the full text. Cards give the titles and order, popups give the bodies.
 * 3. Accordion cards (joeforchicago.com): <button class="accordion-header">
 *    titles, each with an accordion-content div holding a summary paragraph
 *    and a "Key Ideas" bullet list.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_BODY = void 0;
exports.slugify = slugify;
exports.parsePlatformHtml = parsePlatformHtml;
exports.parsePlatformUrl = parsePlatformUrl;
/** Minimal HTML entity decoding for the entities the sites actually emit. */
function decodeEntities(text) {
    const named = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        nbsp: ' ',
        rsquo: '’',
        lsquo: '‘',
        rdquo: '”',
        ldquo: '“',
    };
    return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
        if (entity[0] === '#') {
            const code = entity[1] === 'x' || entity[1] === 'X'
                ? parseInt(entity.slice(2), 16)
                : parseInt(entity.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
        return named[entity] ?? match;
    });
}
function stripTags(html) {
    return decodeEntities(html.replace(/<[^>]+>/g, ''))
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Flatten an HTML fragment to readable multi-paragraph text: block elements
 * become lines, list items become "- " bullets, headings become "## " lines,
 * and paragraphs are separated by a blank line (consecutive bullets stay
 * tight). The "- " and "## " markers are the entire markup language here -
 * the app's PolicyBody component renders them with real typography (bullet
 * glyphs, tighter list spacing, bold sub-heads), so keep both ends in step.
 */
function blockText(html) {
    const prepped = html
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
        .replace(/<li[^>]*>/gi, '\n\u0001')
        .replace(/<h[1-6][^>]*>/gi, '\n\u0002')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|section|ul|ol|li|h[1-6])>/gi, '\n');
    const lines = decodeEntities(prepped.replace(/<[^>]+>/g, ''))
        .replace(/\u00a0/g, ' ')
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    let text = '';
    let prevBullet = false;
    // A list item whose glyph is its own element (icon divs, arrow spans)
    // splits into an empty bullet line followed by its text - carry the bullet
    // over to that text instead of emitting "- " with nothing after it.
    let pendingBullet = false;
    for (const raw of lines) {
        let bullet = raw.startsWith('\u0001');
        const heading = raw.startsWith('\u0002');
        let content = bullet || heading ? raw.slice(1).trim() : raw;
        if (/^[\u2192\u2022\u203a\u2713\u00b7-]$/.test(content)) {
            pendingBullet = pendingBullet || bullet;
            continue;
        }
        if (bullet && !content) {
            pendingBullet = true;
            continue;
        }
        if (pendingBullet && !heading) {
            bullet = true;
            pendingBullet = false;
        }
        const line = bullet ? `- ${content}` : heading ? `## ${content}` : content;
        if (text)
            text += bullet && prevBullet ? '\n' : '\n\n';
        text += line;
        prevBullet = bullet;
    }
    return text;
}
function slugify(title) {
    return (stripTags(title)
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'policy');
}
/** Collect the https links inside a fragment, for the policy's receipts. */
function collectLinks(html) {
    const links = [];
    for (const a of html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
        const url = decodeEntities(a[1]);
        const label = stripTags(a[2]).slice(0, 140);
        if (url.startsWith('https://') && label && links.length < 20) {
            links.push({ label, url });
        }
    }
    return links;
}
/**
 * Slice out one balanced <div> element starting at `start` (which must point
 * at a "<div"). Returns the element including its closing tag, or null when
 * the markup never balances.
 */
function divBlock(html, start) {
    const re = /<\/?div\b/gi;
    re.lastIndex = start;
    let depth = 0;
    for (let m = re.exec(html); m; m = re.exec(html)) {
        depth += m[0] === '<div' ? 1 : -1;
        if (depth === 0) {
            const end = html.indexOf('>', m.index);
            return end >= 0 ? html.slice(start, end + 1) : null;
        }
    }
    return null;
}
/** Base64 decode (ASCII payloads only) without relying on runtime globals. */
function decodeBase64(b64) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bits = 0;
    let value = 0;
    let out = '';
    for (const ch of b64.replace(/=+$/, '')) {
        const idx = alphabet.indexOf(ch);
        if (idx < 0)
            continue;
        value = (value << 6) | idx;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out += String.fromCharCode((value >> bits) & 0xff);
        }
    }
    return out;
}
// ── Format 1: grouped lists (waldgrave.com/chigui) ───────────────────────
function parseGroupedLists(html) {
    const policies = [];
    // Split on section headers; chunk 0 is everything before the first one.
    const sections = html.split(/<h4[^>]*\bgroupHead\b[^>]*>/).slice(1);
    for (const sectionHtml of sections) {
        const section = stripTags(sectionHtml.split('</h4>')[0]).slice(0, 60);
        const list = /<ul[^>]*\bpolicies\b[^>]*>([\s\S]*?)<\/ul>/.exec(sectionHtml);
        if (!list)
            continue;
        const items = list[1].split(/<li[^>]*\bpolicyItem\b[^>]*>/).slice(1);
        for (const item of items) {
            const titled = /<b[^>]*>([\s\S]*?)<\/b>([\s\S]*)/.exec(item);
            if (!titled)
                continue;
            const title = stripTags(titled[1]).replace(/:$/, '').slice(0, 140);
            if (!title)
                continue;
            const bodyHtml = titled[2].split('</li>')[0];
            policies.push({
                section,
                title,
                body: stripTags(bodyHtml),
                links: collectLinks(bodyHtml),
            });
        }
    }
    return policies;
}
// ── Format 2: Elementor popup cards (alexiforus.com) ─────────────────────
function parseElementorPopups(html) {
    // The popup documents, keyed by their Elementor id.
    const popups = new Map();
    for (const m of html.matchAll(/<div\b[^>]*data-elementor-type="popup"[^>]*data-elementor-id="(\d+)"[^>]*>/g)) {
        const block = divBlock(html, m.index);
        if (block)
            popups.set(m[1], block);
    }
    if (popups.size === 0)
        return [];
    // The cards: anchors whose elementor-action href encodes the popup to open
    // as url-encoded base64 JSON ({"id":"1950",...}). Card order is page order.
    const policies = [];
    for (const a of html.matchAll(/<a[^>]*href="(#elementor-action[^"]*)"[^>]*>/g)) {
        const anchor = html.slice(a.index, html.indexOf('</a>', a.index));
        const titled = /elementor-cta__title[^>]*>([\s\S]*?)<\/h\d>/.exec(anchor);
        if (!titled)
            continue;
        const title = stripTags(titled[1]).slice(0, 140);
        const settings = /settings%3D([A-Za-z0-9%]+)/.exec(a[1]);
        const decoded = settings ? decodeBase64(decodeURIComponent(settings[1])) : '';
        const popupId = /"id":"?(\d+)"?/.exec(decoded)?.[1];
        const popup = popupId ? popups.get(popupId) : undefined;
        if (!title || !popup)
            continue;
        // The popup's own lead heading repeats the card title - drop it, the
        // rest (sub-headings and paragraphs) is the body.
        const bodyHtml = popup.replace(/<h\d[^>]*elementor-heading-title[^>]*>[\s\S]*?<\/h\d>/, '');
        policies.push({ section: '', title, body: blockText(bodyHtml), links: collectLinks(bodyHtml) });
    }
    return policies;
}
// ── Format 3: accordion cards (joeforchicago.com) ────────────────────────
function parseAccordions(html) {
    const policies = [];
    const seenTitles = new Set();
    for (const m of html.matchAll(/<button[^>]*class="accordion-header[^"]*"[^>]*>/g)) {
        const segment = html.slice(m.index);
        const titled = /<h\d[^>]*>([\s\S]*?)<\/h\d>/.exec(segment);
        if (!titled)
            continue;
        const title = stripTags(titled[1]).slice(0, 140);
        const content = /<div[^>]*class="accordion-content[^"]*"[^>]*>/.exec(segment);
        if (!title || !content)
            continue;
        const block = divBlock(segment, content.index);
        if (!block)
            continue;
        // Desktop card grids repeat the same policies - keep the first rendering.
        if (seenTitles.has(title))
            continue;
        seenTitles.add(title);
        policies.push({ section: '', title, body: blockText(block), links: collectLinks(block) });
    }
    return policies;
}
// ── Format 4: WordPress sectioned headings (susanamendoza.com) ───────────
// One long page inside <main>: <h2 class="wp-block-heading"> sections, each
// holding <h3 class="wp-block-heading"> policies with paragraphs between.
function parseWpSections(html) {
    const main = /<main[^>]*>([\s\S]*?)<\/main>/.exec(html)?.[1];
    if (!main)
        return [];
    const policies = [];
    const sections = main.split(/<h2[^>]*\bwp-block-heading\b[^>]*>/).slice(1);
    for (const sectionHtml of sections) {
        const section = stripTags(sectionHtml.split('</h2>')[0]).slice(0, 60);
        const items = sectionHtml.split(/<h3[^>]*\bwp-block-heading\b[^>]*>/).slice(1);
        for (const item of items) {
            const title = stripTags(item.split('</h3>')[0]).slice(0, 140);
            const bodyHtml = item.slice(item.indexOf('</h3>') + 5);
            const body = blockText(bodyHtml);
            if (title && body) {
                policies.push({ section, title, body, links: collectLinks(bodyHtml) });
            }
        }
    }
    // One-off h3s elsewhere on a page are not a platform; demand a real outline.
    return policies.length >= 2 ? policies : [];
}
// ── Format 5: Elementor heading pairs (johnkellyforchi.com) ──────────────
// One long Elementor page where each policy is an <h2> title widget followed
// IMMEDIATELY by another heading widget (the lede); everything up to the next
// such pair is the policy body. Intro content before the first pair is
// dropped, and the page is cut at the consent banner / footer.
function parseElementorPairs(html) {
    // This format must never fire on popup-card sites (format 2's layout).
    if (html.includes('data-elementor-type="popup"'))
        return [];
    const cutAt = html.search(/<footer\b|wpconsent-banner|data-elementor-type="footer"/i);
    const page = cutAt >= 0 ? html.slice(0, cutAt) : html;
    const heads = [
        ...page.matchAll(/<h2[^>]*class="elementor-heading-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/g),
    ];
    const titles = [];
    for (const m of heads) {
        // A title's very next widget is another heading (its lede); prose
        // headings are followed by text editors instead.
        const after = page.slice(m.index + m[0].length, m.index + m[0].length + 700);
        const nextWidget = /data-widget_type="([^"]+)"/.exec(after);
        if (nextWidget?.[1] === 'heading.default') {
            titles.push({
                title: stripTags(m[1]).slice(0, 140),
                start: m.index,
                bodyFrom: m.index + m[0].length,
            });
        }
    }
    if (titles.length < 2)
        return [];
    return titles.map((t, i) => {
        const bodyHtml = page.slice(t.bodyFrom, titles[i + 1]?.start ?? page.length);
        return {
            section: '',
            title: t.title,
            body: blockText(bodyHtml),
            links: collectLinks(bodyHtml),
        };
    });
}
// ── Format 6: Google Sites (brooksforchicago.com) ────────────────────────
// Content lives in <div role="main">; each policy is an <h1> section (the
// first h1 is the page title and is skipped), with h3 sub-heads and
// paragraphs following. Google Sites emits inline CSS blobs as text - lines
// with braces are dropped.
function parseGoogleSites(html) {
    if (!/<div[^>]*\brole="main"/.test(html))
        return [];
    // Sites markup never div-balances cleanly; cut the page at its footer and
    // section on h1s instead (the first h1 is the page title, not a policy).
    const footer = html.indexOf('<footer');
    const main = footer >= 0 ? html.slice(0, footer) : html;
    const chunks = main.split(/<h1[^>]*>/).slice(2); // drop preamble + page-title h1
    const policies = [];
    for (const chunk of chunks) {
        const title = stripTags(chunk.split('</h1>')[0]).slice(0, 140);
        const bodyHtml = chunk.slice(chunk.indexOf('</h1>') + 5);
        const body = blockText(bodyHtml)
            .split('\n')
            .filter((line) => !(line.includes('{') && line.includes('}')))
            .join('\n');
        if (title && body.trim()) {
            policies.push({ section: '', title, body, links: collectLinks(bodyHtml) });
        }
    }
    return policies;
}
// ── Format 7: details/summary accordions (williewilson2027.com) ──────────
// Native <details> disclosure widgets: the <summary> leads with the policy
// title in its first inline element, the rest of the summary is a tagline
// (minus any "Read more" affordance), and the expanded content is the body.
function parseDetailsAccordions(html) {
    const policies = [];
    for (const m of html.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)) {
        const summaryHtml = m[1];
        const first = /<(span|b|strong|h\d)[^>]*>([\s\S]*?)<\/\1>/.exec(summaryHtml);
        const title = stripTags(first ? first[2] : summaryHtml).slice(0, 140);
        const tagline = first
            ? stripTags(summaryHtml.slice(first.index + first[0].length))
                .replace(/read more\s*$/i, '')
                .trim()
            : '';
        const bodyHtml = m[2];
        const body = [tagline, blockText(bodyHtml)].filter(Boolean).join('\n\n');
        if (title && body.trim()) {
            policies.push({ section: '', title, body, links: collectLinks(bodyHtml) });
        }
    }
    // A lone <details> is site chrome (cookie prefs, FAQs); a platform has many.
    return policies.length >= 2 ? policies : [];
}
// ── Dispatch ─────────────────────────────────────────────────────────────
const FORMATS = [
    parseGroupedLists,
    parseElementorPopups,
    parseAccordions,
    parseWpSections,
    parseElementorPairs,
    parseGoogleSites,
    parseDetailsAccordions,
];
/**
 * Parse a platform page. Returns every policy in page order; throws when the
 * page yields nothing (a layout change must fail the sync loudly rather than
 * archive an entire platform).
 */
function parsePlatformHtml(html) {
    for (const parse of FORMATS) {
        const raw = parse(html);
        if (raw.length === 0)
            continue;
        return finalize(raw);
    }
    throw new Error('No policies found - the page layout may have changed.');
}
function finalize(raw) {
    const usedSlugs = new Set();
    return raw.map((p, order) => {
        let slug = slugify(p.title);
        for (let n = 2; usedSlugs.has(slug); n += 1)
            slug = `${slugify(p.title)}-${n}`;
        usedSlugs.add(slug);
        return { ...p, slug, body: p.body.slice(0, exports.MAX_BODY), order };
    });
}
/**
 * Longest policy body kept, matching firestore.rules and the edit-policy
 * field. Sized for full written plans (Quigley's run 10,000 to 13,000
 * characters); the app collapses long bodies behind Show more.
 */
exports.MAX_BODY = 20000;
/** Static per-pillar pages (cardenas4chicago.com): links to pillar-*.html. */
function hubPillarPages(html, baseUrl) {
    const links = [];
    const seen = new Set();
    for (const m of html.matchAll(/<a[^>]*href="((?:[^"]*\/)?pillar-[a-z0-9-]+\.html)"[^>]*>([\s\S]*?)<\/a>/g)) {
        const url = new URL(m[1], baseUrl).toString();
        if (seen.has(url))
            continue;
        seen.add(url);
        links.push({ title: stripTags(m[2]).slice(0, 140), url });
    }
    return links;
}
/** Squarespace button hubs (quigleyforchicago.com): sqs buttons to subpages. */
function hubSquarespaceButtons(html, baseUrl) {
    // Site chrome that is never a policy page, even when presented as a button.
    const chrome = new Set([
        '/', '/about', '/cart', '/contact', '/donate', '/media', '/news', '/press',
        '/priorities', '/privacy', '/volunteer',
    ]);
    const links = [];
    const seen = new Set();
    for (const m of html.matchAll(/<a[^>]*href="(\/[a-z0-9-]*)"[^>]*class="[^"]*sqs-block-button-element[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
        const path = m[1];
        const title = stripTags(m[2]).slice(0, 140);
        if (chrome.has(path) || seen.has(path) || !title)
            continue;
        seen.add(path);
        links.push({ title, url: new URL(path, baseUrl).toString() });
    }
    return links;
}
/** RUN! website builder hubs (mattbrewer.com): plain links to /issues/<slug> pages. */
function hubRunIssues(html, baseUrl) {
    const links = [];
    const seen = new Set();
    for (const m of html.matchAll(/<a[^>]*href="(\/issues\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
        const path = m[1];
        const title = stripTags(m[2]).slice(0, 140);
        if (seen.has(path) || !title)
            continue;
        seen.add(path);
        links.push({ title, url: new URL(path, baseUrl).toString() });
    }
    return links;
}
/** SHOUTING CASE titles (Squarespace headers) read better in title case. */
function titleCase(text) {
    if (text !== text.toUpperCase())
        return text;
    return text
        .toLowerCase()
        .replace(/(^|[\s-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}
/** One subpage, one policy: lead heading is the title, <main> is the body. */
function parseSubpage(html, link) {
    const mainHtml = /<main[^>]*>([\s\S]*?)<\/main>/.exec(html)?.[1] ?? html;
    // Cross-promo sections at the tail of pillar pages are chrome, not policy.
    const cut = mainHtml.search(/>\s*Explore Other Pillars\s*</i);
    const contentHtml = cut >= 0 ? mainHtml.slice(0, mainHtml.lastIndexOf('<', cut)) : mainHtml;
    const lead = /<(h[1-2])[^>]*>([\s\S]*?)<\/\1>/.exec(contentHtml);
    const title = titleCase(stripTags(lead?.[2] ?? '') || link.title).slice(0, 140);
    const bodyHtml = lead ? contentHtml.slice(lead.index + lead[0].length) : contentHtml;
    const body = blockText(bodyHtml);
    if (!title || !body.trim())
        return null;
    const links = collectLinks(bodyHtml).filter((l) => !/actblue\.com|winred\.com|\/donate\b/i.test(l.url));
    return { section: '', title, body, links };
}
/**
 * cardenas4chicago.com draws its pillar grid in the browser from
 * data/pillars.json; the static html links only whichever pillars the
 * homepage happens to feature. When that manifest exists it is the full,
 * ordered list, so it wins over the scraped links.
 */
async function pillarManifest(baseUrl, fetchHtml) {
    try {
        const data = JSON.parse(await fetchHtml(new URL('data/pillars.json', baseUrl).toString()));
        if (!Array.isArray(data))
            return [];
        return data
            .filter((p) => typeof p?.title === 'string' && typeof p?.path === 'string' && /^pillar-[a-z0-9-]+\.html$/.test(p.path))
            .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
            .map((p) => ({ title: p.title.slice(0, 140), url: new URL(p.path, baseUrl).toString() }));
    }
    catch {
        return [];
    }
}
const HUBS = [hubPillarPages, hubSquarespaceButtons, hubRunIssues];
/**
 * Parse a platform from its source URL, following hub pages to their
 * subpages when the layout calls for it. This is the entry point for the
 * nightly sync and the operator script; parsePlatformHtml remains the
 * single-page core. Throws when nothing yields policies.
 */
async function parsePlatformUrl(sourceUrl, fetchHtml) {
    const html = await fetchHtml(sourceUrl);
    for (const hub of HUBS) {
        let links = hub(html, sourceUrl);
        if (hub === hubPillarPages && links.length > 0) {
            const manifest = await pillarManifest(sourceUrl, fetchHtml);
            if (manifest.length > links.length)
                links = manifest;
        }
        if (links.length < 2)
            continue;
        const raw = [];
        for (const link of links) {
            try {
                const policy = parseSubpage(await fetchHtml(link.url), link);
                if (policy)
                    raw.push(policy);
            }
            catch (e) {
                console.warn(`Subpage ${link.url} failed:`, e);
            }
        }
        // Every subpage failing means the hub match was wrong or the site is
        // down - fall through rather than wrongly archiving the platform.
        if (raw.length > 0)
            return finalize(raw);
    }
    return parsePlatformHtml(html);
}
//# sourceMappingURL=platform.js.map