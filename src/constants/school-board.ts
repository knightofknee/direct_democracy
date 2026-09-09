/**
 * The November 3, 2026 Chicago Board of Education election: the first fully
 * elected board. 21 seats - the board president elected citywide, plus one
 * seat in each of 20 subdistricts (the ten 2024 districts each split in two,
 * labeled 1a through 10b). School board districts are state-drawn and do NOT
 * align with the 50 wards, so a voter's race can't be derived from wardId -
 * the district lookup link is how they find theirs.
 */

import { getLocale } from '@/lib/i18n';

export const SCHOOL_BOARD_ELECTION_DATE = 'November 3, 2026';

/** Chicago Board of Elections lookup: registration, districts, sample ballot. */
export const DISTRICT_LOOKUP_URL = 'https://chicagoelections.gov/voting/your-voter-information';

export interface SchoolBoardRace {
  /** Firestore race key: 'president' or a district id like '4b'. */
  id: string;
  label: string;
  detail: string;
}

const DISTRICT_IDS = Array.from({ length: 10 }, (_, i) => [`${i + 1}a`, `${i + 1}b`]).flat();

export const SCHOOL_BOARD_RACES: SchoolBoardRace[] = [
  { id: 'president', label: 'Board President', detail: 'Every Chicagoan votes in this race' },
  ...DISTRICT_IDS.map((id) => ({
    id,
    label: `District ${id}`,
    detail: 'One seat, voted on by district residents',
  })),
];

export function schoolBoardRaceLabel(id: string): string {
  if (getLocale() === 'es') {
    return id === 'president' ? 'Presidente del Consejo' : `Distrito ${id}`;
  }
  return SCHOOL_BOARD_RACES.find((r) => r.id === id)?.label ?? `District ${id}`;
}
