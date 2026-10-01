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
  resident of a ward", nothing more. Age matters only for verification
  (both Didit workflows decline under 18); anyone can use the app and count
  in the all-users tally. On ward-scoped items the verified slice
  counts only verified residents of that ward ("verified for the item's
  area"); ballots snapshot the voter's `wardId` so triggers can scope them.
  The Didit webhook never grants `verified` without a ward: it geocodes the
  verified address and matches it to the city's ward boundaries
  (`functions/src/ward.ts`, boundaries from `npm run build-ward-map`); an
  address outside Chicago or an unreadable one verifies nothing and sends
  the person a notification explaining how to retry. Nothing stays at
  Didit: once a final result is handled the webhook erases the session there
  (`privacy_erasure`, face data included), and the nightly
  `eraseDiditSessions` retries failures and erases sessions undecided after
  7 days; the public privacy policy promises this. The one-account-per-ID
  code is an HMAC of issuing state + document number keyed by the
  `IDENTITY_HASH_KEY` secret (no birth date). Moving: a verified
  citizen can verify a new address from Settings once per 90 days
  (`users/{uid}.reverifyAt`, stamped server-side at session start, handed
  back if the link expires unopened; the button is disabled until it opens).
  A new ward replaces the old and withdraws their approval of the old ward's
  alderman; no ward found leaves them as they were. `DIDIT_ADDRESS_WORKFLOW_ID`
  in functions/.env is the "Move: ID + proof of address, 18+" workflow, run
  when the person picks "Verify with a bill or statement" in Settings;
  "Verify with my ID" runs the main workflow.
- Declared home ward (2026-09-24, reworked 2026-09-27): an unverified
  account may set its ward without an ID through the `declareWard` callable
  (sets `wardId` + `wardDeclaredAt`, resets `homeWardPosts`; refused for
  verified accounts and officials). It can be changed freely until its owner
  posts there: the 2nd home-ward post locks it for a week, the 3rd for 3
  months (`users/{uid}.wardLockedUntil`, trigger-written, never extended by
  later posts), and at most 5 changes a day. A switch moves the person's
  posting limits and ward screens and NOTHING else: votes already cast are
  never undone by a declared ward change (2026-09-28, Brian's call).
  A home ward, verified or declared, is what opens ward polls and rating
  the alderman (rules check `me().wardId`, not `verified`). Every ballot
  still snapshots `verified`, so declared residents count only in the
  all-users tallies and never in a grade. Wherever the app asks for
  verification, an account with no ward sees both doors side by side
  (`HomeWardChoice`); a declared account sees `DeclaredWardNote` (verify,
  plus change or the lock date). `/set-ward` is how-it-works, then picker.
- Ward posting limits (2026-09-27): a post is a ward concern or a question
  to a ward's alderman, and anyone signed in may post in ANY ward: up to 3
  in a rolling day in their home ward, once a week in any other ward (per
  ward), and at most 5 wards besides home in any rolling week (2026-09-27:
  whoever starts a discussion should have the bandwidth to answer it; ten
  weeks of effort still reaches every ward). The 5-ward count uses
  `users/{uid}.recentPostWards` (last post per ward, trigger-written) and
  counts wards that were home when posted in once they no longer are, so
  hopping home wards cannot dodge it. The triggers are the gate (`gateWardPost` in functions/src/index.ts,
  numbers in functions/src/posting.ts): each post is checked against a
  server-written ledger of recent post times (`users/{uid}/wardPosts/{ward}`,
  owner-readable, no client writes) and deleted over the limit with a
  bilingual `postLimit` notification; withdrawing a post never frees its
  slot. The app reads the same ledger (`useWardPostWindow` in
  src/lib/ward-posting.ts, keep its numbers in sync) to say when the next
  post opens and disable the button, so honest users never hit a refusal.
  Everything else a person can post has a rate limit too (2026-09-28,
  `RATE_LIMITS` in functions/src/posting.ts, `gateRate` in index.ts,
  ledger `users/{uid}/rateLimits/{bucket}`, owner-readable): citywide
  concerns 2 a day; questions to citywide officials and election questions
  3 a day each; comments 20 an hour and 100 a day; reports 10 a day; declared
  ward changes 5 a day (`declareWard` refuses). Same contract: the trigger
  deletes a post over the limit and sends one notice per bucket per hour;
  forms with a daily limit show it first (`useRateWindow`,
  src/lib/rate-limits.ts, keep in sync). A new kind of user post gets a
  bucket in the same change.
- Command center (2026-09-27, candidates reworked 2026-09-28): the
  `command` tab, shown only to officials and candidates (`href: null` for
  everyone else), is where they work. Officials: AMA questions waiting on
  them with the answer box under each (most joined first; each shows its
  verified residents apart and a "Verified resident" chip on the asker),
  new ward / citywide polls, their polls (open with Close voting, then
  closed; `PollCard manage`), their ward's issues (`IssueRow`, by verified
  score, folded once they've commented), then card editing and ClaimGate.
  Candidates are regular users plus this tab: "ask every candidate"
  questions first (unanswered with the answer box, answered ones folded
  below), then comments on their policies (newest first, from the
  trigger-written `lastComment` / `lastCommentAt` on each policy), then
  their card, then platform editing (add, sync, every policy incl. hidden;
  Hide / Delete live on the edit screen). No polls or issues list for
  candidates. The public
  official, candidate, policy, and ward pages read EXACTLY the same for the
  politician as for anyone: no owner controls there, ever. Their own AMA
  notifications open `/command?q=` (rewritten client-side in the
  notifications tab). Six tabs step labels down further (see the tab
  layout); check 320pt after touching tab titles.
- Poll results (2026-09-27): the poll's author always sees live results
  and gets no vote buttons on their own poll. Anyone who can still vote sees
  the turnout ("N votes so far") and gets the breakdown once they vote; the
  results are the reward for taking part. Everyone who cannot vote there
  sees results. `TallyResults` shows each option's count beside its
  percentage, all users and verified.
- Editing posts (2026-09-28): authors edit concerns and comments any time,
  and questions to officials / election questions until answered, ONLY
  through the `editPost` callable (the concern update rule is gone). Each
  edit appends to the post's `edits` history: always the time, plus the
  text as it was before if anyone had replied to or backed it by then (a
  concern with comments or votes; a comment with a later reply in its
  thread or a writing credit; a question someone joined). `EditHistory`
  shows it behind "Edited · See edit history". Rate limited (`edits`).
- Deleting an account deletes every ballot it cast (all `votes` docs by
  `uid`, approvals, judgments), so a freed identity can never vote twice;
  its posts keep their text under "[deleted]" (AMA and election questions
  included). Display names may not start with "Ald." / "Alderman" (rules +
  `validateDisplayName`). Celebrations fire only from a tap on this device
  (`anticipate`); server stats only mark milestones as reached.
- Errors in Spanish: show errors through `notifyError` / `errorMessage`
  (src/lib/notify.ts). Our own messages (service throws, server
  HttpsError text) are es.ts keys like any string; anything else in
  Spanish mode shows a Spanish line for its error code with the English
  detail under it. New error text gets its es.ts entry in the same change.
- Phone notifications (2026-09-29): expo-notifications; the ONLY place that
  asks is Settings > Phone notifications, one switch per kind
  (`PUSH_SWITCHES` in src/lib/push.ts, mirrored by `PUSH_PREF_FOR_TYPE` in
  functions): election reminders, a politician answered your question,
  comments on your posts, replies to your comments (type `reply`, split
  from `comment`), writing credits, and for officials new questions. The
  first switch turned on triggers the phone's permission prompt and stores
  this phone's Expo token with its language on `users/{uid}.pushTokens`
  (owner-writable, like `pushPrefs`); `sendPush` in functions sends through
  Expo's push API on the first delivery of each notification, in the
  phone's language (es or en), and drops tokens Expo reports gone. A phone
  belongs to one account at a time: `onPushTokensChanged` removes a token
  from any other account when it appears on a new one (owners kept by token
  hash in `pushTokenOwners`), and sign-out never waits more than 3 seconds
  on removing its token. A reply to a reply notifies the person answered
  (`replyToUid`, checked against the thread's authors) as well as the
  thread's starter. Verdicts,
  verification results, and posting-limit notices never reach the phone
  (Brian's call). Sign-out forgets this phone's token. Taps route through
  `notificationLink` (src/lib/notification-links.ts), shared with the tab.
- AMA threads (2026-09-29): every answered official question has a
  conversation under it (`officials/{o}/questions/{q}/comments`, same
  threaded shape and CommentsSection as the boards, official marked with
  the `official` chip), open to anyone once there's a response; the official
  needs a confirmed email to post. Triggers keep the count, rate limit, and
  notify the asker, the official, and replied-to commenters with links
  carrying `thread=1` (opens the conversation; not rewritten to /command).
- Home tab (2026-09-29): the first tab is `home` (house icon): the big board
  (10 at a time, "Show more" adds 20), citywide polls, then City Council
  (`CouncilSection`): the next two weeks of meetings with public comment
  deadlines and agendas, and recent Council split votes. Each alderman's
  page ends with `VotingRecord`: Council votes that split (losing side of 5+)
  and every vote they cast on the losing side, as the Clerk records them,
  no score and no good/bad coloring. Data: `syncCouncil` (twice daily,
  functions/src/council.ts) from the City Clerk's public eLMS API into
  `council/upcoming`, `rollCalls/{historyId}` (roll calls with at least one
  No), and `officials.elmsPersonId`; admin-written, world-readable. The API
  double-encodes JSON when sent `accept: application/json`, so council.ts
  sends no accept header and parses a string body twice.
- Ward concerns end with a quiet "Report it to 311" link (311.chicago.gov);
  the how-to-vote card folds "More help voting" (accessible voting,
  language help, permanent vote by mail, pre-registration at 16, election
  judges; each line verified on chicagoelections.gov, `VOTING_HELP_2026`).
- Sharing and the web version (2026-09-29): `ShareButton` in the header of
  concern, official, candidate, policy, election question, and race pages
  shares https://www.waldgrave.com/directdemocracy/app/<path> (the web
  build of this same app); `+native-intent.ts` strips that prefix so the
  link opens the installed app. Live since 2026-09-29.
  `npm run publish-web` builds it (app.config.js with `WEB_EXPORT=1`: the
  /directdemocracy/app base path and a single-page export, since
  pre-rendered pages could never match a signed-in first render) and copies
  it into the waldgrave repo's public/directdemocracy/app; deploying is a
  commit of that folder there and a push to its `heroku` remote. Waldgrave's
  next.config.js sends every non-file path under /directdemocracy/app to
  the app's index.html. Web App Check is reCAPTCHA v3
  (`EXPO_PUBLIC_RECAPTCHA_V3_SITE_KEY`), registered for waldgrave.com. Android claims
  those links in the binary (app.json intent filter); iOS needs a
  `/directdemocracy/app/*` component in waldgrave's apple-app-site-association,
  added only once a build with the prefix-stripping `+native-intent.ts` is
  live in the store (older builds would open the link to a missing screen).
- Languages (2026-09-29): `Locale` is en, es, zh (Simplified), pl, tl, ko,
  hi (`LANGUAGES` in src/lib/i18n.tsx); dictionaries in src/i18n/<code>.ts,
  all keyed by the English source. Spanish is the full set; the other five
  cover the app's own text (AI-translated, need a native read) while seeded
  data and server notifications fall back to English. Every new string gets
  its entry in EVERY dictionary. Never branch on `=== 'es'` for copy:
  use keyed templates (`tr('{n}d ago')`, `tr('Ward {n}')`) and
  `dateLocale()` for date formatting.
- Dates: `formatWhen` shows Chicago time (meetings, votes, deadlines, and
  posting windows are Chicago events), so a viewer elsewhere never sees the
  day before.
- React Compiler is on (app.json `experiments.reactCompiler`): it caches
  render-time calls like `wardLabel()`, `plural()`, `formatWhen()` and
  `raceInfo()` by their arguments alone, so they don't know the language
  changed. Two rules keep every screen in the right language (2026-09-30):
  `LocaleProvider` draws nothing until the saved language has loaded, and
  changing the language redraws the navigator (`LocaleKeyedStack` in
  src/app/_layout.tsx); a screen that changes it calls
  `reopenAfterRedraw(path)` (src/lib/locale-remount.ts) to be put
  back. Don't bypass either. The navigator also redraws when the phone's
  text size changes while the app is open, reopening the same screen:
  React Native keeps already-drawn text in its old size's box (clipped
  when text grows) until it is drawn again.
- Entrance animations go through `enter()` (src/lib/motion.ts): phones only.
  On the web, Reanimated hides an element until its entering animation
  starts, and one mounted in a background tab never starts, so cards came
  back invisible.
- Voting dates always name their scope and use "starting <date>", never
  "from <date>" (see `VOTING_MILESTONES` `detail`): "early voting opens
  downtown", not "early voting starts". Reminder bodies name their date,
  never "today", since each is sent the day before and the day of.
- Text size: `ThemedText` follows the phone's text size to 2x for body text,
  1.6x for small text, 1.4x for headings (`MAX_SCALE`).
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
  casting one takes a home ward, verified or declared (rules check
  `me().wardId != null`; accounts with no ward see the buttons disabled with
  both ways in), and only verified constituents move the grade. Officials set their own `upvoteAlertThreshold` in the command center; the
  upvote trigger notifies them once per question when it crosses that bar.
- Question upvotes ("I want this answered too"): one presence-only vote doc at
  `officials/{uid}/questions/{qid}/votes/{voterUid}` (and the same under
  `electionQuestions`). Triggers recount the question's upvotes/upvotesVerified
  and the official's `answerWeights` buckets; the answer score weights every
  question by resident weight (2026-09-28). The community verdict on an
  answer (answered / dodged) is decided the same way (2026-09-29): only
  verified judgments from the official's own ward count in the verified
  slice (any verified Chicagoan for a citywide official); judgments carry
  `uid` and `wardId` (rules pin both), and ones from older binaries without
  a ward count toward citywide officials only. The asker can't join their
  own question (rules and UI). Weighting: 2 if a proven resident asked it
  (verified, and of the alderman's ward; any verified Chicagoan for a
  citywide official), else 1, plus 1 per verified resident who joined it
  (`authorResident` stamped by onQuestionCreated, `upvotesResident`
  recounted from upvote docs, which now snapshot `wardId`). Ignoring a
  question fifty residents joined costs far more than ignoring an unbacked
  one. The ignore clock starts at claim: `claimedAt` is stamped the first
  time a profile is claimed, and a question's week of grace runs from the
  later of its creation and the claim. Question lists sort by upvotes, recency breaking
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
  Every notification is written in both languages (`title`/`body` plus
  `titleEs`/`bodyEs`, required by `sendNotification`) and the app picks by
  the device's language; people's own quoted words stay as written.
  A notification about one item links to that item, not just its page: AMA
  notifications carry `?q=<questionId>` and `/official/[id]` opens scrolled
  to that question with an outline around it (for the official themself,
  `/command?q=` does the same in the command center). New notification types follow
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
- Votes can be taken back while voting is open (2026-09-29): tapping your
  own concern priority, poll choice, or approval again retracts it (approval
  polls: clear every pick); the triggers drop the deleted ballot from the
  tallies. The privacy page promises this.
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
- Spanish (and the five languages above): `src/lib/i18n.tsx` (`useT()`,
  `usePlural()`, `useLocale()`) with strings keyed by their English source
  text in `src/i18n/es.ts` (and zh / pl / tl / ko / hi); a missing key
  renders the English. The locale lives on the device (AsyncStorage),
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
- Districts (2026-09-29): `users/{uid}.districts` holds one number per
  district type (US House, IL Senate / House, Cook commissioner, Board of
  Review, subcircuit, school board '1a'..'10b', police) plus the `wardId`
  they were found in, and never the address. The Didit webhook stores them
  from the verified address; anyone else types an address once on
  `/my-districts` (`findMyDistricts`, 5 a day, refused when the address is
  outside their home ward; declaring another ward drops them). The
  election tab's grids (`DistrictCells`, `useMyDistricts` in
  src/lib/districts.ts) lead with the viewer's district, or with their
  ward's few districts from `WARD_DISTRICTS` when no address is on file,
  and "See all" opens every district. Boundaries: `npm run
  build-district-map` writes functions/data/district-boundaries.json and
  src/constants/ward-districts.ts (from populated 2020 census blocks, so a
  ward lists only districts where its residents live). Subcircuits 13 and
  18 have no Chicago residents and have no cards on purpose.
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
  Two dials on the same doc: `latestVersion` WARNS (snoozable for a day) and
  `minVersion` BLOCKS (no Close, no snooze, the app is unusable until
  updated); set the floor with `--min-version <version>`, never above
  latestVersion, and only when a rule or data change would break the older
  binary. The floor can only reach binaries that shipped with the modal
  (1.0.9+); 1.0.7 and earlier have no prompt code at all. Both cards' built-in
  text is warm and feature-free on purpose (it lives in the binary forever):
  a please, a thank you, nothing about a specific release. An optional
  per-release line (`--message "..." --message-es "..."`, stored as
  `config/app.updateMessage(Es)`) replaces it on both cards in builds after
  1.0.12; clear it on the next flip so it never describes the wrong release. The doc is
  world-readable, admin-write-only; a platform with no store URL on the doc
  never nudges.
- Paid verification (`functions/src/payments.ts`): Didit's first 500 ID
  checks each month (Chicago time, counted in `verificationUsage`) are free;
  past them, and for every bill move (proof of address is never free), a
  session spends one credit from `verificationCredits/{uid}` (`id` or
  `bill`). Credits come only from `redeemVerificationPurchase`, which checks
  the purchase with the store (Apple signed transaction against the root
  certs in functions/data/apple, sandbox accepted for App Review; Google via
  the Play Developer API as the functions service account, which must stay
  invited in Play Console) and records it once in `verificationPurchases`.
  An unopened link that expires refunds its credit. Products are consumables
  with the same ids on both stores (`verification_standard`,
  `verification_bill_reduced` inside the 500, `verification_bill_standard`
  after); prices live on the store products and the app shows the store's
  price, never a hard-coded one.
  Free checks are limited so nobody can spend the 500 by starting and
  quitting (2026-09-28, `verificationLimits/{uid}`, Admin SDK only): one
  open session per account (asking again within 24 hours hands back the
  same link), 3 free sessions per account per 90 days, and a one-minute
  start lock; past those a check is paid like one after the 500 (the
  quote's `reason`, 'month' / 'attempts', and the verify screen words it).
  There is deliberately NO daily cap: a surge from a post taking off is the
  goal. Instead, once 100 free sessions start in a Chicago day, a free check
  needs a confirmed email or Google / Apple sign-in (`emailRequired` on the
  quote, a confirm-email card on the verify screen), and the operator is
  notified once that day. Made-up email addresses are the cheap account. An unopened link that expires gives its
  free attempt back; an opened one that is abandoned or declined does not. The verify screen asks `getVerificationQuote`
  before showing the button. Keep the product list in payments.ts and
  src/lib/verification.ts in sync.
  App Review accounts (2026-09-29): inside the 500 a reviewer can only
  reach one product, so `verificationLimits/{uid}.reviewPricing`
  ('within500' / 'past500', Admin SDK only) prices one account as if the
  month were inside or past the 500 and drops the free-attempt count, the
  90-day move window, the handed-back open session, and the email gate for
  it. Set with `npm run review-account -- --email <e> --pricing past500
  [--verified]` (verified review accounts live in ward 51); every run clears
  the account's credits and open session.
- Moderation (2026-09-29): reports go to `reports` as before. Once 5
  different accounts have open reports against a citizen, `onReportCreated`
  adds them to `moderation/shadowbanned` (public read, server-only write):
  every app hides their posts through `useBlocks().isBlocked` (they still
  see their own), detail pages read as not found, and their posts notify
  nobody. Officials and candidates are never hidden automatically, and an
  official still sees a hidden person's questions to them in the command
  center (so they're never graded on questions they can't see). There's no
  in-app alert: the weekly task runs `npm run moderate` and reports what's
  waiting to Brian, who decides. `--clear`, `--remove`, `--remove-posts`,
  and `--delete-user` (server-side via `moderationActions` /
  `onModerationAction`, sharing `eraseAccount` with self-deletion; a ban
  keeps the identity claim marked `banned` so that ID can't verify again).
  The community rules live at `/rules`, linked only from the bottom of
  Settings. An "Other" report must say what's wrong (`note`, 5-500
  characters, required by the app; rules keep it optional only for older
  binaries), and the review shows it.
- Concern priority is the `PriorityScale` (one joined bar, fill deepening
  toward 5, "Minor" / "Urgent" under the ends); every grade letter shows
  `GradeBasis` (verified residents who rated, questions graded) beside it.
- Help on every screen (2026-09-30): a "?" (`HelpButton`,
  src/components/help-button.tsx) in every header's top-right corner
  (`headerRight` in the root stack's screenOptions and in MODAL, beside a
  page's share button via `HeaderActions`) and in the top-right of each tab
  screen (the Screen shell). It opens `/help?page=<route>`: "On this page"
  (the page's fixed description plus a live summary) and "What you can do".
  The fixed text is `PAGE_HELP` in src/constants/page-help.ts, keyed by the
  route as useSegments() names it (the command tab has one entry per role);
  the live lines come from `usePageSummary(page, lines)` (src/lib/page-help.ts),
  which each screen calls with translated templates filled from its own data
  (counts, standings, the viewer's status), reported only while focused. No
  AI. A new screen gets an entry and a summary; a changed control updates
  its entry, in every dictionary in the same change.
- Directions (2026-09-30): addresses open with `openDirections`
  (src/lib/open-link.ts): on iPhone, Apple Maps, or a chooser of Apple
  Maps / Google Maps / Waze when either is installed (their schemes are in
  app.json `LSApplicationQueriesSchemes`); on Android a geo: link, which the
  system's own app chooser handles; on the web, Google Maps directions.
- Election tab layout (2026-09-30): each ballot is a full-width band of
  its own color (`ElectionBand`, theme `novemberBand` / `februaryBand`,
  headed by its date; the jump grid's cells wear the same colors). Order:
  February band (race for mayor, mayoral AMA), November band (`YourRaces`,
  how to vote, the statewide and county offices, the advisory question,
  then the school board, judges, and every district), February band (ward
  races). `YourRaces` (src/components/your-races.tsx) leads the November
  ballot: with an address on file, every race that address decides, with
  who is running, and the ones not up this year in one line; without one,
  a prominent ask for the address ("Find my races"), since the address is
  what puts a person's races first and folds the rest behind "See all". A
  successful lookup on /my-districts goes straight back there. Jump targets
  are measured at tap time (`measureLayout` against the tab's wrapper),
  since the web's onLayout misses position-only changes. Ward 51 (test)
  accounts may look up any Chicago address; the districts are stored under
  ward 51 so the app treats them as theirs.
- Each ward's early voting site (2026 general) is in
  src/constants/early-voting-2026.ts, from the Board's poster; the
  how-to-vote card shows the home ward's site with hours and a directions link.
- Security posture and accepted limitations are documented in `docs/AUDIT.md`;
  update it when the trust model changes.
- Typecheck with `npm run typecheck` before finishing.
