import type { Locale } from '@/lib/i18n';

/**
 * Each ward's early voting site for the November 3, 2026 general election,
 * and the hours every site keeps. Source: the Chicago Board of Elections'
 * Early Voting Centers poster (Form 177 EVL, rev. 9/26,
 * https://cboeprod.blob.core.usgovcloudapi.net/prod/2026-09/Form177EVL_G2026_8.5x11_FINAL3.pdf)
 * for names, addresses, and hours; the Board's early voting page
 * (https://chicagoelections.gov/voting/early-votingvote-centers) for which
 * sites have bilingual officials. Checked 2026-09-29; the weekly data task
 * re-checks it. Any Chicago voter can use any site.
 */
export const EARLY_VOTING_2026 = {
  opens: 'October 19',
  closes: 'November 3',
  hours: 'Weekdays 9 am to 6 pm, Saturdays 9 am to 5 pm, Sundays 10 am to 4 pm.',
  sourceUrl: 'https://chicagoelections.gov/voting/early-votingvote-centers',
} as const;

export interface EarlyVotingSite {
  name: string;
  address: string;
  /** App languages the site's bilingual officials speak (beyond English). */
  bilingual: Locale[];
}

export const EARLY_VOTING_SITES_2026: Record<number, EarlyVotingSite> = {
  1: { name: 'Goldblatts Building', address: '1615 W. Chicago Ave.', bilingual: ['es'] },
  2: { name: 'Near North Library', address: '310 W. Division St.', bilingual: ['es'] },
  3: { name: 'Dawson Technical Institute', address: '3901 S. State St.', bilingual: [] },
  4: { name: 'Dr. Martin Luther King Center', address: '4314 S. Cottage Grove Ave.', bilingual: [] },
  5: { name: 'Southside YMCA', address: '6330 S. Stony Island Ave.', bilingual: [] },
  6: { name: 'Whitney Young Library', address: '415 E. 79th St.', bilingual: [] },
  7: { name: 'Trumbull Park', address: '2400 E. 105th St.', bilingual: [] },
  8: { name: 'Olive Harvey College', address: '10001 S. Woodlawn Ave.', bilingual: [] },
  9: { name: 'Palmer Park', address: '201 E. 111th St.', bilingual: [] },
  10: { name: 'Vodak-East Side Library', address: '3710 E. 106th St.', bilingual: ['es'] },
  11: { name: 'McGuane Park', address: '2901 S. Poplar Ave.', bilingual: ['zh'] },
  12: { name: 'McKinley Park Library', address: '1915 W. 35th St.', bilingual: ['es', 'zh'] },
  13: { name: 'Clearing Library', address: '6423 W. 63rd Pl.', bilingual: ['pl'] },
  14: { name: 'Archer Heights Library', address: '5055 S. Archer Ave.', bilingual: ['es', 'pl'] },
  15: { name: 'Brighton Park Community Campus (Park No. 596)', address: '4830 S. Western Ave.', bilingual: ['es'] },
  16: { name: 'Lindblom Park', address: '6054 S. Damen Ave.', bilingual: ['es'] },
  17: { name: 'Thurgood Marshall Library', address: '7506 S. Racine Ave.', bilingual: [] },
  18: { name: 'Wrightwood Ashburn Library', address: '8530 S. Kedzie Ave.', bilingual: [] },
  19: { name: 'Mt. Greenwood Park', address: '3721 W. 111th St.', bilingual: [] },
  20: { name: 'Bessie Coleman Library', address: '731 E. 63rd St.', bilingual: [] },
  21: { name: 'West Pullman Library', address: '830 W. 119th St.', bilingual: [] },
  22: { name: 'Toman Library', address: '2708 S. Pulaski Rd.', bilingual: ['es'] },
  23: { name: 'Ward Hall, St. Faustina Kowalska Parish', address: '5157 S. McVicker Ave.', bilingual: ['es', 'pl'] },
  24: { name: 'St. Agatha Catholic Parish', address: '3151 W. Douglas Blvd.', bilingual: [] },
  25: { name: 'Rudy Lozano Library', address: '1805 S. Loomis St.', bilingual: ['es'] },
  26: { name: 'Humboldt Park Library', address: '1605 N. Troy St.', bilingual: ['es'] },
  27: { name: 'Union Park', address: '1501 W. Randolph St.', bilingual: [] },
  28: { name: 'Malcolm X College, West Campus', address: '4624 W. Madison St.', bilingual: ['es'] },
  29: { name: 'Amundsen Park', address: '6200 W. Bloomingdale Ave.', bilingual: [] },
  30: { name: 'Kilbourn Park', address: '3501 N. Kilbourn Ave.', bilingual: ['es'] },
  31: { name: 'Portage Cragin Library', address: '5108 W. Belmont Ave.', bilingual: ['es', 'pl'] },
  32: { name: 'Bucktown-Wicker Park Library', address: '1701 N. Milwaukee Ave.', bilingual: [] },
  33: { name: 'American Indian Center', address: '3401 W. Ainslie St.', bilingual: ['es', 'hi'] },
  34: { name: 'UIC Student Center East', address: '750 S. Halsted St.', bilingual: ['es', 'hi'] },
  35: { name: 'Northeastern Illinois University El Centro', address: '3390 N. Avondale Ave.', bilingual: ['es'] },
  36: { name: 'West Belmont Library', address: '3104 N. Narragansett Ave.', bilingual: ['es', 'pl'] },
  37: { name: 'West Chicago Library', address: '4856 W. Chicago Ave.', bilingual: [] },
  38: { name: 'Hiawatha Park', address: '8029 W. Forest Preserve Dr.', bilingual: ['pl'] },
  39: { name: 'North Park Village Admin Building', address: '5801 N. Pulaski Rd.', bilingual: ['es', 'zh', 'hi', 'ko'] },
  40: { name: 'Budlong Woods Library', address: '5630 N. Lincoln Ave.', bilingual: ['hi'] },
  41: { name: 'Roden Library', address: '6083 N. Northwest Hwy.', bilingual: ['es', 'pl'] },
  42: { name: 'Historic Lawson House', address: '803 N. Dearborn St.', bilingual: ['zh', 'pl'] },
  43: { name: 'Lincoln Park Library', address: '1150 W. Fullerton Ave.', bilingual: ['es', 'pl'] },
  44: { name: 'Merlo Library', address: '644 W. Belmont Ave.', bilingual: ['es'] },
  45: { name: 'Kolping Society of Chicago', address: '5826 N. Elston Ave.', bilingual: ['es', 'pl'] },
  46: { name: 'Truman College', address: '1145 W. Wilson Ave.', bilingual: ['zh'] },
  47: { name: 'Welles Park', address: '2333 W. Sunnyside Ave.', bilingual: ['zh'] },
  48: { name: 'Broadway Armory', address: '5917 N. Broadway St.', bilingual: ['zh', 'hi'] },
  49: { name: 'Willye B. White Park', address: '1610 W. Howard St.', bilingual: ['hi'] },
  50: { name: 'Northtown Library', address: '6800 N. Western Ave.', bilingual: ['pl', 'hi'] },
};
