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

export interface ParsedPolicy {
  /** Stable doc id derived from the title - votes/comments survive re-syncs. */
  slug: string;
  section: string;
  title: string;
  body: string;
  links: { label: string; url: string }[];
  order: number;
}

/** A policy as one format parser sees it, before slugs and order are assigned. */
interface RawPolicy {
  section: string;
  title: string;
  body: string;
  links: { label: string; url: string }[];
}

/** Minimal HTML entity decoding for the entities the sites actually emit. */
function decodeEntities(text: string): string {
  const named: Record<string, string> = {
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
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[entity] ?? match;
  });
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Flatten an HTML fragment to readable multi-paragraph text: block elements
 * become lines, list items become "- " bullets, and paragraphs are separated
 * by a blank line (consecutive bullets stay tight).
 */
function blockText(html: string): string {
  const prepped = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<li[^>]*>/gi, '\n\u0001')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|ul|ol|li|h[1-6])>/gi, '\n');
  const lines = decodeEntities(prepped.replace(/<[^>]+>/g, ''))
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let text = '';
  let prevBullet = false;
  for (const raw of lines) {
    const bullet = raw.startsWith('\u0001');
    const line = bullet ? `- ${raw.slice(1).trim()}` : raw;
    if (text) text += bullet && prevBullet ? '\n' : '\n\n';
    text += line;
    prevBullet = bullet;
  }
  return text;
}

export function slugify(title: string): string {
  return (
    stripTags(title)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'policy'
  );
}

/** Collect the https links inside a fragment, for the policy's receipts. */
function collectLinks(html: string): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
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
function divBlock(html: string, start: number): string | null {
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
function decodeBase64(b64: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const ch of b64.replace(/=+$/, '')) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
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

function parseGroupedLists(html: string): RawPolicy[] {
  const policies: RawPolicy[] = [];

  // Split on section headers; chunk 0 is everything before the first one.
  const sections = html.split(/<h4[^>]*\bgroupHead\b[^>]*>/).slice(1);
  for (const sectionHtml of sections) {
    const section = stripTags(sectionHtml.split('</h4>')[0]).slice(0, 60);
    const list = /<ul[^>]*\bpolicies\b[^>]*>([\s\S]*?)<\/ul>/.exec(sectionHtml);
    if (!list) continue;

    const items = list[1].split(/<li[^>]*\bpolicyItem\b[^>]*>/).slice(1);
    for (const item of items) {
      const titled = /<b[^>]*>([\s\S]*?)<\/b>([\s\S]*)/.exec(item);
      if (!titled) continue;
      const title = stripTags(titled[1]).replace(/:$/, '').slice(0, 140);
      if (!title) continue;
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

function parseElementorPopups(html: string): RawPolicy[] {
  // The popup documents, keyed by their Elementor id.
  const popups = new Map<string, string>();
  for (const m of html.matchAll(
    /<div\b[^>]*data-elementor-type="popup"[^>]*data-elementor-id="(\d+)"[^>]*>/g
  )) {
    const block = divBlock(html, m.index);
    if (block) popups.set(m[1], block);
  }
  if (popups.size === 0) return [];

  // The cards: anchors whose elementor-action href encodes the popup to open
  // as url-encoded base64 JSON ({"id":"1950",...}). Card order is page order.
  const policies: RawPolicy[] = [];
  for (const a of html.matchAll(/<a[^>]*href="(#elementor-action[^"]*)"[^>]*>/g)) {
    const anchor = html.slice(a.index, html.indexOf('</a>', a.index));
    const titled = /elementor-cta__title[^>]*>([\s\S]*?)<\/h\d>/.exec(anchor);
    if (!titled) continue;
    const title = stripTags(titled[1]).slice(0, 140);

    const settings = /settings%3D([A-Za-z0-9%]+)/.exec(a[1]);
    const decoded = settings ? decodeBase64(decodeURIComponent(settings[1])) : '';
    const popupId = /"id":"?(\d+)"?/.exec(decoded)?.[1];
    const popup = popupId ? popups.get(popupId) : undefined;
    if (!title || !popup) continue;

    // The popup's own lead heading repeats the card title - drop it, the
    // rest (sub-headings and paragraphs) is the body.
    const bodyHtml = popup.replace(
      /<h\d[^>]*elementor-heading-title[^>]*>[\s\S]*?<\/h\d>/,
      ''
    );
    policies.push({ section: '', title, body: blockText(bodyHtml), links: collectLinks(bodyHtml) });
  }
  return policies;
}

// ── Format 3: accordion cards (joeforchicago.com) ────────────────────────

function parseAccordions(html: string): RawPolicy[] {
  const policies: RawPolicy[] = [];
  const seenTitles = new Set<string>();

  for (const m of html.matchAll(/<button[^>]*class="accordion-header[^"]*"[^>]*>/g)) {
    const segment = html.slice(m.index);
    const titled = /<h\d[^>]*>([\s\S]*?)<\/h\d>/.exec(segment);
    if (!titled) continue;
    const title = stripTags(titled[1]).slice(0, 140);

    const content = /<div[^>]*class="accordion-content[^"]*"[^>]*>/.exec(segment);
    if (!title || !content) continue;
    const block = divBlock(segment, content.index);
    if (!block) continue;

    // Desktop card grids repeat the same policies - keep the first rendering.
    if (seenTitles.has(title)) continue;
    seenTitles.add(title);
    policies.push({ section: '', title, body: blockText(block), links: collectLinks(block) });
  }
  return policies;
}

// ── Dispatch ─────────────────────────────────────────────────────────────

const FORMATS = [parseGroupedLists, parseElementorPopups, parseAccordions];

/**
 * Parse a platform page. Returns every policy in page order; throws when the
 * page yields nothing (a layout change must fail the sync loudly rather than
 * archive an entire platform).
 */
export function parsePlatformHtml(html: string): ParsedPolicy[] {
  for (const parse of FORMATS) {
    const raw = parse(html);
    if (raw.length === 0) continue;

    const usedSlugs = new Set<string>();
    return raw.map((p, order) => {
      let slug = slugify(p.title);
      for (let n = 2; usedSlugs.has(slug); n += 1) slug = `${slugify(p.title)}-${n}`;
      usedSlugs.add(slug);
      return { ...p, slug, body: p.body.slice(0, 8000), order };
    });
  }
  throw new Error('No policies found - the page layout may have changed.');
}
