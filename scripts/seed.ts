/**
 * Seeds the Firebase Emulator Suite with demo Chicago data:
 * fictional officials, demo citizens, concerns, polls, and AMA threads.
 *
 * All names are fictional — no real Chicago officials are represented.
 * Aggregate tallies are synthetic (they don't correspond to per-user vote
 * docs) so the boards look alive; real votes layer on top correctly.
 *
 * Run with the emulators up:  npm run seed
 */

process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= 'localhost:9099';

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'demo-direct-democracy' });
const auth = getAuth(app);
const db = getFirestore(app);

const PASSWORD = 'password123';

interface SeedTally {
  all: Record<string, number>;
  verified: Record<string, number>;
  registered: Record<string, number>;
  totalAll: number;
  totalVerified: number;
  totalRegistered: number;
}

function tally(
  all: Record<string, number>,
  verified: Record<string, number>,
  registered: Record<string, number>
): SeedTally {
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  return { all, verified, registered, totalAll: sum(all), totalVerified: sum(verified), totalRegistered: sum(registered) };
}

const PRIORITY_WEIGHTS: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
const score = (counts: Record<string, number>) =>
  Object.entries(counts).reduce((acc, [k, v]) => acc + (PRIORITY_WEIGHTS[k] ?? 0) * v, 0);

async function ensureUser(email: string, displayName: string): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(email);
    return existing.uid;
  } catch {
    const created = await auth.createUser({ email, password: PASSWORD });
    void displayName;
    return created.uid;
  }
}

async function main() {
  console.log('Seeding demo-direct-democracy…');

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
      bio: 'Fictional demo mayor. Ask me anything — the city is listening.',
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
      registeredVoter: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    await db.doc(`officials/${uid}`).set({
      uid,
      name: o.name,
      title: o.title,
      wardId: o.wardId,
      bio: o.bio,
      questionsAsked: 0,
      questionsResponded: 0,
      questionsAnswered: 0,
      questionsDodged: 0,
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
    registeredVoter: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  const unverifiedUid = await ensureUser('unverified@demo.local', 'Breezy Tugboat');
  await db.doc(`users/${unverifiedUid}`).set({
    displayName: 'Breezy Tugboat',
    role: 'citizen',
    verified: false,
    wardId: null,
    registeredVoter: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log('  ✓ 2 demo citizens');

  // ── Citywide concerns (the big board) ──────────────────────────────────
  const cityConcerns = [
    {
      title: 'Fix the winter potholes faster',
      body: 'Every spring the same craters open up on arterial streets and take months to patch. Other cold-weather cities patch within two weeks. Why can’t we?',
      t: tally(
        { critical: 82, high: 64, medium: 21, low: 6 },
        { critical: 41, high: 30, medium: 9, low: 2 },
        { critical: 36, high: 27, medium: 8, low: 2 }
      ),
    },
    {
      title: 'More frequent CTA service on the Blue Line',
      body: 'Off-peak waits regularly hit 20+ minutes. Reliable frequency is the difference between a city you can live in without a car and one you can’t.',
      t: tally(
        { critical: 58, high: 71, medium: 30, low: 8 },
        { critical: 27, high: 35, medium: 12, low: 3 },
        { critical: 24, high: 31, medium: 11, low: 3 }
      ),
    },
    {
      title: 'Keep public libraries open on Sundays',
      body: 'Sunday hours were cut years ago and never came back. Libraries are the last truly public indoor spaces in the city.',
      t: tally(
        { critical: 25, high: 48, medium: 39, low: 12 },
        { critical: 11, high: 22, medium: 17, low: 5 },
        { critical: 10, high: 20, medium: 15, low: 4 }
      ),
    },
    {
      title: 'Streetlight outages in the neighborhoods',
      body: '311 reports for dark blocks sit for weeks. Lighting is the cheapest public-safety investment there is.',
      t: tally(
        { critical: 44, high: 39, medium: 18, low: 5 },
        { critical: 19, high: 17, medium: 8, low: 2 },
        { critical: 17, high: 15, medium: 7, low: 2 }
      ),
    },
  ];

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
      commentCount: 1,
      createdAt: FieldValue.serverTimestamp(),
    });
    await ref.collection('comments').add({
      authorUid: unverifiedUid,
      authorName: 'Breezy Tugboat',
      authorVerified: false,
      body: 'Seconding this — it affects my block every single week.',
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  console.log(`  ✓ ${cityConcerns.length} citywide concerns`);

  // ── Ward 1 concerns ────────────────────────────────────────────────────
  const wardConcerns = [
    {
      title: 'Protected bike lane on Milwaukee Ave',
      body: 'The painted lane disappears exactly where traffic is worst. A curb-protected lane through the ward would connect the whole Northwest Side.',
      t: tally(
        { critical: 31, high: 24, medium: 9, low: 4 },
        { critical: 31, high: 24, medium: 9, low: 4 },
        { critical: 27, high: 21, medium: 8, low: 3 }
      ),
    },
    {
      title: 'Restore the Damen bus after 10pm',
      body: 'Service ends too early for restaurant and hospital workers coming home late.',
      t: tally(
        { critical: 14, high: 22, medium: 11, low: 2 },
        { critical: 14, high: 22, medium: 11, low: 2 },
        { critical: 12, high: 19, medium: 10, low: 2 }
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
      { yes: 63, no: 29 },
      { yes: 55, no: 26 }
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
      { opt0: 48, opt1: 33, opt2: 51, opt3: 40 },
      { opt0: 43, opt1: 29, opt2: 46, opt3: 35 }
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
      { stronglyOppose: 4, oppose: 8, neutral: 15, support: 40, stronglySupport: 45 },
      { stronglyOppose: 4, oppose: 7, neutral: 13, support: 36, stronglySupport: 41 }
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
      'Fair question — the April start slipped because the water main under Western needed emergency work first (you can’t pave over a main you’re about to dig up). Repaving is now scheduled to begin the week of Aug 18, and I’ll post the contractor’s schedule here when it’s final.',
    respondedAt: FieldValue.serverTimestamp(),
    answeredYes: 11,
    answeredNo: 2,
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
      'Yes. Starting next quarter the full itemized list goes up on the ward site and I’ll link it here. Holding myself to it — check back in October.',
    respondedAt: FieldValue.serverTimestamp(),
    answeredYes: 3,
    answeredNo: 0,
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
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.doc(`officials/${alder1}`).update({
    questionsAsked: 4,
    questionsResponded: 3,
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
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.doc(`officials/${mayor}`).update({ questionsAsked: 1 });
  console.log('  ✓ AMA threads');

  console.log('\nDone. Demo accounts (password: password123):');
  console.log('  verified@demo.local      — verified citizen, 1st Ward, registered voter');
  console.log('  unverified@demo.local    — unverified citizen');
  console.log('  alder.ward1@demo.local   — Alderman, 1st Ward (official)');
  console.log('  alder.ward43@demo.local  — Alderman, 43rd Ward (official)');
  console.log('  mayor@demo.local         — Mayor (official)');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
