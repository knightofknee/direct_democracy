# direct democracy

An open-source civic app for Chicago: a citywide **big board** of the people's top
concerns, ward-level voting on questions from your alderman, and ongoing **AMAs**
where the community - not the politician - decides whether a question was actually
answered.

Built with React Native (Expo) for iOS and Android, backed by Firebase.

## How it works

**Three kinds of people use the app:**

| Group | What they can do |
| --- | --- |
| Unverified users | Vote and comment on all citywide concerns and citywide polls, and **browse every ward's** board and ballots |
| Verified users | Everything above, plus a home ward: their votes count in its verified tallies and they vote on their alderman's polls (the ward tab defaults to home; the city big board is everyone's default view) |
| Elected officials | Approved admins - post polls to their ward or the whole city, and answer their AMA |

**Every result is shown two ways:** all users, and identity-verified users. You
always see the general vote % and the verified-only % side by side. On
ward-scoped items, "verified" means verified residents of that ward; on
citywide items it means any verified Chicagoan. The verified lens is always
scoped to the area the vote is about.

**Voting isn't just up/down.** Concerns are voted by *priority* (critical → low),
which ranks the big board. Officials choose their poll format: yes/no, multiple
choice, approval (pick all you support), or a 5-point scale.

**AMAs are scored for honesty.** Users mark an official's response as "answered"
or "dodged" - there's no upvoting of responses. Ignored and dodged questions
drag the official's public answer score down.

**Officials get a two-axis report card.** Approval (a standing
approve/disapprove any user can flip at any time, graded on verified
constituents only, 5-ballot minimum) and the answer score above, averaged into
an overall A–F. Portraits are links to externally hosted images - the platform
never stores the photo. Participation earns celebrations: first concern, tenth
post, hundredth vote.

**Identity verification is third-party.** Didit checks the government ID and
address; direct democracy only ever stores `verified: yes/no` and the ward.
Documents never touch our servers. Display names are
random adjective + noun pairs ("Steadfast Heron") and can be changed any time -
verification never exposes your real name.

**You stay in control.** Report any content, block any user (hides their
content for you), see everything you've posted under **my activity**, withdraw
your own concerns and unanswered questions, retract any ballot while its vote
is still open, and delete
your account entirely from the profile tab. The in-app **Privacy & data**
screen spells out exactly what is and isn't stored (host a copy at a public
URL for the app-store listing).

Chicago-only for launch (50 wards, aldermen, the flag's colors), but the data
model keeps `city` as a concept so other cities can come later.

## Running it locally (against the Emulator Suite)

`src/lib/firebase.ts` holds the live project config, so local development must
explicitly opt into the [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
with `EXPO_PUBLIC_USE_EMULATORS=1` - without it, the app talks to production.

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
EXPO_PUBLIC_USE_EMULATORS=1 npx expo start
```

The seed creates demo accounts (all with password `password123`):

| Email | Who |
| --- | --- |
| `verified@demo.local` | Verified citizen, 1st Ward |
| `unverified@demo.local` | Unverified citizen |
| `alder.ward1@demo.local` | Alderman, 1st Ward (official) |
| `alder.ward43@demo.local` | Alderman, 43rd Ward (official) |
| `mayor@demo.local` | Mayor (official) |

All seeded officials are **fictional** - no real Chicago officials are depicted.

## Connecting a real Firebase project

1. Create the project at <https://console.firebase.google.com> and enable
   **Authentication → Email/Password** and **Firestore**.
2. Add a *Web* app in Project settings and paste its config into
   [`src/lib/firebase.ts`](src/lib/firebase.ts) (replacing the `demo-` placeholder -
   that placeholder is what routes the app to the emulators).
3. Point the CLI at it and deploy rules, indexes, and functions:

```bash
firebase use --add
```

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```

4. Enable the TTL policy that sweeps the triggers' exactly-once markers. The
   tally triggers claim each event id in `processedEvents/{eventId}` so a
   redelivered event can't double-count; without this policy those markers
   accumulate forever. Run it once per project:

```bash
gcloud firestore fields ttls update expiresAt --collection-group=processedEvents --enable-ttl
```

## Operating the platform

**Moderation.** Users report content in-app; reports land in a write-only
`reports` collection. The operator - identified by sign-in email in
`firestore.rules` (`isAdmin()`) and [`src/lib/admin.ts`](src/lib/admin.ts) -
gets a **Review reports** queue on their profile: view the content in context,
take it down (deletion triggers rebalance every count and report card), or
dismiss the report. Move to custom claims when there's more than one admin.

**Sign-in.** Email/password, passwordless email links, and Google/Apple SSO.
Email links complete on web out of the box (enable "Email link" on the
Email/Password provider); completing them inside the native apps additionally
needs a Firebase Hosting link domain (`EXPO_PUBLIC_AUTH_LINK_DOMAIN`) plus
iOS Associated Domains / Android App Links. Web SSO works once the
providers are enabled in Firebase console → Authentication. Native builds
additionally need: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (from the Firebase
project's OAuth clients) for Google, and an Apple Developer "Sign in with
Apple" capability for Apple (the `expo-apple-authentication` plugin and
entitlement are already configured). Every sign-in method funnels through the
same self-registration rules - SSO accounts get a random display name like
everyone else.

**App Check (before public launch).** Set `EXPO_PUBLIC_RECAPTCHA_V3_SITE_KEY`
(Firebase console → App Check → reCAPTCHA v3) to attest web clients. Native
attestation (Play Integrity / DeviceCheck) needs
`@react-native-firebase/app-check` in the dev build - wire that BEFORE
flipping enforcement on Firestore/Functions in the console, or native clients
will be locked out. With enforcement on, scripted access with the public
config dies at the door, which is the foundation for rate limiting.

## Didit (identity verification)

Production verification uses [Didit](https://didit.me) hosted sessions
(500 free verifications/month, then ~$0.33/check):

1. Create a Didit account and an ID-verification **workflow** (government ID,
   optionally selfie + proof of address).
2. Set function secrets: `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, and
   `DIDIT_WEBHOOK_SECRET` (e.g. `firebase functions:secrets:set DIDIT_API_KEY`).
3. In the Didit dashboard, point the webhook at the deployed `diditWebhook`
   function URL and copy its secret into `DIDIT_WEBHOOK_SECRET`.

The app calls `createVerificationSession` to open the hosted flow; the
webhook is the only thing in production that can set `verified: true`, and it
refuses a document that already verified a different account
(`identityClaims/{hash}`, released on account deletion). Against the
emulators, the **Verify** screen instead offers a dev-only simulated
verification (`devVerify`, which refuses to run outside the emulator).

Ward assignment from the verified address (Chicago ward-boundaries lookup) is
future work; until then production verification grants city-level verified.

## Repository layout

```
src/app/            expo-router screens: (tabs)/ big board · my ward · ama · profile,
                    plus concern/[id], official/[id], sign-in, verify, new-concern, new-poll
src/components/     shared UI (cards, lens toggle, tally bars, poll voting)
src/lib/            firebase init, domain types, tally arithmetic, name generator
src/services/       Firestore write paths (concerns, polls, AMA, users)
src/constants/      theme (Chicago flag palette) and the 50-ward dataset
functions/          Cloud Functions: Didit webhook + dev verification
scripts/seed.ts     emulator seed data
firestore.rules     security rules (see the header note about MVP tally writes)
```

## Trust model

Clients can only write documents that represent their own voice: their display
name, their ballot, their comment, their question, their judgment. Every
aggregate number - vote tallies, board scores, comment counts, AMA judgment
totals, question statuses, official answer scores - is computed exclusively by
Cloud Functions triggers (`functions/src/index.ts`) using the Admin SDK. There
is no client write path to any total, so a hostile client can cast exactly one
ballot and nothing more.

## Known MVP tradeoffs

- **Ward assignment in dev is self-attested.** Real ward assignment must come
  from the verified address via Didit.
- **Officials are provisioned manually** (seed script / Admin SDK). An admin
  approval flow is future work.

## License

Open source - see [LICENSE](LICENSE).
