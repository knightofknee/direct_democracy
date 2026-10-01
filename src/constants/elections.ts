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
      'in person through election day itself (starting October 7 at any open early voting site, and at your polling place on election day), with two forms of ID (one showing your address)',
    url: 'https://chicagoelections.gov/voting/register-votechange-name-or-address',
  },
  voteByMail: {
    applyBy: 'apply by October 29',
    detail:
      'ballots have been mailing since September 24; mail yours back postmarked by November 3 (it must arrive by November 17), or leave it in the secured drop box at any open early voting site',
    url: 'https://chicagoelections.gov/voting/vote-mail',
  },
  earlyVoting: {
    starts: 'downtown starting October 1 (137 S. State St. and 69 W. Washington St., 6th floor), and in all 50 wards starting October 19',
    detail: 'any Chicago voter can use any site',
    url: 'https://chicagoelections.gov/voting/early-voting',
  },
} as const;

/**
 * Help that makes voting possible for people the basics don't cover. Every
 * line verified on chicagoelections.gov, 2026-09-29 (accessibility,
 * language access, vote by mail, election judges, register pages).
 */
export const VOTING_HELP_2026 = [
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
 * Voting milestones as dates, for the countdown at the top of the election
 * tab. Same facts as HOW_TO_VOTE_2026 (verified on chicagoelections.gov,
 * 2026-09-07); the municipal date closes the list so the countdown keeps
 * working after November. Local midnight, Chicago.
 */
// Labels are verb phrases so they read as one sentence with the countdown
// appended: "Early voting opens downtown in 22 days", "Election day is today".
/**
 * The countdown on the election tab: `label` + "today" / "tomorrow" / "in N
 * days", then `detail`, which says who and where the date applies to (a
 * date that's true for one site or one way of voting must never read as
 * true for all of them). Dates checked on chicagoelections.gov 2026-09-30.
 */
export const VOTING_MILESTONES: { date: string; label: string; detail: string; election: string }[] = [
  {
    date: '2026-10-01',
    label: 'Early voting opens downtown',
    detail: 'At 137 S. State St. and 69 W. Washington St. Sites in every ward open October 19.',
    election: '2026-11-03',
  },
  {
    date: '2026-10-06',
    label: 'Registering with a paper form by mail closes',
    detail: 'Online registration stays open through October 18, and in-person registration through election day.',
    election: '2026-11-03',
  },
  {
    date: '2026-10-18',
    label: 'Online registration closes',
    detail: 'You can still register in person at an early voting site or at your polling place on election day, with two forms of ID.',
    election: '2026-11-03',
  },
  {
    date: '2026-10-19',
    label: 'Early voting opens in every ward',
    detail: 'One site per ward, plus the two downtown. Any Chicago voter can use any site.',
    election: '2026-11-03',
  },
  {
    date: '2026-10-29',
    label: 'Mail ballot applications close',
    detail: 'Already have a mail ballot? Mail it back postmarked by November 3, or use a drop box at an early voting site.',
    election: '2026-11-03',
  },
  {
    date: '2026-11-03',
    label: 'General election day is',
    detail: 'Polls are open 6 am to 7 pm. Mail ballots must be postmarked by November 3.',
    election: '2026-11-03',
  },
  {
    date: '2027-02-23',
    label: 'Municipal election day is',
    detail: 'Mayor, city clerk and treasurer, alderman, and police district council.',
    election: '2027-02-23',
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
/**
 * How write-in votes work, shown above the write-in candidates on a race and
 * on each write-in's card. Marking: the Board's voting instructions (Form
 * 255). Counting only declared write-ins, and judges holding the list:
 * 10 ILCS 5/17-16.1. The Board posts no names, only which offices have a
 * write-in line, so cards come from the Cook County Clerk's list and public
 * campaigns in offices that have a Chicago write-in line.
 */
export const WRITE_IN_2026 = {
  explainer:
    "These names are not printed on the ballot. To vote for one, write the name in the blank write-in space for that office and fill in the oval (on a touchscreen, follow the write-in steps on screen). Votes count only for write-ins who filed a declaration. The Chicago Board of Elections does not post those names, so this list comes from the Cook County Clerk's list and campaign announcements; election judges at your polling place have the official one.",
  urlLabel: 'How to mark your ballot (Board of Elections)',
  url: 'https://app.chicagoelections.gov/documents/general/Paper-Ballot-and-Touchscreen-Instructions.pdf',
} as const;

export const JUDICIAL_2026 = {
  detail:
    'Every Cook County judge up for retention needs a yes from 60 percent of voters to keep the job. Bar associations screen each one; Injustice Watch reports on their records.',
  guideLabel: 'Injustice Watch judicial guide',
  guideUrl: 'https://2026retention.injusticewatch.org/',
  cbaLabel: 'Chicago Bar Association evaluations',
  cbaUrl: 'https://www.chicagobar.org/votejudges',
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
    districtLabel: (n) => numbered(`US House, ${ordinal(n)} District`, 'US House, District {n}', n),
  },
  {
    prefix: 'il-senate',
    label: 'Illinois Senate',
    detail: 'Only some Senate seats are up this year.',
    districtLabel: (n) => numbered(`Illinois Senate, ${ordinal(n)} District`, 'Illinois Senate, District {n}', n),
  },
  {
    prefix: 'il-house',
    label: 'Illinois House',
    detail: 'Every House seat is up.',
    districtLabel: (n) => numbered(`Illinois House, ${ordinal(n)} District`, 'Illinois House, District {n}', n),
  },
  {
    prefix: 'cook-commissioner',
    label: 'Cook County Commissioner',
    detail: 'The county board; every district is up.',
    districtLabel: (n) =>
      numbered(`Cook County Commissioner, ${ordinal(n)} District`, 'Cook County Commissioner, District {n}', n),
  },
  {
    prefix: 'cook-board-of-review',
    label: 'Cook County Board of Review',
    detail: 'Hears property assessment appeals.',
    districtLabel: (n) => numbered(`Board of Review, ${ordinal(n)} District`, 'Board of Review, District {n}', n),
  },
  {
    prefix: 'judicial-subcircuit',
    label: 'Circuit Court, subcircuit vacancies',
    detail: 'Trial judges elected by one part of the county.',
    districtLabel: (n) => numbered(`Circuit Court, ${ordinal(n)} Subcircuit`, 'Circuit Court, Subcircuit {n}', n),
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
  if (ward) return wardLabel(Number(ward[1]));
  const pdc = race.match(/^pdc-(\d+)$/);
  if (pdc) {
    const n = Number(pdc[1]);
    return numbered(`${ordinal(n)} Police District Council`, 'Police District {n} Council', n);
  }
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
