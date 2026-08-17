"use strict";
/**
 * Campaign-site platform parser. Turns a candidate's policy page into the
 * app's Policy shape so the site stays the single source of truth and nothing
 * is hand-entered twice.
 *
 * Built against waldgrave.com/chigui's markup: each platform section is an
 * <h4 class="... groupHead">Section</h4> followed by a <ul class="... policies">
 * of <li class="... policyItem"><b>Title:</b> body …</li>. Matching keys on
 * those stable class names, never on the styled-jsx hash classes, which change
 * every site build.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugify = slugify;
exports.parsePlatformHtml = parsePlatformHtml;
/** Minimal HTML entity decoding for the entities the site actually emits. */
function decodeEntities(text) {
    const named = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        nbsp: ' ',
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
function slugify(title) {
    return (stripTags(title)
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'policy');
}
/**
 * Parse a platform page. Returns every policy in page order; throws when the
 * page yields nothing (a layout change must fail the sync loudly rather than
 * archive an entire platform).
 */
function parsePlatformHtml(html) {
    const policies = [];
    const usedSlugs = new Set();
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
            const links = [];
            for (const a of bodyHtml.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
                const url = decodeEntities(a[1]);
                const label = stripTags(a[2]).slice(0, 140);
                if (url.startsWith('https://') && label && links.length < 20) {
                    links.push({ label, url });
                }
            }
            let slug = slugify(title);
            for (let n = 2; usedSlugs.has(slug); n += 1)
                slug = `${slugify(title)}-${n}`;
            usedSlugs.add(slug);
            policies.push({
                slug,
                section,
                title,
                body: stripTags(bodyHtml).slice(0, 8000),
                links,
                order: policies.length,
            });
        }
    }
    if (policies.length === 0) {
        throw new Error('No policies found - the page layout may have changed.');
    }
    return policies;
}
//# sourceMappingURL=platform.js.map