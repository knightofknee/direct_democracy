# direct democracy

A civic app for Chicago: a citywide **big board** of the issues people care
about most, a ward tab with polls from your alderman, public **AMAs** where the
community (not the politician) decides whether a question was actually
answered, report cards for all 50 aldermen, and a voter guide for the
November 2026 and February 2027 ballots. The whole app is available in
English and Spanish.

Built with React Native (Expo) for iOS and Android, backed by Firebase. The
code is MIT licensed (see [LICENSE](LICENSE)).

## How it works

**Four kinds of people use the app:**

| Group | What they can do |
| --- | --- |
| Unverified users | Post citywide concerns, vote on any concern and on citywide polls, ask officials and candidates questions, judge answers, comment on policies, and browse every ward |
| Verified users | Everything above, plus their votes count in the verified tallies. A verified resident of a ward also posts ward concerns, votes on that ward's polls, and rates their alderman |
| Elected officials | Real officeholders on claimable accounts: post polls to their ward or the whole city, and answer their AMA |
| Candidates | Operator-provisioned: publish **the more perfect platform** (below), answer the election AMA, and poll their audience. No report card until they hold office |

**Every result is shown two ways:** all users, and identity-verified users,
side by side. On ward-scoped items "verified" means verified residents of that
ward; on citywide items it means any verified Chicagoan.

**Voting isn't just up/down.** Concerns are voted by *priority* (critical to
low), which ranks the big board. Officials choose their poll format: yes/no,
multiple choice, approval (pick all you support), or a 5-point scale.

**AMAs are scored for honesty.** Anyone signed in can ask an official a
question, or join one someone else asked ("I want this answered too"). Once
the official responds, anyone can mark the response "answered" or "dodged".
Both counts are shown, and the question's status (and the official's grade)
follows the verified votes, so a pile of throwaway accounts can't brand an
official a dodger. Unanswered questions get a week of grace, then count as
ignored; questions to an official who hasn't claimed their account stay
pending.

**Officials get a two-axis report card.** Approval (a standing
approve/disapprove from verified residents of the official's ward, 5-ballot
minimum) and the answer score, which weights each question by 1 + its verified
backers so ignoring a question fifty people joined costs far more than
ignoring one nobody backed. The two average into an overall A to F. Aldermen
are provisioned from the city's Ward Offices dataset as placeholder accounts
under each ward's published email; an alderman claims theirs by proving
control of that inbox. Portraits are links to externally hosted images; the
app never stores the photo.

**The more perfect platform.** The election tab lists every candidate for
mayor. Each platform is a list of individual policies (a title, the full
text, and a list of cited sources), with a comments section where the
candidate's own replies carry a candidate badge. There is deliberately no
support/oppose vote on policies: the goal is arguments, not approval ratings.
A candidate can write policies in the app, or link their campaign site: a
nightly Cloud Function (plus a "Sync from my site" button) reads the site and
imports each policy, labeled with where it came from. Editing an imported
policy in the app takes it over from the site. Each mayoral candidate's page
also carries a short operator-written note and an expandable AI summary; every
summary is written from the same prompt
([`scripts/data/platform-summary-prompt.md`](scripts/data/platform-summary-prompt.md))
using only the policies as listed in the app, and describes rather than rates.

**The election AMA.** Ask every mayoral candidate the same question at once;
each candidate posts one answer, and the community rates which answers
actually answer it.

**The rest of the ballot.** Read-only, sourced candidate directories for the
Nov 3, 2026 general election (statewide, Cook County, district races, and
judges with bar association ratings quoted verbatim) and the Feb 23, 2027
municipal election (citywide offices, every ward's aldermanic race, police
district councils), plus the 2026 school board races, declared write-ins, and
how, when, and where to vote. Seeded from `scripts/data/*.json` and
re-verified weekly.

**Identity verification is third-party.** Didit checks the government ID;
direct democracy stores only a verified yes/no, the ward you live in, and a
one-way hash that stops one person from verifying two accounts. Documents never touch our
servers. Display names are random adjective + noun pairs ("Steadfast Heron")
and can be changed any time; verification never exposes your real name.

**You stay in control.** Report any content, block any user (hides their
content for you), see everything you've posted under **my activity**, withdraw
your own concerns and unanswered questions, retract any ballot while its vote
is still open, and delete your account entirely from the profile tab. The
in-app **Privacy & data** screen spells out exactly what is and isn't stored.

Chicago-only (50 wards, aldermen, the flag's colors), but the data model keeps
`city` as a concept so other cities can come later.

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
Email/Password provider). In the native apps, the link's continue URL
(`EXPO_PUBLIC_AUTH_CONTINUE_URL`) is a page on waldgrave.com that reopens the
app as `directdemocracy://sign-in?...`; waldgrave.com also serves the
app-site-association and assetlinks files that match the entitlement and
intent filter in `app.json`. Don't point links at firebaseapp.com universal
links: Firebase stopped serving the association file there. Web SSO works once the
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
webhook is the only thing in production that can set `verified` and the
ward (matched from the verified address against the city's ward boundaries),
and it refuses a document that already verified a different account
(`identityClaims/{hash}`, released on account deletion). Against the
emulators, the **Verify** screen instead offers a dev-only simulated
verification (`devVerify`, which refuses to run outside the emulator).

## Repository layout

```
src/app/            expo-router screens: (tabs)/ big board · wards · election ·
                    notifications · profile, plus concern, official, candidate,
                    election and school board screens, sign-in, verify, settings
src/components/     shared UI (cards, lens toggle, tally bars, poll voting, ward map)
src/lib/            firebase init, domain types, tally math, i18n, optimistic UI
src/i18n/es.ts      Spanish strings, keyed by their English source text
src/services/       Firestore write paths (a client writes only its own docs)
src/constants/      theme (Chicago flag palette), wards, elections, school board
functions/src/      Cloud Functions: tally triggers, Didit webhook, platform sync,
                    claims, deadline reminders
scripts/            seed scripts (emulator demo data, aldermen, election and
                    school board directories) and operator tools
scripts/data/       election data files and the AI summary prompt
firestore.rules     security rules (deny by default on every aggregate)
docs/AUDIT.md       security posture and accepted limitations
```

## Trust model

Clients can only write documents that represent their own voice: their display
name, their ballot, their comment, their question, their judgment. Every
aggregate number - vote tallies, board scores, comment counts, AMA judgment
totals, question statuses, official answer scores - is computed exclusively by
Cloud Functions triggers (`functions/src/index.ts`) using the Admin SDK. There
is no client write path to any total, so a hostile client can cast exactly one
ballot and nothing more.

## License

MIT, see [LICENSE](LICENSE).
