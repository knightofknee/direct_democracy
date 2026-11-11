/**
 * RETIRED 2026-11-04 (kept for reference, not run): the mayor games tab
 * (scripts/data/mayor-games.json, seed-mayor-games) now carries every
 * filed candidate, so nothing lists this directory card any more. The
 * candidates/other-declared-candidates doc still exists in production and
 * is harmless; re-running this script would only refresh it.
 *
 * Seeds the "All other declared candidates" directory entry on the election
 * tab: a candidate-shaped card whose "policies" are profiles of the declared
 * 2027 mayoral candidates who have published no platform to import. Same
 * reading experience as a platform (title, full text on tap, links), but no
 * comments - the debate belongs on real platforms. Re-runnable: profiles are
 * upserted by slug, entries removed from the list below are deleted.
 *
 *   gcloud auth application-default login
 *   npm run seed-other-candidates
 *
 * When one of these campaigns publishes a real platform, remove them here,
 * re-run, and provision them with add-candidate + a sourceUrl instead.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ credential: applicationDefault(), projectId: 'direct-democracy-e338a' });
const db = getFirestore(app);

const DOC_ID = 'other-declared-candidates';

const CARD = {
  uid: DOC_ID,
  name: 'All other declared candidates',
  office: '2027 mayoral race',
  bio: '',
  directory: true,
  photoUrl: null,
  websiteUrl: null,
  sourceUrl: null,
  platformNote:
    'These candidates have declared for mayor but published no platform the app can import, so there is nothing to debate here yet. Each entry is what is publicly known, with links. Anyone here who publishes a real platform gets a full candidate page like the rest.',
  platformNoteTone: 'warning',
};

interface Entry {
  slug: string;
  title: string;
  body: string;
  links: { label: string; url: string }[];
}

const ENTRIES: Entry[] = [
  {
    slug: 'danielle-carter-walters',
    title: 'Danielle Carter-Walters',
    body: [
      'Small business owner, wife of a retired Chicago police officer, and co-founder of Chicago Flips Red, running as a law-and-order outsider.',
      'Her site lists 19 issue areas, from public safety and a "Chicago DOGE" audit to immigration and sanctuary city policy, each a heading with a one-line slogan and no policy text behind it.',
    ].join('\n\n'),
    links: [{ label: 'dannicformayor.com', url: 'https://www.dannicformayor.com/' }],
  },
  {
    slug: 'zoe-ma',
    title: 'Zoe Ma',
    body: [
      "Real estate developer from Bronzeville and an immigrant from China; she would be the city's first Chinese American and first Muslim mayor. Entered the race in late August 2026, running as an independent.",
      'Her site mentions platform pieces like a Digital Main Street Initiative but publishes no platform page; policy content exists only as passing sections of the homepage.',
    ].join('\n\n'),
    links: [{ label: 'zoemaformayor.com', url: 'https://zoemaformayor.com/' }],
  },
  {
    slug: 'lisa-nee',
    title: 'Lisa Nee',
    body: [
      'Cardiologist and former ICU nurse from Humboldt Park, known for blowing the whistle on unnecessary cardiac procedures at a VA hospital. Announced July 7, 2026.',
      'Her three campaign themes, affordability, safety, and fiscal responsibility, appear only as homepage messaging; the site has no platform page, and its issues and platform links redirect back to the homepage.',
    ].join('\n\n'),
    links: [{ label: 'lisaneeforchicago.com', url: 'https://www.lisaneeforchicago.com/' }],
  },
  {
    slug: 'brandon-johnson',
    title: 'Brandon Johnson',
    body: [
      'Mayor since May 2023, seeking a second term. Filed nominating petitions on Oct. 23, 2026. When filing, he said a second term would keep investing in young people and public schools, driving violence down, expanding mental and behavioral health care, and building more affordable homes.',
      'His campaign site names four themes, safe neighborhoods, strong schools, an affordable Chicago, and thriving communities, and each links to a page of first-term actions; the site has no platform page.',
    ].join('\n\n'),
    links: [
      { label: 'brandonforchicago.com', url: 'https://www.brandonforchicago.com/' },
      { label: 'First-term record', url: 'https://www.brandonforchicago.com/record' },
      {
        label: 'WTTW: Johnson files for reelection',
        url: 'https://news.wttw.com/2026/10/23/johnson-makes-bid-chicago-mayor-official-filing-thousands-signatures',
      },
    ],
  },
  {
    slug: 'maria-pappas',
    title: 'Maria Pappas',
    body: [
      'Cook County Treasurer since 1998 and a Cook County Board commissioner from 1990 to 1998. Filed nominating petitions on Oct. 26, 2026, and told Block Club she will formally announce after the Nov. 3 election.',
      'She has no campaign website. The one policy subject in her early remarks about running was property taxes, citing her office\'s finding that residential bills are rising fastest on the South and West Sides.',
    ].join('\n\n'),
    links: [
      {
        label: 'Sun-Times: Pappas files on the last day',
        url: 'https://chicago.suntimes.com/elections/2026/10/26/chicago-mayoral-race-last-day-of-filing-mendoza-pappas-2027-election',
      },
      { label: 'Block Club: who is running', url: 'https://blockclubchicago.org/2026/10/26/who-is-running-for-chicago-mayor/' },
    ],
  },
  {
    slug: 'john-kitover',
    title: 'John Kitover',
    body: [
      'Businessman and U.S. Army veteran who calls himself a Republican-Libertarian. Filed nominating petitions on Oct. 26, 2026.',
      'His site lists six issues: ending the pension crisis, cutting property taxes, public safety, lower utility taxes, fiscal accountability, and individual liberty, with plans that include a constitutional pension amendment, a property tax levy freeze, and zero-based budgeting. The site is built in a way the app cannot import, so read it there.',
    ].join('\n\n'),
    links: [
      { label: 'johnkitover45.com', url: 'https://johnkitover45.com/' },
      { label: 'mayorkitover.com', url: 'https://mayorkitover.com/' },
    ],
  },
  {
    slug: 'jesse-maronto',
    title: 'Jessica "Jesse" Maronto',
    body: [
      'CDOT traffic signal repairman (IBEW Local 9) with an accounting degree and an MBA. Filed nominating petitions on Oct. 26, 2026, and said that day her signatures fell short of the 12,500 needed; she is on the Board of Elections list as of Oct. 30.',
      'Her site says the campaign is no longer actively campaigning and invites voters to write her name in. Her "CONE" platform (Chicagoans, Operations, Neighborhoods, Economy) is described in news coverage but not published on her site.',
    ].join('\n\n'),
    links: [
      { label: 'marontoforchicago.com', url: 'https://marontoforchicago.com/' },
      {
        label: 'Southwest News-Herald: the CONE platform',
        url: 'https://southwestregionalpublishing.com/2026/10/05/traffic-signal-repairman-mba-holder-jesse-maronto-builds-chicago-mayoral-bid-around-cone-platform/',
      },
    ],
  },
];

async function main() {
  const cardRef = db.doc(`candidates/${DOC_ID}`);
  const existingCard = await cardRef.get();
  await cardRef.set(
    {
      ...CARD,
      ...(existingCard.exists ? {} : { lastSyncedAt: null, policyCount: 0 }),
    },
    { merge: true }
  );

  const policiesRef = cardRef.collection('policies');
  const existing = await policiesRef.get();
  const keep = new Set(ENTRIES.map((e) => e.slug));

  for (const [order, entry] of ENTRIES.entries()) {
    const ref = policiesRef.doc(entry.slug);
    const current = await ref.get();
    const fields = {
      section: '',
      title: entry.title,
      body: entry.body,
      links: entry.links,
      order,
      archived: false,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (current.exists) {
      await ref.update(fields);
    } else {
      await ref.set({
        ...fields,
        candidateUid: DOC_ID,
        source: 'app',
        tallies: { all: {}, verified: {}, totalAll: 0, totalVerified: 0 },
        commentCount: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }

  for (const doc of existing.docs) {
    if (!keep.has(doc.id)) {
      await doc.ref.delete();
      console.log(`  Removed ${doc.id} (no longer listed).`);
    }
  }

  console.log(`✓ candidates/${DOC_ID}: ${ENTRIES.length} declared-candidate entries.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
