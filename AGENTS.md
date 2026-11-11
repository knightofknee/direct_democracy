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
  notifications screen). Six tabs step labels down further (see the tab
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
- Phone notifications (2026-09-29): expo-notifications; Settings > Phone
  notifications holds the switches, and since 2026-10-09 (Brian's call; no
  one had turned them on) the app also offers one kind once, right after
  the act it is about (`offerPush` in src/lib/push-offer.ts: "answers"
  after asking a politician or every candidate, "comments" after raising a
  concern, "replies" after commenting; phones only, once per kind per
  phone, never when that kind is on). One switch per kind
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
- Take part (2026-10-05): each ward page has a "Take part" section under
  the alderman (`WardTakePart`, src/components/ward-take-part.tsx): ward
  meetings from the ward newsletter, development and zoning, the police
  district councils covering the ward, and the ward office (addresses with
  directions, hours, phone, email, newsletter, its latest issue's AI
  summary, 311). Data, all public record, no client writes:
  - `zoningItems` (`syncWardCivics`, twice daily, functions/src/zoning.ts):
    zoning map amendments in committee at the Clerk (eLMS has no ward field:
    the filing alderman's office, else the title's first address geocoded
    once), joined to the Committee on Zoning agenda PDF (ward, applicant,
    change, purpose, hearing, written comment deadline); Zoning Board of
    Appeals agenda cases; Plan Commission hearing items (can span wards).
    chicago.gov answers bots with 403, so those fetches send a browser user
    agent. Testimony rules shown are only the ones the boards print (ZBA
    participation page, Zoning Committee agenda); the Plan Commission states
    none, so it gets a link.
  - `civicMeetings` (same function, functions/src/civic.ts): Police District
    Council and CCPSA meetings from CCPSA's events feed. CAPS beat meetings
    are linked, not synced: CPD's calendar blocks every non-browser request.
  - `officials.officeAddresses` and website fixes (`WEBSITE_OVERRIDES`) come
    from `seed-aldermen`; `officials.newsletterUrl` from `npm run
    set-newsletters` and scripts/data/ward-newsletters.json (one entry per
    ward: the office's own newsletter archive, else its signup; campaign
    lists only when the office's site offers nothing else; null with a note
    when none works).
  - `newsletterIssues` (AI summary per issue), `wardMeetings`,
    `officials.officeHours`, and `newsletterDigests` (home tab, "This week in
    the wards", Mondays) are written by `npm run newsletters` from the daily
    scheduled task "ward-newsletter-digest", which reads each new issue
    under ONE prompt, scripts/data/newsletter-prompt.md (describe, never
    rate; same words for every ward). Feeds and archive pages cover about
    half the wards; email-only lists need a subscribed inbox, not built yet.
  - Meetings a newsletter announces without a time (2026-10-12) are kept
    too: `wardMeetings` with `start: null`, `date` (the day, when given) and
    `expiresAt` (the day after `date`, else 21 days after the issue), listed
    under "Time not found in the newsletter" with the office's phone. "Not
    found", never "not set": the time may exist, the text just doesn't say
    it. Each queued issue carries its ward's open ones (`undated`); a later
    issue that gives the time lists them in `resolves`, and a dated meeting
    on the same day replaces one automatically.
- News tab (2026-10-07): `news` (newspaper icon, after elections since
  2026-10-13: the ballot holds the middle of the bar, labeled
  "elections" since it covers two ballots, the route stays `election`) lists headlines from every newsroom that covers Chicago or
  Illinois government, has a public feed, and is in the top million of the
  Tranco list (tranco-list.eu; Brian 2026-10-08: traffic is the main
  qualifier; `npm run news-ranks` rechecks every outlet, including the
  watched ones below the bar, and the Monday newsletter run reports it),
  newest first, never ranked or hidden by the app. A national site's
  Chicago section (CBS, Chalkbeat) counts by its whole domain's rank. That inclusion rule is the same for every outlet on
  purpose (Brian is on the ballot, so the list must not read as curated),
  and it is stated on the sources screen and in help. Brian's call: include
  the outlets that allow it; ask the ones that block feed readers; if one
  declines, list it as declined. `syncNewsFeeds` (every 20 minutes,
  functions/src/news.ts) fetches each feed with a user agent naming the app
  and keeps 14 days in `newsItems` (headline, link, time, language, and
  `wardIds` / `officialIds`) and the source list in `newsSources`; an outlet
  that turns that reader away goes in `NOT_INCLUDED` with its status
  (`blocked`, `asked`, `declined`), never around the block (Tribune, Crain's,
  and the Hyde Park Herald's 429 from data centers). Moving one into
  `SOURCES` once it agrees is the whole change, and taking one out deletes
  its stories on the next run. Open outreach and sourcing work lives in
  docs/content-follow-ups.md. AI-written summary sites (Hoodline) are left
  out: the app is the summary.
  Headlines are never translated; each story's language comes from the
  source, the Sun-Times' `/la-voz/` path, or the headline (Chalkbeat
  translates some into Spanish and Chinese). Each person turns sources and
  languages off on `/news-sources` (`users/{uid}.newsPrefs`, or the device
  when signed out; `useNewsPrefs` in src/lib/news.ts). Ward matching is
  text rules, never AI: "25th Ward" / "Ward 25", an alderman by any form the
  press uses (`officialRules`: full name, no middle initial, short first
  name, "Ald. Last" when unique, "Last (25th)"), or a neighborhood at least
  15% of whose residents live in the ward (functions/data/
  neighborhood-wards.json from `npm run build-neighborhood-wards`, the city's
  98 neighborhoods plus aliases like Pilsen and Bronzeville); neighborhood
  names count only in Chicago-only newsrooms or stories that say "Chicago".
  Ward pages and alderman pages show the matches as "In the news"
  (`InTheNews`), and the tab's ward switch narrows to the home ward.
- Ward concerns end with a quiet "Report it to 311" link (311.chicago.gov);
  the how-to-vote card folds "More help voting" (accessible voting,
  language help, permanent vote by mail, pre-registration at 16, election
  judges; each line verified on chicagoelections.gov, `VOTING_HELP`).
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
  those links in the binary (app.json intent filter); on iOS, waldgrave's
  apple-app-site-association has carried a `/directdemocracy/app/*`
  component since 2026-10-01, once 1.0.15 (the first build whose
  `+native-intent.ts` strips the prefix) was live, so shared links open the
  installed app.
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
- Mayoral candidate pages carry two pieces of operator copy, written by
  `npm run set-platform-summaries` (`--check` lists stale ones, `--dump`
  writes every live platform out for rereading): the platform note
  (`platformNote` / `platformNoteEs` / `platformNoteTone`, held in
  `scripts/data/platform-summaries.json`) and the expandable "AI summary"
  (`aiSummary`: "What sets them apart" and "Where they split", short chunks
  that open with a bold "Topic: " lead, shown at full body text size, never
  as a block of small print, with the `policiesHash` it was written from).
  Since 2026-11-09 the summary is NOT weighted the way the platform weights
  it (that gave every candidate the same housing, police, budget chunks):
  it says what separates this candidate from the field, under the candidate
  content rules below, and for anyone in the mayor games its words come
  from mayor-games.json, never from a second copy. Every summary uses the
  ONE set of rules in `scripts/data/platform-summary-prompt.md`, Brian's
  own page included. Notes and summaries
  describe and never rate: counts and structure are fine; praise words,
  superlatives, and ranking ("most detailed", "real platform",
  "well-formatted") are not, because under scrutiny they read as the app
  picking favorites. A `"note": null` in the JSON leaves the stored note
  alone. Alexi Giannoulias published a mayoral platform on 2026-11-02
  (alexiforchi.com/policy, his sourceUrl since then), so his note is a plain
  description like the others. Page order is fixed: name card
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
  `electionRaceNotes/{election--race}` are read-only voter directories for
  the Feb 23, 2027 municipal ballot ('2027-municipal': citywide clerk /
  treasurer, ward-N aldermanic races, pdc-N police district councils),
  seeded by `npm run seed-election` from `scripts/data/municipal-2027.json`
  (full sync per election). The Nov 3, 2026 general election and the 2026
  school board directory left the app on 2026-11-04, the day after the
  vote: `RETIRED_ELECTIONS` in seed-election.ts deletes their docs
  (`2026-general` cards and notes, the whole `schoolBoardCandidates`
  collection) on every run, and their screens, constants, data files, and
  the ballot planner (picks, My ballot, the cheat sheet, YourRaces, judges,
  districts sections) were deleted rather than hidden. Cards carry an
  optional `photoUrl` (external https headshot, rendered by link like
  officials' portraits, never stored) and, when the photo isn't a centered
  headshot, a `photoFrame` {x, y, zoom} (focal point as image fractions +
  zoom past cover, applied by `OfficialAvatar`); race screens show each
  candidate's runningOn preview so the comparison happens without a tap.
  Declared write-ins carry `writeIn: true`: listed after the printed names
  with the how-to-write-in explainer (`WRITE_IN`), since only filed
  write-ins count. Race ids/labels and the how-to-vote facts live in
  `src/constants/elections.ts` (`HOW_TO_VOTE_2027` says only what the
  Board has posted; `VOTING_MILESTONES` is duplicated in functions for the
  reminders), and `/ward-race/[ward]` pairs the incumbent's report card
  with declared challengers. A weekly scheduled task (Mondays,
  "weekly-election-data-refresh") re-verifies the municipal data file and
  the mayor games data against current sources and re-seeds.
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
  to `/officials`; wards link to each alderman directly), and on 2026-10-07
  it became `/notifications`, opened from the bell (`NotificationBell`,
  with the unread count) beside the help "?" in the row at the top of every
  tab (the Screen shell), so the news tab could have its place.
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
  English until someone picks another from the globe on the welcome screen
  or in Settings (the first-launch prompt was removed 2026-11-09). The ENTIRE app UI is covered (every screen and
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
- Judges and district races left with the November ballot (2026-11-04).
  `pdc-N` (police district councils) belong to the 2027 municipal election
  and are the one district race still in the app; `raceInfo()` in
  constants/elections.ts resolves a February race id to its label and
  detail.
- Districts (2026-09-29): `users/{uid}.districts` holds one number per
  district type (US House, IL Senate / House, Cook commissioner, Board of
  Review, subcircuit, school board '1a'..'10b', police) plus the `wardId`
  they were found in, and never the address. The Didit webhook stores them
  from the verified address; anyone else types an address once on
  `/my-districts` (`findMyDistricts`, 5 a day, refused when the address is
  outside their home ward; declaring another ward drops them). Since the
  November ballot left (2026-11-04) the only grid still using them is the
  police district councils in `WardRaceSection` (`DistrictCells`,
  `useMyDistricts` in src/lib/districts.ts): it leads with the viewer's
  district, or with their ward's few districts from `WARD_DISTRICTS` when
  no address is on file, and "See all" opens every district. The other
  district numbers are kept for the next election that uses them. The
  police district card has its own address field (2026-11-09, Brian: it
  said "your sample ballot names yours" and offered neither a lookup nor
  the ballot): `findMyDistricts` also answers people who are not signed
  in, storing nothing (one shared daily cap, `SIGNED_OUT_LOOKUPS`), and
  the phone keeps the numbers itself (`rememberDeviceDistricts`,
  AsyncStorage `districts.device`, read by `useMyDistricts` only while
  signed out). The Board's own lookup, which shows the sample ballot, is
  linked beside it. Boundaries: `npm run
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
  never nudges. Android (2026-10-06, ported from Escape from Hades IRL)
  compares the build number, not the name, since Android builds only bump
  versionCode and several Play releases share one name: its own dials
  `androidLatestBuild` / `androidMinBuild` (`--android-latest <code>`,
  `--android-min <code>`), flipped once Play serves that build, closed
  testing included, so testers hear about every build. Android builds up to
  versionCode 8 predate this and still read latestVersion / minVersion.
  Every release flips the dial of each store it reached.
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
  Report dialog (2026-10-22, Brian: a report is the only thing the person
  is doing): the flag in `ContentActions` opens a modal, never inline
  chips, and nothing sends on a tap: check every reason that applies
  (`ChoiceRow`), add a note, then Send report; Block sits in the same
  dialog. Reports carry `reasons` (the list) plus `reason` (the most
  serious, for older tools). Child safety reports notify the operator at
  once, phone included (type `childSafety` pushes with no switch).
- In-app feedback (2026-10-22, for Google Play's Child Safety Standards
  "in-app feedback mechanism", which rejected versionCode 9): Settings >
  "Send feedback or report a problem" opens `/feedback`, open signed in or
  out: a topic (child safety first), a message, and an email when signed
  out. `sendFeedback` callable stores it in `feedback` (admin read), 5 a day
  per account and 30 a day for all signed-out senders together; child
  safety messages alert the operator at once. The admin screen and `npm run
  moderate` list open feedback (`--handled <id>` closes one). The public
  standards page is waldgrave.com/directdemocracy/child-safety; keep it
  describing both paths.
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
- The mayor games (2026-11-04, Brian: the November 3 election happened, and
  the tab had to give people the tools to decide on a mayor in a format
  that is actually fun): the middle tab (`(tabs)/(election)/election.tsx`,
  route still `/election`, tab label "elections" again since 2026-11-09
  because it holds the whole ballot; the page's own title is "the mayor
  games") opens on the games (Blind date as a hero card with "Play", the
  other four as rows), then "your second dates" when there are any, the
  countdown, then one February band (`ElectionBand`, no ballot prop any
  more): how to vote, the mayoral AMA, "the rest of the ballot"
  (`WardRaceSection`: citywide, your alderman, your police district
  council), and everyone running for mayor.
  ORDER (Brian, 2026-11-09, after the field shipped A to Z: "we previously
  agreed fairness requires randomness"): any list of mayoral candidates
  that is not ranked by a stated measure is in random order (`shuffledBy`
  with a seed per mount), never alphabetical: the field list, the cheap
  date's no-report group, every pizza group, the SEO pages' "other
  candidates". Only a stated ranking (support per dollar, pizza verdict)
  or the person's own picks (second dates) may order them otherwise.
  The app OPENS on this tab (2026-11-09): a plain launch at "/" passes
  through the home tab once (`src/lib/launch.ts`, `HomeTab` in
  (tabs)/index.tsx) and sign-in lands here; "/" itself is still the big
  board for links and `router.replace('/')`. The data is ONE read-only doc, `mayorGames/2027`,
  seeded by `npm run seed-mayor-games` from scripts/data/mayor-games.json
  (`--check` validates and prints the orders); types and every ordering
  rule live in src/lib/mayor-games-data.ts (no React Native imports, so
  the seed and SEO scripts share them), the live hook and the blind-date
  memory in src/lib/mayor-games.ts. Per candidate: slug, name, title, bio,
  website, photo, `candidateUid` (their candidates/{uid} page) or
  `platformUrl`, `status` (filed / certified / removed / withdrawn, with a
  note), `points` (what they would do, each with a verbatim `quote`
  {text, source, url} when there is one), `summary` ("what sets them
  apart", see the content rules below), `money` (summary + quotes only about taxes, the
  budget, and saving people money), `finance` (committee, raised, spent,
  cash on hand, period, ISBE url: spent is total expenditures Jan 1 to
  Sept 30, 2026 or since the committee formed), `support` (first-choice
  pct in the latest public poll, null when not asked about), `pizza`
  ({verdict thin | both | deep | none, preference, quote}: thin crust is
  correct, we do not explain ourselves), `fun`, `sourceUrls`. Every
  English field has its Spanish beside it (`textEs`, `summaryEs`, ...);
  quotes stay in the language they were said in; no em or en dash
  anywhere, a quote with one is cut before it. The games
  (`/game/[kind]`, one screen, five components). Blind date and speed date
  play on `GameStage` (src/components/game-stage.tsx; 2026-11-09, Brian:
  the first version made you scroll up to see who was revealed and back
  down to move on, and on a phone neither scroll should exist): three
  fixed bands, who you are with pinned on top, the card in the middle (the
  only part that scrolls, inside itself), the buttons pinned at the bottom.
  Never put a date's identity or its controls inside the scrolling part.
  The card swipes sideways (RNGH pan, horizontal only) and a swipe is the
  same act as the button on that side. Blind date: the points, then a
  verdict given blind, "Second date" (heart, or swipe right) or "Pass"
  (or swipe left), or "Just reveal"; any of the three turns the portrait
  over (`FlipAvatar`, a timing-only FLAT flip: the question mark narrows
  to an edge and the portrait widens from it) and the name rises in
  where "Mystery candidate" was. Never a 3D transform (rotateY with
  perspective) in the games: on iPhone it left a blank layer over the
  stage from the portrait's middle to the right edge that swallowed every
  tap, on every reveal, and the web never showed it (found on the
  simulator 2026-11-10, the day before the release build). Until the
  reveal each quote's source reads "Source shown with the reveal"
  (`QuoteBlock sealed`): most sources are the campaign's own site, named
  after the candidate, and gave the date away. After the reveal: "Next date" (or swipe
  left), a heart to change the verdict, and the candidate's page.
  `RoundMarks` counts the round. This phone keeps the round and the
  verdicts (`useBlindMemory` in src/lib/mayor-games.ts, AsyncStorage
  `mayorGames.blind.seen` / `.verdicts`, never sent); when everyone has
  been met the stage shows the second dates and "Go again". Blind points
  are written without he / she / his / her so the wording does not give
  the date away (quotes stay verbatim). Speed date: random order fixed per
  visit, a 60-second bar that runs down and rings but never throws anyone
  out, a two-sided card ("What they would do" / "Next to the others"),
  swipe or buttons to move. Pick-up lines (added 2026-11-09, Brian: a game with a
  TikTok attention span that teaches who the candidates are): one real
  quote on the card, three faces under it, tap who said it; right or wrong
  lands at once with the source and the point it came with; ten lines a
  round, a streak, and the best streak kept on the phone
  (`mayorGames.lines.best`). `dealLines` is fair by candidate, not by
  quote count: every speaker gives one line before anyone gives a second.
  `quoteLines` skips quotes under 28 characters and any that name their
  speaker. More sourced quotes in mayor-games.json make this game better.
  Cheap date leads with the money (2026-11-09, Brian: "it could obviously
  use the total spent"; the first build buried spending in small print):
  the field's total spent up top (`fieldSpending`), then per campaign three
  numbers at full size, spent, poll support, and cost per point of support
  (`costPerPoint`), with a bar for the current sort. Three sorts, each a
  stated measure (`CheapSort`): best bargain (`supportPerMillion`, poll
  points per $1M spent, the default; not polled counts as 0 and sorts by
  least spent), most spent, most support. No spending report waits at the
  end. Tap a row for the books (raised, spent, cash on hand, period, note,
  ISBE link) and the money talk. LESSON: when reviewing a game, review
  what it tells a voter, not only how it moves; the number in a game's
  name belongs at full size. Blind and speed dates carry a one-line stat
  under the name (poll support, money spent).
  Pizza date (thin first, then hedging, then deep dish, then a plain list
  of "candidates who don't care about pizza"). `HOST_LINES` are the
  host's bits between dates: jokes about the games and the city, never
  about a candidate. `/mayor/[slug]` is everything the games know about
  one candidate, with sources, and links to their platform page in the
  app or their site. Brian Carlisle and Toni Brooks have candidate
  accounts but appear in no filing list, so they are not in the games. The
  old "All other declared candidates" directory card
  (candidates/other-declared-candidates, scripts/seed-other-candidates.ts)
  is retired but kept: nothing lists it, nothing seeds it (Brian,
  2026-11-04).
  Seeded data falls back to English in the five non-Spanish languages.
- Candidate content rules (2026-11-09, Brian: the summaries gave every
  candidate a police section "yet across all candidates there is zero
  ideological difference of note"; find how candidates distinguish
  themselves and stop showing what is the same for everyone). The rules
  are scripts/data/platform-summary-prompt.md; read it before touching any
  candidate copy. In short: every sentence must fail the test "would this
  still be true with another candidate's name on it?". The work starts
  with a contrast sheet of every commitment across all platforms, sorted
  into three piles. CONSENSUS (nearly everyone says it, or they differ
  only in numbers): one line in `mayorGames/2027.consensus`, shown once
  ("What nearly all of them say"), never on a candidate's page. Policing
  is consensus: no summary chunk and no split is about it. SPLITS (two or
  more answers to one question, each held by named candidates): the one
  table `mayorGames/2027.splits`, from which EVERY comparison in the app
  is drawn (`SplitList`, `splitsFor`, `splitText`), so a fact reads the
  same on every screen and changes in one place. ONLY (one candidate
  proposes it): leads that candidate's summary. A summary is at most four
  chunks and 105 words: "Only <Name>", sides of splits with the other
  side named, "With most of the field" (one line when a platform says
  what most say), "Not published" (one line when there is nothing).
  Short is the goal; a candidate with one idea gets one chunk. Sources are
  the platform as listed in the app and the candidate's own words from
  THIS campaign; never an earlier campaign, an opponent, or memory. The
  seed (`seed-mayor-games --check`) refuses a police chunk, a fifth
  chunk, rating words, a split with one live side, and a candidate on two
  sides, and prints the splits and who is thin on quotes. There is ONE
  copy of each summary: `set-platform-summaries` copies a games
  candidate's summary and split text onto their candidates/{uid} page
  (platform-summaries.json keeps only the note and policiesHash for them;
  it still holds both pieces for someone outside the games), because two
  copies drifted and one had wrong facts. Page order on `/mayor/[slug]`
  is by importance: name, three numbers (poll support, spent, per
  point), what sets them apart, where they split, in their words, then
  platform links, money talk, the books, pizza, sources.
- Former mayor trivia and "only one of them would" (2026-11-09). Trivia is
  a SMALL card between the games and "where they split" (`MayorTrivia`;
  Brian: the splits are the compelling part, so the fact stays small): one
  fact about a former mayor, the mayor and years as a link to its source,
  and a shuffle button. Facts live in `mayorGames/2027.trivia`
  ({id, mayor, years, text, textEs, url}, at most 220 characters, each
  confirmed on the page at its url; never the sitting mayor or anyone on
  the ballot, which the seed refuses). They come at random and the phone
  remembers which it has shown (AsyncStorage `mayorGames.trivia.seen`,
  `pickTrivia`), so none repeats until all have had a turn. A
  small arrow under the shuffle button (2026-11-10, hidden until there is
  one) steps back through the facts shown since the card appeared; the
  shuffle button walks forward again before it deals a new one. The card's
  height (Brian, 2026-11-10: a shuffle that shifts its own button is
  jarring, but long facts are the interesting ones and must not be
  punished): one line shorter than its tallest fact at that width, text
  size and language, so most facts fit and nothing moves, and only the
  longest grow the card by a line and push "where they split" down. It is
  done by measuring, not by a list of long facts: every fact is laid out
  unseen behind the one on show in a clipped row (`triviaSizer`), that
  row's height is the tallest fact's, and the area gets it less a line as
  its minimum height. (A negative margin did this without measuring on the
  web; phones ignore it.) Two lines shorter was tried on paper and
  rejected: at 390pt most facts would then move the page. The shuffle
  button and the arrow NEVER move: their column keeps the shorter card's
  height (measured once) and stays at the top, the shuffle button at its
  middle, the arrow halfway between it and that card's bottom edge with an
  8pt gap between their touch areas. The header under the card sits 20pt
  below it, not the usual 32. The weekly
  task grows the list. "Only one of them would" (`OnlyList`) sits under
  the splits and is read straight off each summary's leading "Only <Name>"
  chunk (`onlyProposals`), four at a time in random order, so it cannot
  say anything a candidate's page does not.
- The elections tab is a group with its own stack, src/app/(tabs)/
  (election)/ (2026-10-14, Brian: the tab bar must stay through the races,
  and the back stack of races made getting out a long walk): the tab
  itself, the games, the mayor pages, and the election-race,
  election-candidate, ward-race, and election-question pages live there,
  keep their URLs (a group adds no segment), and keep their help keys
  (`helpKey` maps them). Tapping the tab while in it pops back to the tab.
  Mayoral candidate and policy pages stay in the root stack (they serve
  the command tab too).
- No districts by hand (2026-10-13, Brian): races follow the street
  address and nothing shorter, so the address lookup is the only way in.
  Checked against the district maps: across Chicago the eight district
  types form 613 different combinations, and knowing any one leaves 49 to
  267 possibilities for the other seven. A hand-entry screen was built,
  then removed the same day, and the `setMyDistricts` callable deleted.
  Someone unwilling to give an address gets no police district council of
  their own.
- First run and sharing (2026-10-09, from the testers' report; welcome
  rebuilt 2026-11-09): a one-time `Welcome` (src/components/welcome.tsx,
  AsyncStorage `welcome.v2`; updaters see it once too) is about the mayor
  games first (what they are, "Go on a blind date" /
  "Look around first") and lists the rest of the app second, in small
  print. It also carries the language choice: there is NO first-launch
  language prompt any more (Brian: nearly every user reads English). The
  app opens in English; a globe with the current language's own name in
  the welcome's corner opens every language named in itself (never the
  word "language", which would need seven translations), and Settings
  keeps its switch; Settings has "Share the app" (`ShareAppButton`,
  the waldgrave.com/directdemocracy page, an editable message, no referral
  tracking). No rating prompt: Brian wants more good users before asking.
  Store copy lives in docs/store-listing.md (English and Spanish, within
  each store's limits); `npm run store-screenshots [-- --es]` captures
  captioned 1080x1920 shots with headless Chrome from the local web dev
  server on port 8085 (the live site's App Check turns headless Chrome
  away); the three game shots come first (1 the tab, 2 blind date, 3 pizza
  date), then alderman, big board, take part, news; the script marks the
  welcome seen (`welcome.v2`) and sets the language the way the app stores
  it, and waits for each page to draw (look at the images after a run: a
  changed first-run card or a slow bundle shows up as a covered or blank
  shot); the alderman shot is the fictional ward 51 alderman, the game shots
  (blind date, which hides every name and face; pizza date; the tab) show
  no pick or endorsement, and
  the news shot leaves out crime, investigations, deaths, and politicians.
  The headless browser signs in to no one; dev web builds read stand-in
  districts from local storage (`dev.shotDistricts`, City Hall's;
  `useMyDistricts`), which no release or published web build reads, so
  the police council grid leads with one. Output in store-screenshots/. The App Store
  set is ONE size, 1320x2868 (`--apple`), for the "iPhone with Dynamic
  Island (large display)" slot Brian uploads to; don't switch it.
- Search and link previews (2026-10-09): `npm run publish-web` runs
  `build-seo-pages` between the export and the copy: it reads production
  (needs gcloud application-default credentials) and writes an
  extensionless HTML file per public page (candidates, races, mayor game
  pages, mayoral candidates, aldermen 1-50, ward races, /officials) with its own
  title, description, canonical and Open Graph tags, and the page's text in
  the root div (the app's createRoot replaces it on load), plus a
  sitemap.xml. Waldgrave's next.config.js serves those files as text/html
  and its robots.txt lists the sitemap. Submit the sitemap in Google Search
  Console (Brian's account).
- Screen counts (2026-10-09): anonymous, no ids, ever. `useUsageTracking`
  (src/lib/usage.ts, mounted once in `LocaleKeyedStack` in
  src/app/_layout.tsx, so navigator redraws don't count) counts views per
  help key (route pattern, never an id; the five mayor games are counted
  apart as `game/blind`, `game/lines`, ..., one of five fixed words, so
  the counts say which games get played) and sends one `usageEvents` doc a
  minute at most and on going to the background: day, platform, app
  version, `views`, and `reach` (first time today on this device, kept in
  AsyncStorage, which is how devices are counted without an id). Off in
  dev and on the emulators. `onUsageEvent` re-checks it, adds it into
  `usageDaily/{day}`, and deletes it; `npm run usage -- --days 14` prints
  tabs, other screens by device-days, and PAGE_HELP screens never opened.
  Never shown in the app, never add a uid, device id, or token to it.
- Security posture and accepted limitations are documented in `docs/AUDIT.md`;
  update it when the trust model changes.
- Phones are not the web (2026-11-10): three bugs in the mayor games only
  showed on the iOS simulator (the 3D portrait flip above; a negative
  margin and an uneven `flex: 1` split that the trivia card's layout
  leaned on). Anything that moves, flips, swipes, or is laid out with
  negative margins or shared flex space gets a run on a simulator before a
  build, not only in the browser. Use a simulator Brian is not using (boot
  a spare one and launch the newest
  DerivedData/.../Debug-iphonesimulator/directdemocracy.app; it loads from
  the Metro that is already running), and check which app is in front
  before touching anything.
- Android testing (set up 2026-11-11, Brian: "we really need to be testing
  android better"): Homebrew `android-commandlinetools` (SDK at
  /opt/homebrew/share/android-commandlinetools: platform-tools, emulator,
  android-36, build-tools 36, NDK 27.1, a Google APIs arm64 image) and
  `openjdk@17` for Gradle. One virtual phone, `dd_pixel` (Pixel 7, Android
  16, 2 GB: 4 GB starved this 16 GB Mac and hung adb). Test the RELEASE
  build, not debug: the debug build on this emulator hung on launch (ANR).
  `npx expo prebuild -p android` once, then from android/:
  `JAVA_HOME=/opt/homebrew/opt/openjdk@17 EXPO_PUBLIC_APPCHECK_TEST_BUILD=1
  ./gradlew app:assembleRelease -x lint` and `adb install -r
  app/build/outputs/apk/release/app-release.apk`. android/ is generated
  and gitignored, so EAS never sees it. EXPO_PUBLIC_APPCHECK_TEST_BUILD=1
  (set in the shell only, never in a file or on EAS) makes a local release
  build present the App Check debug token, since Play Integrity refuses
  emulators; without it Firestore answers "Missing or insufficient
  permissions". Android-only findings that day: the status bar icons were
  white on white (fixed with expo-status-bar in the root layout), and with
  edge to edge on (Android 15+ default, `edgeToEdgeEnabled=true`) the
  keyboard covers the page instead of shrinking it, so every text field
  near the bottom was hidden. `useKeyboardOverlap` / `useRevealFocusedField`
  (src/hooks/use-keyboard-overlap.ts) fix it in the Screen shell, sign-in,
  and the report dialog; a new scroll view with text fields outside the
  Screen shell needs the same two hooks. The reveal half runs on iOS too:
  iOS's own keyboard inset showed only the report note's top line and half
  of sign-in's Enter. It keeps the field plus 88pt (its button) above the
  keyboard, re-measures when the keyboard grows (iOS Passwords bar) or focus
  moves to another field, and on iOS converts the keyboard's screen
  position into an iOS sheet's coordinates (pass the sheet's root view).
- Strings that reach `t()` through a variable (`t(s.title)`, a ternary, a
  constant's field) are invisible to a search for `t('...')`: the pizza
  verdict labels shipped to the web untranslated in six languages that way
  (2026-11-10). When adding a list of labels, add their dictionary entries
  in the same edit and look at the screen in Spanish.
- Typecheck with `npm run typecheck` and lint with `npm run lint` before
  finishing, and fix every error either one reports, including ones in
  code you did not touch (2026-11-11, Brian: "pls dont tell me you decided
  to not fix errors you found"). Lint was at 0 problems after that day.
  The React Compiler rules matter here: no component defined inside
  another, no setState in an effect body (derive while drawing, or set it
  in the handler or callback that causes it), no ref reads or writes
  while drawing, and Reanimated shared values set with `.set()` inside
  gesture callbacks.
