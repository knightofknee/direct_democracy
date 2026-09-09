import { ordinal } from '@/constants/chicago';

/**
 * The upcoming elections a Chicago voter faces, and the fixed facts about
 * them (dates, race lists, official links). Candidate cards live in the
 * `electionCandidates` collection, seeded by scripts/seed-election.ts from
 * scripts/data/*.json - update the JSON and re-seed, never this file, when
 * the field changes. This file changes only when the ballot structure does.
 *
 * Election ids match the data files: '2026-general', '2027-municipal'.
 */

export const GENERAL_ELECTION = '2026-general';
export const MUNICIPAL_ELECTION = '2027-municipal';

export const GENERAL_ELECTION_DATE = 'November 3, 2026';
export const MUNICIPAL_ELECTION_DATE = 'February 23, 2027';
export const MUNICIPAL_RUNOFF_DATE = 'April 6, 2027';

/** Address lookup: registration status, sample ballot, polling place. */
export const VOTER_LOOKUP_URL = 'https://chicagoelections.gov/voting/your-voter-information';

/**
 * How to vote in the November 3, 2026 general election. Dates verified on
 * chicagoelections.gov (election calendar, register, vote-by-mail, and
 * early-voting pages) on 2026-09-07; the Board marks some early-voting
 * details "subject to change", so re-verify when it updates the pages.
 */
export const HOW_TO_VOTE_2026 = {
  electionDay: 'Tuesday, November 3',
  pollingHours: '6 am to 7 pm, at your precinct or any vote center in the city',
  register: {
    online: 'online through October 18 (needs an Illinois license or state ID)',
    mail: 'by mail through October 6',
    inPerson:
      'in person through election day itself, at any early voting site or polling place, with two forms of ID (one showing your address)',
    url: 'https://chicagoelections.gov/voting/register-votechange-name-or-address',
  },
  voteByMail: {
    applyBy: 'apply by October 29, 5 pm',
    detail:
      'ballots start mailing September 24; return by mail or at any secured drop box (one at every ward early voting site)',
    url: 'https://chicagoelections.gov/voting/vote-mail',
  },
  earlyVoting: {
    starts: 'downtown from October 1 (137 S. State St.), all 50 wards from October 19',
    detail: 'any Chicago voter can use any site',
    url: 'https://chicagoelections.gov/voting/early-voting',
  },
} as const;

/**
 * Voting milestones as dates, for the countdown at the top of the election
 * tab. Same facts as HOW_TO_VOTE_2026 (verified on chicagoelections.gov,
 * 2026-09-07); the municipal date closes the list so the countdown keeps
 * working after November. Local midnight, Chicago.
 */
// Labels are verb phrases so they read as one sentence with the countdown
// appended: "Early voting starts in 22 days", "Election day is today".
export const VOTING_MILESTONES: { date: string; label: string; election: string }[] = [
  { date: '2026-10-01', label: 'Early voting starts', election: '2026-11-03' },
  { date: '2026-10-06', label: 'Mail registration closes', election: '2026-11-03' },
  { date: '2026-10-18', label: 'Online registration closes', election: '2026-11-03' },
  { date: '2026-10-19', label: 'Early voting opens in every ward', election: '2026-11-03' },
  { date: '2026-10-29', label: 'Mail ballot applications close', election: '2026-11-03' },
  { date: '2026-11-03', label: 'General election day is', election: '2026-11-03' },
  { date: '2027-02-23', label: 'Municipal election day is', election: '2027-02-23' },
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
): { date: string; label: string; election: string; electionDays: number | null } | null {
  const next = VOTING_MILESTONES.find((m) => daysUntil(m.date, now) >= 0);
  if (!next) return null;
  const electionDays = daysUntil(next.election, now);
  return {
    date: next.date,
    label: next.label,
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
 * The November 2026 races every Chicago voter sees, in ballot-ish order:
 * federal, then statewide, then countywide. The school board races have
 * their own section (src/constants/school-board.ts), and district-dependent
 * races (US House, state legislature, judicial subcircuits) are pointed at
 * the address lookup instead of listed - they vary by where you live.
 */
export const GENERAL_2026_RACES: RaceInfo[] = [
  {
    id: 'us-senate',
    label: 'United States Senate',
    detail: 'The open seat Dick Durbin is retiring from after 30 years.',
  },
  {
    id: 'governor',
    label: 'Governor & Lieutenant Governor',
    detail: "Illinois' chief executive, elected statewide as a ticket.",
  },
  {
    id: 'attorney-general',
    label: 'Attorney General',
    detail: "The state's chief legal officer.",
  },
  {
    id: 'secretary-of-state',
    label: 'Secretary of State',
    detail: 'Runs the DMV, business registrations, and state records.',
  },
  {
    id: 'comptroller',
    label: 'Comptroller',
    detail: "Pays the state's bills; an open seat in 2026.",
  },
  {
    id: 'treasurer',
    label: 'Treasurer',
    detail: "Invests the state's money.",
  },
];

/** Countywide races on the same ballot; appended to the race list. */
export const COOK_2026_RACES: RaceInfo[] = [
  {
    id: 'cook-board-president',
    label: 'President, Cook County Board',
    detail: "The county's chief executive: budget, health system, jail.",
  },
  {
    id: 'cook-assessor',
    label: 'Cook County Assessor',
    detail: 'Sets the property values your tax bill is built on; an open seat after the incumbent lost his primary.',
  },
  {
    id: 'cook-treasurer',
    label: 'Cook County Treasurer',
    detail: 'Collects and distributes property taxes.',
  },
  {
    id: 'cook-sheriff',
    label: 'Cook County Sheriff',
    detail: 'Runs the county jail and sheriff police.',
  },
  {
    id: 'cook-clerk',
    label: 'Cook County Clerk',
    detail: 'Vital records, property tax rates, and suburban elections.',
  },
  {
    id: 'mwrd',
    label: 'MWRD Commissioners',
    detail: 'The water reclamation board: sewage and flood control. You vote for three of the six-year seats.',
  },
  {
    id: 'mwrd-2yr',
    label: 'MWRD Commissioner (2-year seat)',
    detail: 'A separate ballot line filling an unexpired term.',
  },
];

/**
 * The one ballot question Chicago voters see in November 2026: a countywide
 * advisory question the Cook County Board placed on the ballot (there are
 * no statewide amendments or questions this cycle). Nonbinding.
 */
export const GENERAL_2026_QUESTION = {
  title: 'Advisory question: a statewide "millionaire tax"',
  summary:
    'Shall Illinois adopt a 3% income tax surcharge on income over $1 million, with half the revenue for property tax relief and half for public school funding? Advisory only - the result binds nobody, it measures support.',
} as const;

/**
 * Judges: the ballot section voters find hardest. The app carries the
 * retention list and contested vacancies with the bar associations'
 * published ratings, and leans on Injustice Watch, whose guide is the
 * deepest reporting on these judges, as the tool to read before voting.
 */
export const JUDICIAL_2026 = {
  detail:
    'Every Cook County judge up for retention needs a yes from 60 percent of voters to keep the job. Bar associations screen each one; Injustice Watch reports on their records.',
  guideLabel: 'Injustice Watch judicial guide',
  guideUrl: 'https://www.injusticewatch.org/judges/judicial-elections/2026-retention/',
  cbaLabel: 'Chicago Bar Association evaluations',
  cbaUrl: 'https://www.chicagobar.org/chicagobar/Judicial_Evaluations',
} as const;

export const JUDICIAL_RACES: RaceInfo[] = [
  {
    id: 'judicial-retention',
    label: 'Judges up for retention',
    detail: 'A yes-or-no vote on every sitting judge whose term is ending.',
  },
  {
    id: 'judicial-appellate',
    label: 'Appellate Court, First District',
    detail: 'Vacancies on the court that hears appeals from Cook County.',
  },
  {
    id: 'judicial-circuit',
    label: 'Circuit Court, countywide vacancies',
    detail: 'Trial judges elected by the whole county.',
  },
];

/**
 * Race families that depend on where you live. District numbers present
 * in the seeded data decide which cells render; labels come from here.
 */
export const DISTRICT_FAMILIES: {
  prefix: string;
  label: string;
  detail: string;
  districtLabel: (n: number) => string;
}[] = [
  {
    prefix: 'us-house',
    label: 'US House of Representatives',
    detail: 'Chicago is split across nine congressional districts.',
    districtLabel: (n) => `US House, ${ordinal(n)} District`,
  },
  {
    prefix: 'il-senate',
    label: 'Illinois Senate',
    detail: 'Only some Senate seats are up this year.',
    districtLabel: (n) => `Illinois Senate, ${ordinal(n)} District`,
  },
  {
    prefix: 'il-house',
    label: 'Illinois House',
    detail: 'Every House seat is up.',
    districtLabel: (n) => `Illinois House, ${ordinal(n)} District`,
  },
  {
    prefix: 'cook-commissioner',
    label: 'Cook County Commissioner',
    detail: 'The county board; every district is up.',
    districtLabel: (n) => `Cook County Commissioner, ${ordinal(n)} District`,
  },
  {
    prefix: 'cook-board-of-review',
    label: 'Cook County Board of Review',
    detail: 'Hears property assessment appeals.',
    districtLabel: (n) => `Board of Review, ${ordinal(n)} District`,
  },
  {
    prefix: 'judicial-subcircuit',
    label: 'Circuit Court, subcircuit vacancies',
    detail: 'Trial judges elected by one part of the county.',
    districtLabel: (n) => `Circuit Court, ${ordinal(n)} Subcircuit`,
  },
];

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
    id: 'treasurer',
    label: 'City Treasurer',
    detail: "Manages the city's cash and pension investments.",
  },
];

/** Petition filing window for the 2027 municipal ballot. */
export const MUNICIPAL_2027_FILING = 'Candidates file October 19-26, 2026';

/** 'ward-25' → '25th Ward'; 'pdc-12' → '12th Police District Council'. */
export function municipalRaceLabel(race: string): string {
  const ward = race.match(/^ward-(\d+)$/);
  if (ward) return `${ordinal(Number(ward[1]))} Ward`;
  const pdc = race.match(/^pdc-(\d+)$/);
  if (pdc) return `${ordinal(Number(pdc[1]))} Police District Council`;
  return MUNICIPAL_2027_CITYWIDE.find((r) => r.id === race)?.label ?? race;
}

/** Label for any November race id, including district-numbered families. */
export function generalRaceLabel(race: string): string {
  const fixed = [...GENERAL_2026_RACES, ...COOK_2026_RACES, ...JUDICIAL_RACES].find(
    (r) => r.id === race
  );
  if (fixed) return fixed.label;
  for (const f of DISTRICT_FAMILIES) {
    const m = race.match(new RegExp(`^${f.prefix}-(\\d+)$`));
    if (m) return f.districtLabel(Number(m[1]));
  }
  return race;
}

/** Everything the race screen needs to head a race, for either election. */
export function raceInfo(race: string): { election: string; label: string; detail: string } {
  const municipal =
    /^(ward|pdc)-\d+$/.test(race) || MUNICIPAL_2027_CITYWIDE.some((r) => r.id === race);
  if (municipal) {
    const cw = MUNICIPAL_2027_CITYWIDE.find((r) => r.id === race);
    return {
      election: MUNICIPAL_ELECTION,
      label: municipalRaceLabel(race),
      detail: cw?.detail ?? (race.startsWith('pdc-') ? 'Three seats; the top three vote-getters win.' : ''),
    };
  }
  const fixed = [...GENERAL_2026_RACES, ...COOK_2026_RACES, ...JUDICIAL_RACES].find(
    (r) => r.id === race
  );
  if (fixed) return { election: GENERAL_ELECTION, label: fixed.label, detail: fixed.detail };
  for (const f of DISTRICT_FAMILIES) {
    const m = race.match(new RegExp(`^${f.prefix}-(\\d+)$`));
    if (m) return { election: GENERAL_ELECTION, label: f.districtLabel(Number(m[1])), detail: f.detail };
  }
  return { election: GENERAL_ELECTION, label: race, detail: '' };
}

/** Does this race id exist at all (for the race screen's not-found state). */
export function isKnownRace(race: string): boolean {
  return raceInfo(race).label !== race;
}
