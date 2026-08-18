/**
 * Seeds the Firebase Emulator Suite with demo Chicago data:
 * fictional officials, demo citizens, concerns, polls, and AMA threads.
 *
 * All names are fictional - no real Chicago officials are represented.
 * Aggregate tallies are synthetic (they don't correspond to per-user vote
 * docs) so the boards look alive; real votes layer on top correctly.
 *
 * The Cloud Functions triggers run against the emulator while seeding, so
 * counters that triggers derive from real docs (commentCount, questionsAsked,
 * questionsResponded, user stats) are seeded as zero and counted by the
 * triggers - pre-setting them would double-count. Only counters whose source
 * docs aren't seeded (questionsAnswered/questionsDodged, which come from
 * judgment-driven status flips) are set manually.
 *
 * Run with the emulators up:  npm run seed
 */

process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= 'localhost:9099';

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

// Must match the projectId the app runs under (see .firebaserc) - the
// emulator namespaces data per project.
const app = initializeApp({ projectId: 'direct-democracy-e338a' });
const auth = getAuth(app);
const db = getFirestore(app);

const PASSWORD = 'password123';

interface SeedTally {
  all: Record<string, number>;
  verified: Record<string, number>;
  totalAll: number;
  totalVerified: number;
}

function tally(all: Record<string, number>, verified: Record<string, number>): SeedTally {
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  return { all, verified, totalAll: sum(all), totalVerified: sum(verified) };
}

const PRIORITY_WEIGHTS: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
const score = (counts: Record<string, number>) =>
  Object.entries(counts).reduce((acc, [k, v]) => acc + (PRIORITY_WEIGHTS[k] ?? 0) * v, 0);

async function ensureUser(email: string, displayName: string): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(email);
    if (!existing.emailVerified) {
      await auth.updateUser(existing.uid, { emailVerified: true });
    }
    return existing.uid;
  } catch {
    // emailVerified matters for the operator account: isAdmin() in
    // firestore.rules requires a verified address, and there's no inbox to
    // click a link in against the emulator.
    const created = await auth.createUser({ email, password: PASSWORD, emailVerified: true });
    void displayName;
    return created.uid;
  }
}

async function main() {
  console.log('Seeding the emulator (direct-democracy-e338a)…');

  // ── Officials (fictional) ──────────────────────────────────────────────
  const officials = [
    {
      email: 'alder.ward1@demo.local',
      name: 'Rosa Whitfield',
      title: 'Alderman, 1st Ward',
      wardId: 1,
      bio: 'Fictional demo alderman for the 1st Ward. Focused on transit, small business, and park access.',
    },
    {
      email: 'alder.ward43@demo.local',
      name: 'Marcus Delgado',
      title: 'Alderman, 43rd Ward',
      wardId: 43,
      bio: 'Fictional demo alderman for the 43rd Ward.',
    },
    {
      email: 'mayor@demo.local',
      name: 'Dorothy Kowalski',
      title: 'Mayor of Chicago',
      wardId: null,
      bio: 'Fictional demo mayor. Ask me anything - the city is listening.',
    },
  ];

  const officialUids: Record<string, string> = {};
  for (const o of officials) {
    const uid = await ensureUser(o.email, o.name);
    officialUids[o.email] = uid;
    await db.doc(`users/${uid}`).set({
      displayName: o.name,
      role: 'official',
      verified: true,
      wardId: o.wardId,
      stats: { concerns: 0, comments: 0, votes: 0, judgments: 0 },
      createdAt: FieldValue.serverTimestamp(),
    });
    await db.doc(`officials/${uid}`).set({
      uid,
      name: o.name,
      title: o.title,
      wardId: o.wardId,
      bio: o.bio,
      photoUrl: null,
      questionsAsked: 0,
      questionsResponded: 0,
      questionsAnswered: 0,
      questionsDodged: 0,
      approvalTallies: tally(
        { approve: 96, disapprove: 41 },
        { approve: 52, disapprove: 21 }
      ),
      approvalConstituents: { approve: 38, disapprove: 15 },
    });
  }
  console.log('  ✓ 3 officials');

  // ── Demo citizens ──────────────────────────────────────────────────────
  const verifiedUid = await ensureUser('verified@demo.local', 'Steadfast Heron');
  await db.doc(`users/${verifiedUid}`).set({
    displayName: 'Steadfast Heron',
    role: 'citizen',
    verified: true,
    wardId: 1,
    stats: { concerns: 0, comments: 0, votes: 0, judgments: 0 },
    createdAt: FieldValue.serverTimestamp(),
  });

  // The platform operator (admin power comes from the email in
  // firestore.rules isAdmin(), not from a role).
  const adminUid = await ensureUser('bricarlis@gmail.com', 'Vigilant Owl');
  await db.doc(`users/${adminUid}`).set({
    displayName: 'Vigilant Owl',
    role: 'citizen',
    verified: false,
    wardId: null,
    stats: { concerns: 0, comments: 0, votes: 0, judgments: 0 },
    createdAt: FieldValue.serverTimestamp(),
  });

  const unverifiedUid = await ensureUser('unverified@demo.local', 'Breezy Tugboat');
  await db.doc(`users/${unverifiedUid}`).set({
    displayName: 'Breezy Tugboat',
    role: 'citizen',
    verified: false,
    wardId: null,
    stats: { concerns: 0, comments: 0, votes: 0, judgments: 0 },
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log('  ✓ 2 demo citizens');

  // ── Candidates (fictional) ─────────────────────────────────────────────
  // A demo candidate whose platform is managed in-app (no sourceUrl). To demo
  // the site-sync flow instead, provision with:
  //   npm run add-candidate -- --emulator --email candidate@demo.local \
  //     --name "Avery Santos" --source https://www.waldgrave.com/chigui
  const candidateUid = await ensureUser('candidate@demo.local', 'Avery Santos');
  await db.doc(`users/${candidateUid}`).set({
    displayName: 'Avery Santos',
    role: 'candidate',
    verified: true,
    wardId: 12,
    stats: { concerns: 0, comments: 0, votes: 0, judgments: 0 },
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.doc(`candidates/${candidateUid}`).set({
    uid: candidateUid,
    name: 'Avery Santos',
    office: 'Candidate for Mayor',
    bio: 'Fictional demo candidate. Transit nerd, budget hawk, believes receipts beat slogans.',
    photoUrl: null,
    websiteUrl: null,
    sourceUrl: null,
    lastSyncedAt: null,
    policyCount: 0, // onPolicyWrite counts the seeded policies below
  });

  const demoPolicies = [
    {
      section: 'Getting Around',
      title: 'Buses every 6 minutes',
      body: 'Frequency is freedom. Fund operator hiring and signal priority so no one plans their life around a bus schedule. Cities that boosted off-peak frequency saw ridership recover fastest; the operating cost is a fraction of one highway interchange.',
      links: [{ label: 'transitcenter.org', url: 'https://transitcenter.org' }],
      t: tally({ support: 74, oppose: 12 }, { support: 39, oppose: 6 }),
    },
    {
      section: 'Getting Around',
      title: 'Fix the intersections that hurt people',
      body: 'The same 40 intersections produce a huge share of serious crashes. Rebuild them with raised crossings, daylighting, and hardened turns before repaving another mile of straightaway.',
      links: [],
      t: tally({ support: 51, oppose: 9 }, { support: 22, oppose: 4 }),
    },
    {
      section: 'The Money',
      title: 'Publish every contract over $10k',
      body: 'A searchable public ledger of city contracts, amendments, and change orders, posted within 30 days. Sunshine is the cheapest inspector general the city will ever hire.',
      links: [],
      t: tally({ support: 88, oppose: 3 }, { support: 45, oppose: 1 }),
    },
  ];
  const policiesRef = db.collection(`candidates/${candidateUid}/policies`);
  let order = 0;
  let firstPolicyRef: FirebaseFirestore.DocumentReference | null = null;
  for (const p of demoPolicies) {
    const ref = policiesRef.doc();
    await ref.set({
      candidateUid,
      section: p.section,
      title: p.title,
      body: p.body,
      links: p.links,
      order: order++,
      source: 'app',
      archived: false,
      tallies: p.t,
      commentCount: 0, // onPolicyCommentCreated counts the seeded comments
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    firstPolicyRef ??= ref;
  }
  // A threaded debate where the candidate replies as OP and gets pushback.
  if (firstPolicyRef) {
    const rootComment = await firstPolicyRef.collection('comments').add({
      authorUid: verifiedUid,
      authorName: 'Steadfast Heron',
      authorVerified: true,
      body: 'How do you pay for the extra operators without cutting coverage elsewhere?',
      threadId: null,
      replyToName: null,
      // The candidate credited this question for sharpening the funding plan;
      // onPolicyCommentCredited counts it on the author's stats.
      credited: true,
      creditedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });
    await firstPolicyRef.collection('comments').add({
      authorUid: candidateUid,
      authorName: 'Avery Santos',
      authorVerified: true,
      body: 'Fair question: the first tranche comes from the ad-contract renegotiation and ending two consultant retainers; the rest is in the capital-to-operating swap in the budget plank.',
      threadId: rootComment.id,
      replyToName: 'Steadfast Heron',
      createdAt: FieldValue.serverTimestamp(),
    });
    await firstPolicyRef.collection('comments').add({
      authorUid: unverifiedUid,
      authorName: 'Breezy Tugboat',
      authorVerified: false,
      body: 'The consultant retainers barely cover two routes. What happens in year two?',
      threadId: rootComment.id,
      replyToName: 'Avery Santos',
      createdAt: FieldValue.serverTimestamp(),
    });
    // A newer thread without candidate engagement, plus synthetic rating
    // scores (score = up minus down, hidden, ordering-only) so the "best"
    // sort demos: the credited question outranks this newer comment.
    await firstPolicyRef.collection('comments').add({
      authorUid: unverifiedUid,
      authorName: 'Breezy Tugboat',
      authorVerified: false,
      body: 'Six minute headways on which routes, though? All 100+?',
      threadId: null,
      replyToName: null,
      score: 4,
      scoreVerified: 2,
      createdAt: FieldValue.serverTimestamp(),
    });
    await rootComment.update({ score: 17, scoreVerified: 9 });
  }
  console.log('  ✓ 1 candidate with 3 policies');

  // ── Citywide concerns (the big board) ──────────────────────────────────
  const cityConcerns = [
    {
      title: 'Fix the winter potholes faster',
      body: 'Every spring the same craters open up on arterial streets and take months to patch. Other cold-weather cities patch within two weeks. Why can’t we?',
      t: tally(
        { critical: 82, high: 64, medium: 21, low: 6 },
        { critical: 41, high: 30, medium: 9, low: 2 }
      ),
    },
    {
      title: 'More frequent CTA service on the Blue Line',
      body: 'Off-peak waits regularly hit 20+ minutes. Reliable frequency is the difference between a city you can live in without a car and one you can’t.',
      t: tally(
        { critical: 58, high: 71, medium: 30, low: 8 },
        { critical: 27, high: 35, medium: 12, low: 3 }
      ),
    },
    {
      title: 'Keep public libraries open on Sundays',
      body: 'Sunday hours were cut years ago and never came back. Libraries are the last truly public indoor spaces in the city.',
      t: tally(
        { critical: 25, high: 48, medium: 39, low: 12 },
        { critical: 11, high: 22, medium: 17, low: 5 }
      ),
    },
    {
      title: 'Streetlight outages in the neighborhoods',
      body: '311 reports for dark blocks sit for weeks. Lighting is the cheapest public-safety investment there is.',
      t: tally(
        { critical: 44, high: 39, medium: 18, low: 5 },
        { critical: 19, high: 17, medium: 8, low: 2 }
      ),
    },
  ];

  let firstCommentPath: string | null = null;
  for (const c of cityConcerns) {
    const ref = db.collection('concerns').doc();
    await ref.set({
      title: c.title,
      body: c.body,
      scope: 'city',
      wardId: null,
      authorUid: verifiedUid,
      authorName: 'Steadfast Heron',
      authorVerified: true,
      tallies: c.t,
      score: score(c.t.all),
      scoreVerified: score(c.t.verified),
      commentCount: 0, // onCommentCreated counts the seeded comment below
      createdAt: FieldValue.serverTimestamp(),
    });
    const commentRef = await ref.collection('comments').add({
      authorUid: unverifiedUid,
      authorName: 'Breezy Tugboat',
      authorVerified: false,
      body: 'Seconding this - it affects my block every single week.',
      createdAt: FieldValue.serverTimestamp(),
    });
    firstCommentPath ??= commentRef.path;
  }
  console.log(`  ✓ ${cityConcerns.length} citywide concerns`);

  // One open report so the admin queue has something to demo.
  await db.collection('reports').add({
    reporterUid: verifiedUid,
    contentPath: firstCommentPath,
    contentType: 'comment',
    reason: 'spam',
    excerpt: 'Seconding this - it affects my block every single week.',
    authorUid: unverifiedUid,
    status: 'open',
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log('  ✓ 1 open report (demo)');

  // ── Ward 1 concerns ────────────────────────────────────────────────────
  const wardConcerns = [
    {
      title: 'Protected bike lane on Milwaukee Ave',
      body: 'The painted lane disappears exactly where traffic is worst. A curb-protected lane through the ward would connect the whole Northwest Side.',
      t: tally(
        { critical: 31, high: 24, medium: 9, low: 4 },
        { critical: 31, high: 24, medium: 9, low: 4 }
      ),
    },
    {
      title: 'Restore the Damen bus after 10pm',
      body: 'Service ends too early for restaurant and hospital workers coming home late.',
      t: tally(
        { critical: 14, high: 22, medium: 11, low: 2 },
        { critical: 14, high: 22, medium: 11, low: 2 }
      ),
    },
  ];

  for (const c of wardConcerns) {
    await db.collection('concerns').add({
      title: c.title,
      body: c.body,
      scope: 'ward',
      wardId: 1,
      authorUid: verifiedUid,
      authorName: 'Steadfast Heron',
      authorVerified: true,
      tallies: c.t,
      score: score(c.t.all),
      scoreVerified: score(c.t.verified),
      commentCount: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  console.log(`  ✓ ${wardConcerns.length} ward concerns (1st Ward)`);

  // ── Polls ──────────────────────────────────────────────────────────────
  const alder1 = officialUids['alder.ward1@demo.local'];
  await db.collection('polls').add({
    question: 'Should the ward fund a protected bike lane on Milwaukee Ave with menu money?',
    detail: 'Menu money is the $1.5M each ward gets annually for infrastructure. The lane would use roughly a third of this year’s budget.',
    type: 'yesNo',
    options: [
      { key: 'yes', label: 'Yes' },
      { key: 'no', label: 'No' },
    ],
    scope: 'ward',
    wardId: 1,
    authorUid: alder1,
    authorName: 'Rosa Whitfield',
    open: true,
    tallies: tally(
        { yes: 63, no: 29 },
        { yes: 63, no: 29 }
      ),
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.collection('polls').add({
    question: 'Which improvements should the 1st Ward prioritize this year?',
    detail: 'Pick every project you’d support. The top two go into the participatory budget.',
    type: 'approval',
    options: [
      { key: 'opt0', label: 'Repave residential side streets' },
      { key: 'opt1', label: 'New playground at Ellen Mitchell Park' },
      { key: 'opt2', label: 'Pedestrian bump-outs near schools' },
      { key: 'opt3', label: 'Public trash cans on commercial strips' },
    ],
    scope: 'ward',
    wardId: 1,
    authorUid: alder1,
    authorName: 'Rosa Whitfield',
    open: true,
    tallies: tally(
        { opt0: 48, opt1: 33, opt2: 51, opt3: 40 },
        { opt0: 48, opt1: 33, opt2: 51, opt3: 40 }
      ),
    createdAt: FieldValue.serverTimestamp(),
  });

  const mayor = officialUids['mayor@demo.local'];
  await db.collection('polls').add({
    question: 'How do you feel about extending the lakefront trail south to the city line?',
    detail: 'A proposal to close the gaps south of 71st Street with a continuous walking and biking path.',
    type: 'scale5',
    options: [
      { key: 'stronglyOppose', label: 'Strongly oppose' },
      { key: 'oppose', label: 'Oppose' },
      { key: 'neutral', label: 'Neutral' },
      { key: 'support', label: 'Support' },
      { key: 'stronglySupport', label: 'Strongly support' },
    ],
    scope: 'city',
    wardId: null,
    authorUid: mayor,
    authorName: 'Dorothy Kowalski',
    open: true,
    tallies: tally(
        { stronglyOppose: 9, oppose: 17, neutral: 33, support: 84, stronglySupport: 96 },
        { stronglyOppose: 4, oppose: 8, neutral: 15, support: 40, stronglySupport: 45 }
      ),
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log('  ✓ 3 polls');

  // ── AMA questions in every lifecycle state ─────────────────────────────
  const questions = db.collection(`officials/${alder1}/questions`);

  await questions.add({
    officialUid: alder1,
    authorUid: verifiedUid,
    authorName: 'Steadfast Heron',
    authorVerified: true,
    body: 'What happened to the promised timeline for the Western Ave repaving? It was supposed to start in April.',
    status: 'answered',
    response:
      'Fair question - the April start slipped because the water main under Western needed emergency work first (you can’t pave over a main you’re about to dig up). Repaving is now scheduled to begin the week of Aug 18, and I’ll post the contractor’s schedule here when it’s final.',
    respondedAt: FieldValue.serverTimestamp(),
    answeredYes: 11,
    answeredNo: 2,
    answeredYesVerified: 6,
    answeredNoVerified: 1,
    createdAt: FieldValue.serverTimestamp(),
  });

  await questions.add({
    officialUid: alder1,
    authorUid: unverifiedUid,
    authorName: 'Breezy Tugboat',
    authorVerified: false,
    body: 'Why did you vote for the budget amendment that cut library hours after campaigning on expanding them?',
    status: 'dodged',
    response:
      'I have always been a strong supporter of our libraries and will continue fighting for them.',
    respondedAt: FieldValue.serverTimestamp(),
    answeredYes: 3,
    answeredNo: 14,
    answeredYesVerified: 1,
    answeredNoVerified: 8,
    createdAt: FieldValue.serverTimestamp(),
  });

  await questions.add({
    officialUid: alder1,
    authorUid: verifiedUid,
    authorName: 'Steadfast Heron',
    authorVerified: true,
    body: 'Will you commit to publishing the ward’s menu-money spending as an itemized public list each quarter?',
    status: 'underReview',
    response:
      'Yes. Starting next quarter the full itemized list goes up on the ward site and I’ll link it here. Holding myself to it - check back in October.',
    respondedAt: FieldValue.serverTimestamp(),
    answeredYes: 3,
    answeredNo: 0,
    answeredYesVerified: 2,
    answeredNoVerified: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  await questions.add({
    officialUid: alder1,
    authorUid: unverifiedUid,
    authorName: 'Breezy Tugboat',
    authorVerified: false,
    body: 'What is the plan for the vacant lot at Damen and Augusta? It’s been fenced off for three years.',
    status: 'awaitingResponse',
    response: null,
    respondedAt: null,
    answeredYes: 0,
    answeredNo: 0,
    answeredYesVerified: 0,
    answeredNoVerified: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  // questionsAsked/questionsResponded are counted by the triggers as the
  // docs above land; only the judgment-derived counters need seeding.
  await db.doc(`officials/${alder1}`).update({
    questionsAnswered: 1,
    questionsDodged: 1,
  });

  // One open question for the mayor so her AMA isn't empty.
  await db.collection(`officials/${mayor}/questions`).add({
    officialUid: mayor,
    authorUid: verifiedUid,
    authorName: 'Steadfast Heron',
    authorVerified: true,
    body: 'Will the city commit to a public dashboard tracking 311 response times by ward?',
    status: 'awaitingResponse',
    response: null,
    respondedAt: null,
    answeredYes: 0,
    answeredNo: 0,
    answeredYesVerified: 0,
    answeredNoVerified: 0,
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log('  ✓ AMA threads');

  console.log('\nDone. Demo accounts (password: password123):');
  console.log('  verified@demo.local      - verified citizen, 1st Ward');
  console.log('  unverified@demo.local    - unverified citizen');
  console.log('  candidate@demo.local     - Avery Santos, candidate for mayor');
  console.log('  bricarlis@gmail.com      - platform operator (admin report queue)');
  console.log('  alder.ward1@demo.local   - Alderman, 1st Ward (official)');
  console.log('  alder.ward43@demo.local  - Alderman, 43rd Ward (official)');
  console.log('  mayor@demo.local         - Mayor (official)');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
