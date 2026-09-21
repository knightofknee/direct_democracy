# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# direct democracy - project notes

Chicago civic app: citywide "big board" of concerns, verified-only ward tab with
alderman polls, and AMAs where the community judges whether answers were real.
See README.md for the full product and setup story.

Conventions:

- App name is lowercase: "direct democracy". Tab titles are lowercase too.
- Expo SDK 57 + expo-router (screens in `src/app/`), TypeScript strict.
- Firebase JS SDK; `src/lib/firebase.ts` holds the LIVE project config - the
  Emulator Suite is used only when `EXPO_PUBLIC_USE_EMULATORS=1` is set. Run
  `npm run emulators`, `npm run seed`, then
  `EXPO_PUBLIC_USE_EMULATORS=1 npx expo start`. A bare `npx expo start` talks
  to production.
- Every vote is tallied two ways (all / verified) via the `DualTally` type.
  There is NO registered-voter concept; verification means "adult Chicago
  resident of a ward", nothing more. On ward-scoped items the verified slice
  counts only verified residents of that ward ("verified for the item's
  area"); ballots snapshot the voter's `wardId` so triggers can scope them.
- No em dashes anywhere in this project (user-facing copy, comments, docs).
  Use a comma, period, or plain hyphen instead.
- Clients write ONLY their own ballot/comment/judgment docs
  (`src/services/`); all aggregation happens in Cloud Functions Firestore
  triggers (`functions/src/index.ts` + `functions/src/tally.ts`). Never add a
  client write path to a tally, counter, score, or status - extend the
  triggers instead, and keep `firestore.rules` deny-by-default on those fields.
- Vote docs snapshot the voter's `verified`/`wardId` at cast time;
  triggers remove the old ballot under its stored slices before adding the new.
- Roles: `citizen` / `official` / `candidate` on `users/{uid}`; roles,
  `verified`, and `wardId` are written only by the Admin SDK / Cloud Functions
  (Didit webhook, `scripts/add-candidate.ts`), never by clients - security
  rules enforce this.
- The more perfect platform: `candidates/{uid}/policies/{policyId}`. Feedback
  comes through comments only - there is deliberately no support/oppose vote
  on policies (the goal is arguments, not approval ratings; the ballot
  machinery still exists in the schema/triggers but no UI reaches it).
  Synced policies (`source: 'site'`) are
  written by the platform-sync functions from the candidate's
  operator-provisioned `sourceUrl` (`functions/src/platform.ts` recognizes
  several page layouts) and are labeled "Imported from <host>" in the app,
  with a link to the original. The one client write allowed on them is the
  owning candidate's takeover: editing a synced policy flips `source` to
  `'app'`, after which the site never touches it again. In-app policies
  (`source: 'app'`) are the candidate's own. Candidates who never signed up
  are provisioned with `add-candidate --create` (passwordless account under
  the campaign's published contact email; they claim it via password reset).
- Mayoral candidate pages carry two pieces of operator copy, both held in
  `scripts/data/platform-summaries.json` and written by
  `npm run set-platform-summaries` (`--check` lists stale ones, `--dump`
  writes every live platform out for rereading): the platform note
  (`platformNote` / `platformNoteEs` / `platformNoteTone`) and the expandable
  "AI summary" (`aiSummary`: "The platform" and "Next to the other
  candidates", each a few short chunks that open with a bold "Topic: " lead,
  shown at full body text size, never as a block of small print, with the
  `policiesHash` it was written from). It is a summary for a voter on a
  phone who will not read the policies: what the candidate would do, weighted
  the way the platform weights it, with no description of the document, no
  legal caveats, and nothing nearly every candidate says. A fact shared
  across pages is worded the same on each. Every summary uses the ONE prompt in
  `scripts/data/platform-summary-prompt.md`, Brian's own page included, and
  its only source is the policies as listed in the app. Notes and summaries
  describe and never rate: counts and structure are fine; praise words,
  superlatives, and ranking ("most detailed", "real platform",
  "well-formatted") are not, because under scrutiny they read as the app
  picking favorites. Alexi Giannoulias's English note is Brian's wording
  (`"note": null` in the JSON leaves it alone) until he publishes a mayoral
  platform; the weekly task checks for that. Page order is fixed: name card
  (no initials tile; the portrait shows only when a photo is linked), note,
  AI summary (a solid orange `highlight` bar, the one tap the page most
  wants; keep that color for nothing else), the centered "more perfect platform" header, "Imported from",
  policies.
- Policy bodies cap at 20,000 characters (`MAX_BODY` in
  `functions/src/platform.ts`, `firestore.rules`, and the edit-policy field
  move together); `PolicyBody` opens anything over 5,000 collapsed behind a
  Show more button, cut at a paragraph or bullet boundary.
- Signing out is a confirmed, red action on the profile tab and lands on the
  big board with the sign-in sheet over it. Settings carries a gear icon on
  purpose: it holds the language switch, so it has to be findable by someone
  who cannot read the current language.
- Election directories: `electionCandidates/{election--slug}` +
  `electionRaceNotes/{election--race}` are read-only voter directories for the
  Nov 3, 2026 general ballot ('2026-general': statewide + Cook County races)
  and the Feb 23, 2027 municipal ballot ('2027-municipal': citywide clerk /
  treasurer + ward-N aldermanic races), seeded by `npm run seed-election` from
  `scripts/data/general-2026.json` and `municipal-2027.json` (full sync per
  election, same contract as the school board). Cards carry an optional
  `photoUrl` (external https headshot, rendered by link like officials'
  portraits, never stored) and, when the photo isn't a centered headshot, a
  `photoFrame` {x, y, zoom} (focal point as image fractions + zoom past cover,
  applied by `OfficialAvatar`); race screens show each candidate's runningOn
  preview so the comparison happens without a tap. Declared write-ins carry
  `writeIn: true` (school board cards too): listed after the printed names
  under the sourced how-to-write-in explainer (`WRITE_IN_2026`), and only in
  offices with a Chicago write-in line, since only filed write-ins count. Race ids/labels and the
  how-to-vote dates live in `src/constants/elections.ts`; sections render on
  the election tab (`november-section.tsx`, `ward-race-section.tsx`), and
  `/ward-race/[ward]` pairs the incumbent's report card with declared
  challengers. A weekly scheduled task (Mondays, "weekly-election-data-refresh")
  re-verifies all three data files against current sources and re-seeds.
- School board 2026: `schoolBoardCandidates/{slug}` is a read-only voter
  directory (public read, no client writes), seeded by
  `npm run seed-school-board` from `scripts/data/school-board-2026.json`.
  Not accounts - nominee cards with race ('president' or '1a'..'10b'),
  runningOn, priorCareer, website, and the sourceUrls each summary was
  compiled from. Races/labels live in `src/constants/school-board.ts`.
  Withdrawn/removed candidates are dropped from the JSON and the seed's
  full sync deletes them. Copy must stay neutral and sourced; candidates
  with no findable platform say so plainly.
- Officials are graded on two axes in `src/services/officials.ts`: constituent
  approval (5-ballot minimum) and the community-judged answer score, averaged
  into an overall letter. Approval ballots live at
  `officials/{uid}/approvals/{voterUid}` and aggregate in `onApprovalWrite`;
  casting one requires a VERIFIED ward resident (service + widget enforce it;
  unverified accounts see the buttons disabled with the verify path). The
  matching rules clause is deliberately OFF until the 1.0.8+ client is the
  installed base, because the 1.0.7 binary shows live buttons to everyone
  and a rules deny is a raw error there. Re-add `me().verified == true &&
  me().wardId != null` to the approvals rule when set-latest-version flips. Officials set their own `upvoteAlertThreshold` on their card; the
  upvote trigger notifies them once per question when it crosses that bar.
- Question upvotes ("I want this answered too"): one presence-only vote doc at
  `officials/{uid}/questions/{qid}/votes/{voterUid}` (and the same under
  `electionQuestions`). Triggers recount the question's upvotes/upvotesVerified
  and the official's `answerWeights` buckets; the answer score weights every
  question by 1 + its VERIFIED upvotes (same only-verified-decides rule as
  verdicts), so ignoring a question fifty people joined costs far more than
  ignoring an unbacked one. Question lists sort by upvotes, recency breaking
  ties. `recountAnswerWeights` is a full recount per event (idempotent, cheap
  at this scale); the nightly sweep backfills and self-heals it.
- Official portraits are external https links (`photoUrl`) - never store or
  proxy the image.
- Personal stats on `users/{uid}.stats` are trigger-written and drive the
  milestone celebrations in `src/components/celebration.tsx` +
  `src/lib/milestones.ts`.
- Notifications live at `users/{uid}/notifications/{id}`, written ONLY by
  Cloud Functions triggers (question asked/responded, community verdicts,
  comment replies, writing credits); clients read, mark read, and delete.
  A notification about one item links to that item, not just its page: AMA
  notifications carry `?q=<questionId>` and `/official/[id]` opens scrolled
  to that question with an outline around it. New notification types follow
  the same rule.
  The notifications tab replaced the ama tab (the officials directory moved
  to `/officials`; wards link to each alderman directly).
- Claimed profiles: `claimed` on officials/candidates is set by
  `refreshClaim`/`sweepClaims` (a provider attached to the placeholder
  account = someone proved control of the published inbox). Rules require
  `email_verified` on the auth token for every act-as-politician write.
  Unclaimed officials' unanswered questions stay pending, never "ignored" -
  the ignore clock starts at claim.
- Email sign-in links: the continue URL is
  `https://www.waldgrave.com/directdemocracy/auth` (`.env`). Firebase's
  handler forwards the link's query there and the page opens the app as
  `directdemocracy://sign-in?<query>`; `src/app/+native-intent.ts` routes
  the URL to the sign-in screen and `use-auth.tsx` redeems it. The project's
  action URL cannot be customized (console and API both refuse) and
  `linkDomain` needs Firebase Hosting, which we do not run. waldgrave.com
  also serves the app-site-association / assetlinks for that path and
  app.json carries the matching entitlement and intent filter. Never point
  links at firebaseapp.com universal links: Firebase stopped serving the
  association file there when Dynamic Links shut down.
- Small screens: words are never cut off or broken mid-word. Older phones
  have a narrow screen AND large system text, so `useScreenRoom()`
  (`src/hooks/use-screen-room.ts`) divides the width by the text scale and
  reports `tight` (under 360) and `roomy` (420 and up). When room runs out,
  decoration gives way first (row chevrons, portrait size via
  `OfficialAvatar`, padding, the grade badge dropping under the name), then
  text wraps. `numberOfLines` is only for teasers whose full text is one tap
  away (policy and runningOn previews, prior-career lines at 2, reference
  URLs); never on a label, a name, a court, or a time. Tab bar labels ignore
  the system text scale and step down a point under 360pt. Check new rows at
  320pt wide before calling them done.
- Use `notify()` from `src/lib/notify.ts` for user-facing errors - RN's
  Alert is a silent no-op on web.
- Assume success on a user's own vote/action: every displayed aggregate a
  tap changes moves optimistically at tap time via `useOptimistic`
  (src/lib/optimistic.ts) or the tally overlay in concern/[id].tsx and
  poll-card.tsx, handing back to the server numbers when the trigger lands;
  only a failed write rolls back and alerts. Never make a tap wait on the
  tally round trip.
- Seed data must never depict real Chicago officials - fictional names only.
  Production is the opposite: real aldermen are provisioned by
  `scripts/seed-aldermen.ts` from the city's Ward Offices dataset
  (data.cityofchicago.org htai-wnw4, re-runnable after council changes), as
  claimable placeholder accounts keyed to each ward's published email.
- Spanish: `src/lib/i18n.tsx` (`useT()`, `usePlural()`, `useLocale()`) with
  strings keyed by their English source text in `src/i18n/es.ts`; a missing
  key renders the English. The locale lives on the device (AsyncStorage),
  asked once in both languages on first launch (`language-prompt.tsx`) and
  changeable in Settings. The ENTIRE app UI is covered (every screen and
  component; only the operator-only admin screen and emulator-only dev
  strings are exempt), so every new user-facing string goes through `t()`
  with a matching `es.ts` entry - no exceptions. Non-hook code paths
  (formatters, notify fallbacks, milestones, wardLabel) use `tr()` /
  `getLocale()` from the same module. Candidate statements are never
  machine-translated. Operator-authored SEEDED copy is bilingual: cards
  and race notes carry `runningOnEs` / `priorCareerEs` / `noteEs`
  (operator-translated, validated by the seeds, picked at render by
  `useLocalized()` with English fallback) - every new or edited card in the
  data files gets its Spanish fields in the same change. Candidates' own
  quoted words inside a summary stay in their original language.
- Judges and district races: `judicial-retention`, `judicial-appellate`,
  `judicial-circuit`, `judicial-subcircuit-N` and the district families
  (`us-house-N`, `il-senate-N`, `il-house-N`, `cook-commissioner-N`,
  `cook-board-of-review-N`) are races in `electionCandidates`; cards carry
  optional `seat`, `court`, `ratings[]` (quoted verbatim from each rating
  body, never paraphrased), `photoUrl`. `pdc-N` (police district councils)
  belong to the 2027 municipal election. Injustice Watch is presented as the
  primary judicial tool; the app supplements it with the list and ratings.
  `raceInfo()` in constants/elections.ts resolves any race id to its
  election, label, and detail (the race screen serves both elections).
- Deadline reminders: `sendDeadlineReminders` (daily, 9am Chicago) writes a
  `deadline` notification to every user the day before and the day of each
  VOTING_MILESTONES date; the milestone list is duplicated in
  functions/src/index.ts and must be kept in sync with constants/elections.ts.
- Update nudge (same design as Brian's other apps): `config/app.latestVersion`
  drives a root-mounted "Update available" modal
  (`src/lib/app-update.ts` + `src/components/update-modal.tsx`), compared
  against the running binary's own version, never the store listing's public
  name (the two are different numbering schemes). After a release is confirmed
  live in the store, flip it with `npm run set-latest-version -- <version>`.
  The doc is world-readable, admin-write-only; a platform with no store URL
  on the doc never nudges.
- Security posture and accepted limitations are documented in `docs/AUDIT.md`;
  update it when the trust model changes.
- Typecheck with `npm run typecheck` before finishing.
