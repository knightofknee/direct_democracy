import { ordinal, wardLabel } from '@/constants/chicago';
import { getLocale, tr } from '@/lib/i18n';

/**
 * A numbered district's name in the app's language: English says "7th
 * District", every other language uses its keyed template with the plain
 * number (the same approach as wardLabel).
 */
function numbered(en: string, template: string, n: number): string {
  return getLocale() === 'en' ? en : tr(template).replace('{n}', String(n));
}

/**
 * The next election a Chicago voter faces, and the fixed facts about it
 * (dates, race lists, official links). The November 3, 2026 general
 * election is over (its constants and directory left the app on
 * 2026-11-04); what remains is the February 23, 2027 municipal ballot.
 * Candidate cards for the clerk, treasurer, aldermanic, and police council
 * races live in the `electionCandidates` collection, seeded by
 * scripts/seed-election.ts from scripts/data/municipal-2027.json; the
 * mayoral field lives in `mayorGames/2027` (scripts/data/mayor-games.json).
 * Update the JSON and re-seed, never this file, when a field changes. This
 * file changes only when the ballot structure does.
 */

export const MUNICIPAL_ELECTION = '2027-municipal';

export const MUNICIPAL_ELECTION_DATE = 'February 23, 2027';
export const MUNICIPAL_RUNOFF_DATE = 'April 6, 2027';

/** Address lookup: registration status, sample ballot, polling place. */
export const VOTER_LOOKUP_URL = 'https://chicagoelections.gov/voting/your-voter-information';

/**
 * How to vote in the February 23, 2027 municipal election. Checked on
 * chicagoelections.gov 2026-11-04: so far the Board has posted only the
 * date vote-by-mail applications open; early voting dates and sites for
 * February are not posted yet, and the register page still shows the
 * November deadlines. Each line says only what the Board's pages say; the
 * weekly election task fills the rest in as the Board posts it.
 */
export const HOW_TO_VOTE_2027 = {
  electionDay: 'Tuesday, February 23, 2027',
  runoff: 'If nobody wins a majority, the top two meet in a runoff on Tuesday, April 6, 2027.',
  pollingHours: '6 am to 7 pm',
  register: {
    detail:
      'Register online with an Illinois license or state ID, or in person at any early voting site and at your polling place on election day, with two forms of ID (one showing your address).',
    url: 'https://chicagoelections.gov/voting/register-votechange-name-or-address',
  },
  voteByMail: {
    detail: 'Applications for a February mail ballot open November 25, 2026, online or on paper.',
    url: 'https://chicagoelections.gov/voting/vote-mail',
  },
  earlyVoting: {
    detail:
      'The Board has not posted February early voting dates or sites yet. Any Chicago voter can use any early voting site, and same-day registration is available at all of them.',
    url: 'https://chicagoelections.gov/voting/early-votingvote-centers',
  },
} as const;

/**
 * Help that makes voting possible for people the basics don't cover. Every
 * line verified on chicagoelections.gov, 2026-09-29 (accessibility,
 * language access, vote by mail, election judges, register pages).
 */
export const VOTING_HELP = [
  {
    key: 'accessible',
    icon: 'accessibility-outline',
    text: 'Voting with a disability: an accessible mail ballot you mark online and print, curbside voting (request it by 5 pm the day before election day), and help at 312-269-7976.',
    url: 'https://chicagoelections.gov/voting/accessibilityvoters-disabilities',
  },
  {
    key: 'language',
    icon: 'language-outline',
    text: 'Help in your language: early voting ballots come in 12 languages, many sites have bilingual officials, and you may bring someone to interpret.',
    url: 'https://chicagoelections.gov/voting/language-access-resources',
  },
  {
    key: 'permanent',
    icon: 'repeat-outline',
    text: 'Get a mail ballot for every future election by joining the permanent vote by mail roster.',
    url: 'https://chicagoelections.gov/elections/vote-by-mail/permanent-roster',
  },
  {
    key: 'preregister',
    icon: 'school-outline',
    text: 'Under 18? You can pre-register online at 16.',
    url: 'https://chicagoelections.gov/voting/register-votechange-name-or-address',
  },
  {
    key: 'judge',
    icon: 'ribbon-outline',
    text: 'Work the polls: election judges are paid $170 to $230 for the day. High school juniors and seniors can serve too.',
    url: 'https://chicagoelections.gov/poll-workers/election-day-judges',
  },
] as const;

/**
 * The countdown on the mayor games tab: `label` + "today" / "tomorrow" /
 * "in N days", then `detail`, which says who and where the date applies to
 * (a date that's true for one site or one way of voting must never read as
 * true for all of them). Labels are verb phrases so they read as one
 * sentence with the countdown appended. Dates checked on
 * chicagoelections.gov 2026-11-04; the same list is duplicated in
 * functions/src/index.ts for the deadline reminders and must stay in sync.
 * Local midnight, Chicago.
 */
export const VOTING_MILESTONES: { date: string; label: string; detail: string; election: string }[] = [
  {
    date: '2026-11-25',
    label: 'Mail ballot applications open',
    detail: 'For the February 23 municipal election. Apply online or on paper; the ballot itself is mailed later.',
    election: '2027-02-23',
  },
  {
    date: '2027-02-23',
    label: 'Municipal election day is',
    detail: 'Mayor, city clerk and treasurer, alderman, and police district council. Polls are open 6 am to 7 pm.',
    election: '2027-02-23',
  },
  {
    date: '2027-04-06',
    label: 'Runoff election day is',
    detail: 'Only in races where nobody won a majority on February 23. Polls are open 6 am to 7 pm.',
    election: '2027-04-06',
  },
];

function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from `now` (local midnight) to `iso`; 0 on the day itself. */
export function daysUntil(iso: string, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((localDate(iso).getTime() - today.getTime()) / 86_400_000);
}

/** The first milestone that is today or later, with days to its election. */
export function nextMilestone(
  now: Date
): { date: string; label: string; detail: string; election: string; electionDays: number | null } | null {
  const next = VOTING_MILESTONES.find((m) => daysUntil(m.date, now) >= 0);
  if (!next) return null;
  const electionDays = daysUntil(next.election, now);
  return {
    date: next.date,
    label: next.label,
    detail: next.detail,
    election: next.election,
    electionDays: electionDays > 0 ? electionDays : null,
  };
}

export interface RaceInfo {
  id: string;
  label: string;
  detail: string;
}

/**
 * How write-in votes work, shown on a race with declared write-ins and on
 * each write-in's card. Marking: the Board's voting instructions (Form
 * 255). Counting only declared write-ins, and judges holding the list:
 * 10 ILCS 5/17-16.1.
 */
export const WRITE_IN = {
  explainer:
    'These names are not printed on the ballot. To vote for one, write the name in the blank write-in space for that office and fill in the oval (on a touchscreen, follow the write-in steps on screen). Votes count only for write-ins who filed a declaration; election judges at your polling place have the official list.',
  urlLabel: 'How to mark your ballot (Board of Elections)',
  url: 'https://app.chicagoelections.gov/documents/general/Paper-Ballot-and-Touchscreen-Instructions.pdf',
} as const;

/**
 * Police District Councils: three seats in each of the 22 police districts,
 * elected in the February 2027 municipal election. District numbers are the
 * CPD's (there is no 13th, 21st, or 23rd district).
 */
export const POLICE_DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 22, 24, 25];

/**
 * February 2027 municipal ballot: mayor (the app's main event), the two
 * other citywide offices, and your ward's alderman. All nonpartisan;
 * a runoff follows April 6 in any race nobody wins outright.
 */
export const MUNICIPAL_2027_CITYWIDE: RaceInfo[] = [
  {
    id: 'clerk',
    label: 'City Clerk',
    detail: "Keeps the city's records and runs city vehicle stickers.",
  },
  {
    // Not 'treasurer': that was the November state race, and one id can only
    // name one race (2026-10-09).
    id: 'city-treasurer',
    label: 'City Treasurer',
    detail: "Manages the city's cash and pension investments.",
  },
];

/**
 * Where the February ballot stands: petitions were filed October 19-26,
 * 2026, objections ran through November 2, and the Board certifies the
 * ballot by December 17 (Chicago Board of Elections calendar, as reported
 * 2026-10-26).
 */
export const MUNICIPAL_2027_FILING =
  'Petitions were filed October 19-26, 2026; the Board of Elections certifies the ballot by December 17';

/** 'ward-25' → '25th Ward'; 'pdc-12' → '12th Police District Council'. */
export function municipalRaceLabel(race: string): string {
  const ward = race.match(/^ward-(\d+)$/);
  if (ward) return wardLabel(Number(ward[1]));
  const pdc = race.match(/^pdc-(\d+)$/);
  if (pdc) {
    const n = Number(pdc[1]);
    return numbered(`${ordinal(n)} Police District Council`, 'Police District {n} Council', n);
  }
  return MUNICIPAL_2027_CITYWIDE.find((r) => r.id === race)?.label ?? race;
}

/** Everything the race screen needs to head a race on the February ballot. */
export function raceInfo(race: string): { election: string; label: string; detail: string } {
  const cw = MUNICIPAL_2027_CITYWIDE.find((r) => r.id === race);
  return {
    election: MUNICIPAL_ELECTION,
    label: municipalRaceLabel(race),
    detail: cw?.detail ?? (race.startsWith('pdc-') ? 'Three seats; the top three vote-getters win.' : ''),
  };
}

/** Does this race id exist at all (for the race screen's not-found state). */
export function isKnownRace(race: string): boolean {
  return /^(ward|pdc)-\d+$/.test(race) || MUNICIPAL_2027_CITYWIDE.some((r) => r.id === race);
}
