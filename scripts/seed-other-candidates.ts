/**
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
    'These candidates have declared for mayor but published no platform anywhere on their campaign sites, so there is nothing to import and nothing to debate yet. Each entry is what is publicly known, with links. Anyone here who publishes a real platform gets a full candidate page like the rest. Brandon Johnson has not announced a campaign; Maria Pappas has not formally entered.',
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
      "Her site's platform section is a single sentence about safe streets, schools that teach, and a revitalized business climate, with no policies behind it.",
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
    slug: 'mark-su',
    title: 'Mark Su',
    body: [
      'Software engineer and CPS parent activist, simultaneously a 2026 candidate for Congress in the 9th district while collecting mayoral petitions.',
      'His only site is his repurposed congressional campaign site, with a banner announcing the mayoral run; its issues section mixes national congressional content with Chicago items and contains no mayoral platform.',
    ].join('\n\n'),
    links: [{ label: 'site.marksuforcongress.com', url: 'https://site.marksuforcongress.com/' }],
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
