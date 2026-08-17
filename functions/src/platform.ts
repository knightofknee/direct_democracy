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

export interface ParsedPolicy {
  /** Stable doc id derived from the title - votes/comments survive re-syncs. */
  slug: string;
  section: string;
  title: string;
  body: string;
  links: { label: string; url: string }[];
  order: number;
}

/** Minimal HTML entity decoding for the entities the site actually emits. */
function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
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

export function slugify(title: string): string {
  return (
    stripTags(title)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'policy'
  );
}

/**
 * Parse a platform page. Returns every policy in page order; throws when the
 * page yields nothing (a layout change must fail the sync loudly rather than
 * archive an entire platform).
 */
export function parsePlatformHtml(html: string): ParsedPolicy[] {
  const policies: ParsedPolicy[] = [];
  const usedSlugs = new Set<string>();

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

      const links: { label: string; url: string }[] = [];
      for (const a of bodyHtml.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
        const url = decodeEntities(a[1]);
        const label = stripTags(a[2]).slice(0, 140);
        if (url.startsWith('https://') && label && links.length < 20) {
          links.push({ label, url });
        }
      }

      let slug = slugify(title);
      for (let n = 2; usedSlugs.has(slug); n += 1) slug = `${slugify(title)}-${n}`;
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
