# direct democracy

An open-source civic app for Chicago: a citywide **big board** of the people's top
concerns, ward-level voting on questions from your alderman, and ongoing **AMAs**
where the community — not the politician — decides whether a question was actually
answered.

Built with React Native (Expo) for iOS and Android, backed by Firebase.

## How it works

**Three kinds of people use the app:**

| Group | What they can do |
| --- | --- |
| Unverified users | Vote and comment on all citywide concerns and citywide polls |
| Verified users | Everything above, plus the **my ward** tab: the ward leaderboard and votes on their alderman's polls |
| Elected officials | Approved admins — post polls to their ward or the whole city, and answer their AMA |

**Every result is shown through three lenses:** all users, identity-verified users,
and registered voters. You always see the general vote % and the verified-only %
side by side.

**Voting isn't just up/down.** Concerns are voted by *priority* (critical → low),
which ranks the big board. Officials choose their poll format: yes/no, multiple
choice, approval (pick all you support), or a 5-point scale.

**AMAs are scored for honesty.** Users mark an official's response as "answered"
or "dodged" — there's no upvoting of responses. Ignored and dodged questions
drag the official's public answer score down.

**Identity verification is third-party.** Persona checks the government ID and
address; direct democracy only ever stores `verified: yes/no`, the ward, and
registered-voter status. Documents never touch our servers. Display names are
random adjective + noun pairs ("Steadfast Heron") and can be changed any time —
verification never exposes your real name.

Chicago-only for launch (50 wards, aldermen, the flag's colors), but the data
model keeps `city` as a concept so other cities can come later.

## Running it locally (no Firebase project needed)

The app ships pointed at the [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite),
so you can run everything today with fake data.

Prereqs: Node 20+, Java 17+ (for the Firestore emulator), and the Firebase CLI
(`npm i -g firebase-tools`).

```bash
npm install
cd functions && npm install && npm run build && cd ..
```

Then in three terminals:

```bash
npm run emulators
```

```bash
npm run seed
```

```bash
npx expo start
```

The seed creates demo accounts (all with password `password123`):

| Email | Who |
| --- | --- |
| `verified@demo.local` | Verified citizen, 1st Ward, registered voter |
| `unverified@demo.local` | Unverified citizen |
| `alder.ward1@demo.local` | Alderman, 1st Ward (official) |
| `mayor@demo.local` | Mayor (official) |

All seeded officials are **fictional** — no real Chicago officials are depicted.

## Connecting a real Firebase project

1. Create the project at <https://console.firebase.google.com> and enable
   **Authentication → Email/Password** and **Firestore**.
2. Add a *Web* app in Project settings and paste its config into
   [`src/lib/firebase.ts`](src/lib/firebase.ts) (replacing the `demo-` placeholder —
   that placeholder is what routes the app to the emulators).
3. Point the CLI at it and deploy rules, indexes, and functions:

```bash
firebase use --add
```

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```

## Persona (identity verification)

Production verification uses [Persona](https://withpersona.com) hosted inquiries:

1. Create an inquiry template that collects a government ID + address, with two
   custom output fields: `ward_id` (1–50) and `registered_voter` (boolean).
2. Set function secrets: `PERSONA_TEMPLATE_ID`, `PERSONA_ENVIRONMENT_ID`, and
   `PERSONA_WEBHOOK_SECRET` (e.g. `firebase functions:secrets:set PERSONA_TEMPLATE_ID`).
3. In Persona, point an `inquiry.completed` webhook at the deployed
   `personaWebhook` function URL.

The app calls `createVerificationSession` to open the hosted flow; the webhook is
the only thing in production that can set `verified: true`. Against the emulators,
the **Verify** screen instead offers a dev-only simulated verification
(`devVerify`, which refuses to run outside the emulator).

The address → ward mapping inside Persona is a TODO: wire a lookup against the
[Chicago ward boundaries dataset](https://data.cityofchicago.org) as an inquiry
step, or leave `ward_id` unset to grant city-level verification without a ward.

## Repository layout

```
src/app/            expo-router screens: (tabs)/ big board · my ward · ama · profile,
                    plus concern/[id], official/[id], sign-in, verify, new-concern, new-poll
src/components/     shared UI (cards, lens toggle, tally bars, poll voting)
src/lib/            firebase init, domain types, tally arithmetic, name generator
src/services/       Firestore write paths (concerns, polls, AMA, users)
src/constants/      theme (Chicago flag palette) and the 50-ward dataset
functions/          Cloud Functions: Persona webhook + dev verification
scripts/seed.ts     emulator seed data
firestore.rules     security rules (see the header note about MVP tally writes)
```

## Known MVP tradeoffs

- **Client-side tallies.** Vote totals are aggregated in client transactions and
  the rules allow signed-in users to update tally fields. Fine for a demo;
  before real-world launch move aggregation into Cloud Functions triggers and
  revoke those grants (called out in `firestore.rules`).
- **Ward assignment in dev is self-attested.** Real ward assignment must come
  from the verified address via Persona.
- **Officials are provisioned manually** (seed script / Admin SDK). An admin
  approval flow is future work.

## License

Open source — see [LICENSE](LICENSE).
