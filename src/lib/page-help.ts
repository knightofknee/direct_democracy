import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { PAGE_HELP } from '@/constants/page-help';

/**
 * The live half of each page's help sheet (2026-09-30): a few lines built
 * from the data the page already has ("49 votes, 74% rate it 4 or 5"),
 * so the sheet summarizes what is on the screen right now, not just what
 * the screen is for. Each screen hands its lines over while it is focused;
 * the help sheet, opened on top of it, reads them. No AI: every line is a
 * translated template filled with the page's own numbers.
 */
let current: { page: string; lines: string[] } | null = null;

const SEP = '\u0000';

/**
 * Report this screen's summary lines (falsy entries are skipped). `page`
 * is the screen's help key, the same as helpKey() gives for its route.
 */
export function usePageSummary(page: string, lines: (string | false | null | undefined)[]): void {
  const joined = lines.filter((l): l is string => !!l).join(SEP);
  useFocusEffect(
    useCallback(() => {
      current = { page, lines: joined ? joined.split(SEP) : [] };
    }, [page, joined])
  );
}

/** The lines the focused screen reported, if it is the page asked about. */
export function pageSummary(page: string): string[] {
  return current?.page === page ? current.lines : [];
}

/** A route's help key, from useSegments(): 'concern/[id]', '(tabs)/ward'. */
export function helpKey(segments: string[]): string {
  const key = segments.join('/');
  return key === '' || key === '(tabs)' ? '(tabs)/index' : key;
}

/** The fixed help for a page, picking the command tab's entry by role. */
export function pageHelp(page: string, role: string | undefined) {
  if (page === '(tabs)/command') {
    return PAGE_HELP[`${page}#${role === 'candidate' ? 'candidate' : 'official'}`];
  }
  return PAGE_HELP[page];
}
