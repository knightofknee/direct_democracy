# direct democracy - audit log

A running record of audits performed on this codebase. This platform asks for
the public's trust, so it gets treated like infrastructure: every aggregate
number a voter sees must be tamper-resistant, every identity claim must be
honest, and every failure must be visible.

## Update - 2026-09-24: nothing kept at Didit, keyed identity code

- **Found:** Didit's retention was the default, unlimited: ID images,
  selfies, face embeddings, and extracted fields stayed in Didit (and in
  the operator's console) indefinitely, contradicting the published policy
  ("only as long as needed") and, for face data, a BIPA exposure in Illinois.
- **Fixed:** after a final result (Approved, Declined, Abandoned, Expired)
  is handled, the webhook calls Didit's delete with `privacy_erasure` and
  marks `verificationSessions/{id}.erased`. `eraseDiditSessions` (nightly)
  retries failed erasures and erases sessions still undecided after 7 days.
  A 500 (geocoder outage) keeps the session so Didit can redeliver. Checked:
  the API key has delete rights (200, then 404 on repeat); a bad key gets
  403 and is never marked erased. The 3 expired August sessions were erased
  on deploy.
- **Identity code:** was an unkeyed SHA-256 of state, document number, and
  birth date, brute-forceable from a database copy by guessing ID numbers.
  Now an HMAC-SHA256 of normalized state and document number keyed by the
  `IDENTITY_HASH_KEY` secret (generated server-side, never printed). The
  birth date is no longer used. No claims existed in the old format.
- **Backstop:** Didit's console retention (App Settings, Data) can be set
  to its 1-month minimum in case both erasure paths ever fail.

## Update - 2026-09-24: paid verification

- **Who pays:** `createVerificationSession` decides in one transaction with
  the month's check count: free inside Didit's 500 for the main workflow,
  otherwise it spends one credit or refuses with `paymentRequired` (old
  binaries show the message; they cannot pay). The 700-a-month hard cap is
  gone: every check past the free 500 is paid for.
- **Credits are server-granted only.** `verificationCredits`,
  `verificationPurchases` match no security rule. `redeemVerificationPurchase`
  verifies before granting: Apple JWS signature chain against Apple's roots
  (forged and malformed tokens rejected in testing), bundle id and app id,
  refund status, and the per-account `appAccountToken`; Google token looked
  up and acknowledged through the Play Developer API, purchase state and
  `obfuscatedExternalAccountId` checked. Each store transaction is recorded
  once; a second redeem grants nothing and another account's redeem is
  refused.
- **Refunds:** a credit returns when the Didit session never starts or its
  link expires unopened (Didit billed nothing). Declined and abandoned
  sessions keep it (Didit billed).
- **Accepted:** a purchase Apple or Google refunds after its credit was
  spent is not clawed back (the check already ran). Sandbox purchases grant
  real credits so App Review can test; that costs a few Didit checks.
- **Privacy:** purchase records hold uid, product, store transaction id,
  and time; payment details never reach us. The public policy and the
  in-app privacy screen say so.

## Update - 2026-09-24: verification assigns the ward, moving, Spanish notifications

- **Found:** the Didit webhook minted `verified: true` with no `wardId`, so
  every Didit-verified account was locked out of ward concerns, ward polls,
  and alderman approval (all of which require `me().wardId != null`). Only
  operator-verified accounts (`verify-user`) had wards. No Didit session had
  been approved yet, so no account needed a backfill.
- **Fixed:** `diditWebhook` resolves the ward before it verifies
  (`functions/src/ward.ts`). Addresses come from the decision, proof of
  address before the ID; each is geocoded by the US Census Bureau geocoder
  (Didit's own geocoded point is the fallback, trusted only when a street was
  parsed) and matched point-in-polygon against the city's full-resolution
  ward boundaries (`functions/data/ward-boundaries.json`, regenerated with
  the app's map by `npm run build-ward-map`). Cross-checked against the
  city's own `intersects()` query on random points: 60/60 agree.
- **Verified now always means verified with a ward.** An address that
  geocodes outside Chicago, or no address we can locate (a passport, a
  failed OCR read), verifies nothing; the session records the outcome
  (`outside-chicago` / `no-address`, never the address), the person gets a
  notification saying why and how to retry, and the identity claim is not
  taken, so a retry with a current ID can pass. A geocoder outage answers 500
  so Didit redelivers instead of refusing a resident.
- **Notifications in Spanish:** every server-written notification now
  carries `titleEs`/`bodyEs` beside the English; the app picks by the
  device's language (which never leaves the device). Quoted user text stays
  as written.
- **Privacy:** the address still never touches Firestore. It is sent once to
  the Census geocoder (a public US government service, HTTPS, no account)
  and discarded. When the webhook arrives without the address, the function
  fetches the session decision from Didit's API with the existing key.
- **Moving:** a verified citizen can verify a new address from Settings
  once per 90 days. `createVerificationSession` enforces the window in a
  transaction and stamps `users/{uid}.reverifyAt` (Admin SDK only; the users
  update rule still allows only `displayName`) when the session starts,
  since that is when Didit can bill; an unopened link that expires hands the
  stamp back, and a failed session start releases it. A new ward replaces
  the old one and withdraws the mover's standing approval of the old ward's
  alderman (it was a constituent's; `onApprovalWrite` rebalances the grade).
  An address outside Chicago or unreadable on a move leaves the account
  exactly as it was. Officials and candidates cannot move (their account's
  ward is their office's). A renewed ID replaces the old identity claim
  instead of leaving it locked to the account.
- **Replays:** the webhook records each approved session's `outcome` on
  `verificationSessions/{id}` and acknowledges any later delivery of the
  same session without re-applying it.
- **Two ways to move:** "Verify with my ID" runs the main workflow (the
  address comes off the ID). "Verify with a bill or statement" runs the
  `DIDIT_ADDRESS_WORKFLOW_ID` workflow (functions/.env: "Move: ID + proof of
  address, 18+", $0.53, proof of address has no free tier), for someone
  whose ID still shows the old address. Didit requires the bill's name to
  match the ID and the bill to be under 3 months old; no expected address
  is sent, so the new address never trips an address-mismatch check. The
  webhook reads the bill's address first. Both share the 90-day window.
- **Age:** verification is 18+ (both workflows decline a younger ID holder).
  Age matters only for verification; anyone can use the app unverified.

## Update - 2026-09-22: AI summaries, longer policies, deep-linked notifications

- **App Check enforcement re-verified** from outside the app: a REST read of
  the world-readable `config/app` doc with the web API key but no App Check
  token returns PERMISSION_DENIED, and an unattested call to `refreshClaim`
  returns 401. Firestore and every callable are enforced; nothing changed
  here, this is the periodic check.
- **`candidates/{uid}.aiSummary` and `platformNoteEs`**: operator copy
  written only by the Admin SDK (`scripts/set-platform-summaries.ts`). The
  candidate-update rule is unchanged (`onlyChanges(['bio', 'photoUrl',
  'websiteUrl'])`), so a candidate cannot edit their own summary or note.
  Every summary is generated from the same prompt and only from the
  policies as listed in the app (`scripts/data/platform-summary-prompt.md`);
  the stored `policiesHash` makes a stale summary detectable. Integrity
  risk is editorial, not technical: the operator is also a candidate, so
  the prompt forbids praise, ranking, and any per-candidate variation, and
  the data file is in the repo for anyone to diff.
- **Policy body cap 8,000 -> 20,000 chars**, moved together in
  `firestore.rules` (candidate create/update), the parser (`MAX_BODY`), and
  the edit-policy field. Motivation: two campaign plans run 10,500 and
  12,600 chars and were being cut mid-sentence. The app collapses bodies
  over 5,000 behind Show more. Read cost per policy doc rises accordingly;
  still well under the 1 MiB document limit.
- **Notification deep links** now carry `?q=<questionId>` for the three AMA
  notifications. Links are written only by triggers, read by the client as
  a route param, and used solely to pick which already-public question card
  to scroll to; an unknown id simply scrolls nowhere.
- **Approvals gate re-enabled and DEPLOYED 2026-09-22** (`me().verified ==
  true && me().wardId != null`; verified live via the Rules API). It does
  not depend on the release: every build from 1.0.8 on already grays the
  buttons, and the store has served such a build since September. Closes the accepted interim exposure from 2026-09-07:
  unverified 1.0.7 users could cast approvals that the grade never counted.
  Cost accepted this time: a 1.0.7 user tapping Approve sees a raw
  permissions error until they update. Brian's call: the graded number has
  to be trustworthy, and 1.0.7 predates the update modal, so no in-app
  message can reach it.
- **Update dials**: `config/app.latestVersion` warns (snoozable),
  `config/app.minVersion` blocks (no Close, no snooze; only binaries built
  from this code onward honor it). `npm run release-status` prints both
  dials and whether the LIVE ruleset carries the approvals gate
  (comments stripped before matching, since the rule's own comment quotes
  it). The required card's text is `config/app.updateMessage` (admin-only,
  like the rest of the doc), with the binary's built-in copy as fallback.
- **Sign-out** now requires a confirmation and routes to the big board with
  the sign-in sheet; no change to the auth model.
- **Platform sync**: `cardenas4chicago.com`'s redesign silently archived 7 of
  9 policies for two weeks (the homepage stopped linking the pillar pages).
  The parser now also reads the site's `data/pillars.json` manifest. Lesson
  recorded in AGENTS.md: a sudden drop in a candidate's policy count is a
  parser problem to fix before anyone summarizes the platform.

## Update - 2026-09-07: question upvotes, weighted grading, election directories

- **Question upvotes** (`officials/{uid}/questions/{qid}/votes/{voterUid}`
  and `electionQuestions/{qid}/votes/{voterUid}`): presence-only ballots
  (uid, verified snapshot, pinned createdAt), one per person, create/delete
  own only; officials cannot join questions put to themselves. Counts are
  trigger-recounted from the subcollection (idempotent, no client write
  path). The verified snapshot must match the live profile at cast time,
  same as every other ballot.
- **Upvote-weighted answer grade**: `officials/{uid}.answerWeights` is
  trigger-only (recountAnswerWeights, full recount per event plus the
  nightly sweep as backfill/self-heal). Each question weighs
  1 + VERIFIED upvotes; only verified voices move the grade, matching the
  only-verified-decides verdict rule, so throwaway accounts can neither
  tank nor launder a grade by piling votes on questions. Displayed counts
  remain all-user.
- **Backward-compat rule pattern**: new pinned-to-zero fields on
  client-created docs (upvotes/upvotesVerified on questions) use
  `data.get(field, 0) == 0` so binaries shipped before the fields existed
  can still create the docs.
- **Approval ballots gated to verified residents** (same day): the 1.0.8+
  widget disables the buttons for unverified accounts and routes them to
  /verify, and the service refuses. The matching rules clause
  (`me().verified == true && me().wardId != null`) was deployed and then
  ROLLED BACK the same day: the 1.0.7 binary in the store shows live
  buttons to everyone, and a rules deny there surfaces as a raw permissions
  error. Accepted interim exposure: unverified users on 1.0.7 can still cast
  approvals, exactly as before. Re-enable the clause once 1.0.8 is the
  installed base. The graded constituent slice was always verified-only.
- **Headshots on election cards** (same day): `photoUrl` on
  electionCandidates and schoolBoardCandidates is an external https link
  rendered by the client and never stored, the same posture as officials'
  portraits; the seed validates https. Hosts are Wikimedia Commons, official
  office sites, campaign sites, and Ballotpedia; a dead link degrades to an
  initials avatar.
- **Upvote threshold alerts**: officials may set `upvoteAlertThreshold`
  (int 1..10000) on their own card - the only new client-writable field,
  validated in rules alongside bio/photoUrl. onQuestionUpvoteWrite sends at
  most one notification per question per threshold value (deduped by
  notification id), only while the question is unanswered.
- **Election directories** (`electionCandidates`, `electionRaceNotes`):
  public read, client writes denied; seeded only via Admin SDK
  (scripts/seed-election.ts) from sourced JSON, same contract as
  schoolBoardCandidates. `config/app` (update nudge) likewise
  world-readable, admin-write-only, and holds only the released version
  string and public store links.

## Update - 2026-09-01: election AMA, candidate directory, Wilson account

- **Election AMA** (`electionQuestions/{qid}` + `answers/{candidateUid}` +
  `votes/{voterUid}`): anyone signed in proposes a question to all
  candidates; only candidates (verified email, own uid) answer, exactly one
  answer each because the answer doc id IS the candidate uid and rules pin
  creation to it. `answerCount` and the answers' hidden `score` /
  `scoreVerified` (up minus down, placement-only, never displayed) are
  trigger-written (`onElectionAnswerWrite`, `onElectionAnswerVoteWrite`
  reusing the comment-rating trigger). Askers may withdraw only unanswered
  questions; answered ones are public record (rules-enforced, verified live).
  Questions are not editable after creation (no update path, deliberate).
  Hardened after a same-day adversarial pass: answer `createdAt`/`updatedAt`
  are pinned to `request.time` (a forged createdAt would game the ranking
  tie-break; an omitted one would hide the answer from the ordered query
  while still counting it); answer creation requires the parent question to
  exist (no orphans); **answers are not deletable by the candidate** (only
  revisable, admin takedowns aside) because delete-and-repost would cascade
  the ratings away and shed downvotes; `answerCount` is maintained by
  recount rather than delta so out-of-order trigger delivery cannot strand
  it; and placement ranks by `scoreVerified` first (all-voters score only
  breaks ties), so sybil accounts cannot reorder campaigns once verified
  voters weigh in.
  Accepted limitations, consistent with the rest of the app: no rate limit
  on question creation (same posture as concerns, see rate-limiting note
  below); a hostile client can write a vote doc under a nonexistent answer
  path, which bumps only their own stats counter and no visible number; an
  answer that lands in the instant between the asker's withdraw check and
  the delete commit is cascaded away with the question.
- **Declared-candidates directory**: `candidates/other-declared-candidates`
  (`directory: true`, no auth account) holds operator-written profiles of
  declared candidates without platforms as read-only pseudo-policies; the
  app hides comments/votes/report UI for it. A hostile client could still
  write comments on those policy docs via the generic policy-comment rules;
  they render nowhere (comment UI hidden and counts not shown) - accepted.
- **Willie Wilson**: provisioned with `add-candidate --no-email` because the
  campaign publishes no email - an email-less auth account nobody can claim
  until an operator attaches an address; the amber platformNote says so
  publicly.

## Update - 2026-08-29: concern references and comment sources

Concerns carry an author-supplied `references` list of https links, cited
inline with `*N` markers. Comments (concern and policy) carry the same
`references` list as "sources": bodies render the same tappable `*N`
citations, and a source/sources button opens the full link modal. Accepted limitation: security rules cannot iterate
list elements, so the rules only pin `references` to a list of at most 10
entries; per-element validation (https-only, length cap, no interior blanks)
lives in the client writer. Because a hostile client could therefore store
arbitrary element values, every renderer re-filters to `https://`-prefixed
strings before displaying or opening a reference
(`safeReferences` in `src/components/references.tsx`) - a non-conforming
element renders as nothing and can never reach `openLink`. Links open in the
in-app browser; no fetching, unfurling, or storage of the linked content.

## Update - 2026-08-17: comment ratings (placement-only)

Signed-in users rate comments up/down: one ballot per person at
`.../comments/{id}/votes/{voterUid}` (own-doc writes, verified snapshot,
value pinned to up/down), folded by `onCommentVoteWrite` /
`onPolicyCommentVoteWrite` into hidden `score`/`scoreVerified` fields on the
comment. Scores are never displayed - they exist only to order the "best"
sort (newest / oldest / best; there is deliberately no worst-first sort, and
thread-internal conversation order never changes). No client write path
touches the scores; comment deletion cascades to its ballots and the vote
triggers settle voters' stats even when the comment is already gone.

## Update - 2026-08-15: threaded comments and writing credits

Comments (concerns and policies) gained threaded replies: optional
`threadId`/`replyToName` on the comment doc, validated shape-only in rules - a
forged threadId renders as an orphaned thread and cannot move any count, so no
per-create exists() reads are spent. No trigger changes: commentCount already
counts every doc in the subcollection, and grouping is client-side. Thread
order stays neutral (newest first) so a candidate's attention cannot decide
which comments are seen; their replies lead only within their own thread.

Writing credits: a candidate may set `credited`/`creditedAt` on comments under
their own policies (rules: candidate only, never on their own comments,
`onlyChanges` pins everything else). It is recognition only - the author's
lifetime `stats.credits` is written exclusively by the
`onPolicyCommentCredited` trigger, which derives deltas from the flag's
transitions (including deletes of credited comments) and namespaces its
exactly-once markers to coexist with the comment-count triggers on the same
path.

## Update - 2026-08-13: candidates and the more perfect platform

New role `candidate` plus a public platform feature (candidates/{uid} with a
policies subcollection; each policy has a support/oppose dual tally, a votes
subcollection, and a comments section). Trust model extensions:

- **Role provisioning stays Admin-SDK-only.** Self-registration still pins
  `role == 'citizen'`; `scripts/add-candidate.ts` is the only path that mints
  a candidate, exactly like officials. `deleteAccount` refuses candidate
  accounts so a public platform can't self-erase.
- **Aggregates stay trigger-only.** Policy tallies, commentCount, and the
  candidate's policyCount are written exclusively by `onPolicyVoteWrite`,
  `onPolicyCommentCreated/Deleted`, and `onPolicyWrite` (which also cascades
  a deleted policy to its votes and comments). Rules pin creates to zeroed
  aggregates and `onlyChanges` on every update path.
- **Platform sync trusts only an operator-provisioned URL.** A candidate's
  `sourceUrl` is written by the provisioning script, never by clients, so the
  sync function (`syncPlatforms` nightly + `syncMyPlatform` callable, caller's
  own doc only) fetches only URLs the operator approved. Synced policies
  (`source: 'site'`) are not client-editable - the rules reject updates - so
  the campaign site remains the single source of truth. The parser throws on
  an unrecognized page layout instead of returning an empty platform, so a
  site redesign fails the sync loudly rather than archiving every policy;
  policies that legitimately leave the site are archived, never deleted,
  preserving their votes and comments. A slug collision with an in-app policy
  is skipped, so the site can never overwrite a policy it doesn't own.
- **Ballot integrity matches the rest of the app.** Policy ballots snapshot
  `verified`/`wardId` at cast time; the trigger sanitizes values to the two
  stances and removes the old ballot under its stored slices before adding
  the new. Candidate platforms are citywide, so the verified slice counts
  every verified Chicagoan.
- **Moderation covers the new surfaces.** `pathMatchesType` accepts policy
  and policy-comment paths, `contentType: 'policy'` is validated, and the
  admin takedown route resolves candidate paths. The existing
  collection-group sweep in `deleteAccount` re-attributes policy comments
  because they reuse the `comments` subcollection name.
- **Accepted limitation:** the scraped site content is rendered as plain text
  (tags stripped, entities decoded); links are extracted into a receipts list
  and opened via the system browser only when https. A candidate can publish
  whatever text they like on their own platform page - same as their bio -
  so this is reputational surface, not an integrity one. Candidates widen
  poll creation (`isOfficial() || isCandidate()`), with identical pinned
  create rules.

## Update - 2026-08-11: monthly verification cost cap

Didit bills per module that runs in a session, whether the verdict is Approved
or Declined; past the 500/month free tier that bills the operator directly,
which made `createVerificationSession` a denial-of-wallet surface. It now
reserves a slot in `verificationUsage/{YYYY-MM}` (Chicago time) in a
transaction before calling Didit and hard-stops at 700 reservations/month with
a `resource-exhausted` error. Because a session whose link is never opened
bills nothing, the webhook settles each session exactly once (idempotent via
`verificationSessions/{sessionId}`): Expired returns its slot, while Approved,
Declined, and Abandoned keep theirs (Abandoned can still bill for the modules
that ran before the user quit). Failed Didit calls release their slot
immediately. No security rule matches either collection, so clients can
neither read nor reset the counters. The per-month docs are kept forever so a
future paid tier can bill users starting at check 501.

## Audit - 2026-08-03 (two-phase: full workflow pass, then adversarial pass)

Phase 1 walked every user journey end to end (signed-out, unverified citizen,
verified resident, official, operator), tracing screen -> service -> rules ->
trigger -> aggregate. Phase 2 re-attacked the same code as a hostile client and
re-reviewed Phase 1's own fixes for regressions.

### Trust & integrity findings (fixed)

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | **Admin power was granted by email string alone.** `isAdmin()` matched `request.auth.token.email` with no `email_verified` check. Firebase lets anyone self-register an email/password account under any address without proving they own it, so if the operator address were ever unregistered in a project, the first attacker to claim it would inherit the report queue (who reported whom) plus takedown-delete on every concern, comment, and AMA thread | **Critical** | `isAdmin()` now requires `request.auth.token.email_verified == true`. The UI gate mirrors it via `isAdminUser()` in `src/lib/admin.ts`, and the seed marks the operator account verified so the emulator flow still works |
| 2 | **Self-registration accepted extra profile fields.** The create rule validated the known keys but allowed unknown ones, so a client could register carrying a forged `personaAccountId`. `deleteAccount` trusts that field to release the Persona identity-dedup claim, so a forged value would free *another* person's claim - defeating one-human-one-verified-account | **High** | Profile create pins its key set (and the `stats` key set) with `hasOnly` |
| 3 | **Report `contentPath` was unvalidated against `contentType`.** A report could display one document's excerpt while pointing the operator's takedown delete at a different, innocent document - a lie to the moderator that the moderator's own tooling would execute | **High** | Rules require the path to have the shape its type claims; `excerpt` is type- and size-checked |
| 4 | **Participation stats only ever counted up.** `stats.votes` and `stats.judgments` incremented on cast but never decremented on retraction, so cast -> retract -> recast farmed the civic record and its milestone celebrations indefinitely | Medium | `onConcernVoteWrite`, `onPollVoteWrite`, and `onJudgmentWrite` now decrement on deletion, matching the comment counters |
| 5 | **Client-supplied `createdAt` on every content type.** Feeds order by it, so a backdated or future-dated timestamp let a post pin itself to the top (or bottom) of the big board, ward boards, comments, AMA threads, and the operator's report queue. `respondedAt` was likewise forgeable, letting an official make a late response look prompt | Medium | `createdAt` is pinned to `request.time` on concerns, comments, polls, questions, and reports; `respondedAt` likewise on responses |
| 6 | **Closed polls could still be rewritten.** Ballot retraction was allowed at any time, so after a poll closed and its result was published, voters could keep deleting ballots and quietly change the recorded outcome | Medium | Poll ballot deletion now requires the poll to still be open. Copy in the README and the in-app privacy screen updated to say ballots are final once voting closes |
| 7 | **Type confusion on public documents.** `concern.body` and `poll.options` were size-checked but never type-checked, and `size()` works on lists and strings alike - so `options` could be a bare string that passes validation and then crashes every feed that maps over it, and `body` could be a list. `poll.type` and `detail` were unvalidated | Medium | `body is string`, `options is list`, `detail` typed and capped, `type` restricted to the four known formats |
| 8 | **Unbounded extra fields on world-readable documents.** Every client-written collection accepted arbitrary additional keys, so any account could pad public docs with junk that every reader then pays to download | Low | `hasOnly` key pinning on concerns, comments, polls, questions, reports, and all three ballot types |
| 9 | Persona webhook crashed (HTTP 500) when a verified inquiry arrived for an account deleted in the meantime, so Persona retried the same doomed delivery on a schedule | Low | Missing user is logged and answered 200 |

### Workflow gaps (fixed)

- **Approval polls lost your ballot when changing a vote**: the pending
  selection started empty rather than from the ballot on record, so tapping
  "Update votes" after changing one option silently discarded the rest.
- **Unblock failures were silent**: the only fire-and-forget promise left in
  the app; it now surfaces through `notify()` like every other error path.
- **Docs contradicted the code**: README, AGENTS.md, and several code comments
  still described a third "registered voter" lens and a `registered_voter`
  Persona output field, both of which were deliberately removed from the data
  model. All scrubbed to the real two-lens (all / verified) design.

### Verification performed

- `npm run typecheck` clean; the `functions` package compiles clean;
  `npx expo lint` reports zero problems.
- **Transaction read/write ordering was verified statically.** Firestore
  rejects a transaction that reads after it writes, and the exactly-once work
  above added a read (the event marker) and often a second (the author's
  profile) to every counter trigger. A script walks each `runTransaction`
  block and asserts no read follows a write; it caught one genuinely fragile
  spot in `onJudgmentWrite`, where the reads were only safe because two
  branches happened to be mutually exclusive. That block was restructured so
  all reads precede all writes on every path.
- **`firestore.rules` compiles**, checked against a running Firestore
  emulator (`PUT /emulator/v1/projects/{id}:securityRules`). The check was
  itself checked: the same endpoint rejects a deliberately broken copy of the
  file with a line number, so a 200 means something.
- **The high-severity fixes were tested behaviorally**, not just read. Ten
  requests were issued against the emulator with forged auth tokens carrying
  chosen claims, and all ten behaved as intended:

  | Attempt | Expected | Result |
  | --- | --- | --- |
  | Read the report queue as the operator address with `email_verified: false` | denied | denied |
  | Read it with `email_verified: true` | allowed | allowed |
  | Read it as an unrelated verified account | denied | denied |
  | Register a profile (server-set `createdAt`) | allowed | allowed |
  | Register a profile carrying a forged `personaAccountId` | denied | denied |
  | Register a profile with a client-chosen `createdAt` | denied | denied |
  | Register a profile claiming `verified: true` | denied | denied |
  | File a comment report pointing at a comment | allowed | allowed |
  | File a comment report aimed at a whole concern | denied | denied |
  | File a question report aimed at a user profile | denied | denied |

  Test documents were removed afterward. Homebrew's `openjdk` is keg-only, so
  the Firestore emulator needs it on `PATH` or `/usr/bin/java` reports no
  runtime; `npm run emulators` now prepends `$(brew --prefix openjdk)/bin`
  itself, so it works without touching the shell profile.

### Shipped to production - 2026-08-03

Everything above is deployed, not just committed:

- `firebase deploy --only firestore:rules,firestore:indexes,functions`
  released the rules and updated all 15 functions.
- The **live** ruleset was read back from the Firebase Rules API
  (ruleset `84306d3e`, released 19:39 UTC) and confirmed to contain the
  `email_verified` admin gate, the profile key pinning, the report-path
  validation, the server-pinned `createdAt`, and the closed-poll ballot
  freeze. The fixes are in force, not merely uploaded.
- The `processedEvents/expiresAt` TTL policy is `ACTIVE`, so the
  exactly-once markers sweep themselves.
- The operator account was checked before the rules deploy:
  bricarlis@gmail.com is `emailVerified: true` via `google.com`, so the
  tightened `isAdmin()` did not lock the operator out.

The deploy also surfaced two composite indexes that existed in the project but
not in `firestore.indexes.json`, both on `concerns.scoreRegistered`
(`scope + scoreRegistered + createdAt`, and the ward-scoped variant). They
were orphans from the registered-voter lens that was removed from the data
model: `scoreRegistered`, `registeredVoter`, and `totalRegistered` appear
nowhere in `src/`, `functions/src/`, `scripts/`, or the rules, so no query
could use them and no trigger could maintain them. Both were deleted, and
production now matches `firestore.indexes.json` exactly - nine indexes on
each side, no drift in either direction.

### Durability work (same pass)

Three items were first written up as accepted limitations and then fixed
rather than accepted:

| # | Was | Now |
| --- | --- | --- |
| 10 | **Trigger redelivery double-counted.** Firestore delivers trigger events at least once, and every counter applied a before/after delta rather than recomputing - so a retried delivery silently inflated a tally, a comment count, or an official's AMA record, with nothing to detect it afterward | Every counter mutation now claims its event id (`processedEvents/{eventId}`) inside the same transaction that writes the delta, so a delta lands exactly once however many times the event is delivered. The remaining `FieldValue.increment` calls are gone; there are zero non-idempotent counter writes left in `functions/src/index.ts` |
| 11 | **Counters had no floor.** Decrements used `FieldValue.increment`, which cannot clamp, so any drift or repair that removed a document without its creation event could drive a public counter below zero | Every counter is read and written as a clamped value (`step()` / `writeStat()`), so nothing displays a negative concern, comment, vote, judgment, or AMA count |
| 12 | **`.env` was neither ignored nor committed.** Only `.env*.local` was listed, so the file sat untracked - which also meant EAS, which builds from the git archive, never saw `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and native Google sign-in would fail in real builds | `.gitignore` now states the policy explicitly and ignores `.env.local`, `.env.*.local`, and `.env*.secret`. **`.env` itself must be `git add`ed** - it holds public identifiers only, and EAS needs it |

Two consequences of the exactly-once work to know about:

- **A TTL policy must be enabled on `processedEvents`, or it grows forever.**
  One marker document is written per trigger event. No security rule matches
  that path, so clients can never read or write markers, but nothing expires
  them without:

  ```
  gcloud firestore fields ttls update expiresAt \
    --collection-group=processedEvents --enable-ttl
  ```

- **Each counter event now costs one extra read and one extra write.** That is
  the price of correctness here; recomputing tallies from the ballot documents
  instead would cost one read per existing ballot per vote, which is far worse
  as a concern gets popular.

## Update - 2026-08-02

- **Open ward browsing**: every ward's board and ballot is now publicly
  viewable (tab renamed "wards"; residents land on their home ward, everyone
  else gets a picker). Verification decides where you can *vote* and where
  your ballots count as verified - never what you can *see*. Home-only
  actions (raise a ward concern, put a question to the ward) stay gated.
- **Passwordless email-link sign-in**: send + completion wired for web
  (verified end-to-end against the emulator); native completion code is in
  place but requires a Hosting link domain + universal links/app links
  before it works outside the web app.
- **iOS Firebase config**: real `GoogleService-Info.plist` placed; Google
  sign-in iOS URL scheme configured in app.json.

## Audit - 2026-07-31 (adversarial re-audit)

### Trust & integrity findings (fixed)

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | **Poll ballot stuffing**: rules never validated a poll ballot's `value`, and the tally code counted array elements individually - `value: ['yes','yes',…]` moved a displayed count by thousands from one account. The 2026-07-30 audit's claim that "bogus keys can't inflate any displayed number" was **false** for duplicated *valid* keys | **Critical** | Rules cap `value` to a string or a list of ≤12; `onPollVoteWrite` is now the integrity gate - it dedupes, drops keys not in the poll's option list, and allows multiple keys only on approval polls. A ballot with nothing valid left counts nowhere, not even toward totals |
| 2 | **Forged tallies at creation**: concern/poll create rules pinned only `tallies.totalAll` and the scores - a client could create content born with fabricated `verified`/`registered` counts that the lenses displayed as real | **High** | New `emptyTally()` rules helper pins all three totals and all three count maps to zero on create (concerns, polls); `answeredYesVerified`/`answeredNoVerified` likewise pinned on questions |
| 3 | **Ward tallies weren't ward-scoped**: any user, from any ward, voted on ward concerns, and the verified slice counted verified users of *other* wards - the ward leaderboard's "as voted by people in the ward" was untrue | **High** | Product rule: the verified/registered slices always mean "verified for the item's area". Concern ballots snapshot the voter's `wardId` (rules-validated against the profile); `onConcernVoteWrite` counts a ballot in the verified/registered slices of a ward concern only when the ballot's ward matches. Copy updated to say exactly what each number is. (Ward polls already restricted voting to verified ward residents, so their slices were already area-true) |
| 4 | **Registered lens was cosmetic on the board**: no `scoreRegistered` existed, so the registered lens ranked by the *verified* score while displaying the *all-users* score | Medium | `scoreRegistered` is now computed by the trigger, indexed, ranked, and displayed lens-consistently |
| 5 | **Judgments had no verified lens** - the answer axis (half of an official's grade) was the only surface with no verified slice, making it the cheapest to sockpuppet | Medium | Judgment docs snapshot `verified` (rules-validated); `onJudgmentWrite` maintains `answeredYesVerified`/`answeredNoVerified`; the UI shows both counts. Status flips still use all-user counts - revisit whether quorum should require verified judgments |
| 6 | Persona webhook treated any `status` check loosely and accepted replayed signatures | Medium | Only `completed`/`approved` inquiries mint `verified: true` (failed/declined/expired/needs_review never do); signatures older than 5 minutes are rejected. **Before launch: confirm the inquiry template's decisioning setup matches** |
| 7 | City-scoped concerns/polls could carry a spoofed `wardId` (fake ward chip); ward-scoped polls could be created with `wardId: null` (invisible to every feed) | Low | Rules force `wardId == null` on city scope and non-null-matching ward on ward scope |
| 8 | An official's AMA response had no length cap; a poll's `open` flag wasn't type-checked | Low | Response capped at 5000 chars; `open` must be bool |

### Product gaps (fixed)

- **Citywide officials couldn't create polls at all** - the only route to the
  new-poll screen was the ward tab, which requires a ward. Officials now also
  launch polls from their own AMA page, and the scope defaults to `city` for
  ward-less officials (it silently produced an invisible ward/null poll before).
- **Polls could never close** - `closePoll` existed with no UI. The author now
  sees a "Close voting" button on their own poll cards.
- **No password reset** - added to the sign-in screen.
- **Vote retraction was inconsistent** - approvals could be withdrawn but
  concern/poll ballots couldn't; rules now allow deleting your own ballot
  (triggers already handled removal).
- Concern/poll vote docs and judgment docs written before this audit lack the
  new snapshot fields (`wardId`, `verified`) and concerns lack
  `scoreRegistered`; emulator data should be re-seeded, and any live data
  backfilled before these lenses are trusted.

### User-safety & account features (added in the same pass)

- **Content reporting** (App Store 1.2): every concern, comment, question, and
  official response carries a flag → reason → report flow. Reports land in a
  write-only `reports` collection (clients can never read them); the operator
  reviews with the Admin SDK.
- **User blocking** (App Store 1.2): blocking hides a user's concerns,
  comments, and questions on the blocking account (personal filter, not a
  takedown), with an unblock list on the profile. Blocks live at
  `users/{uid}/blocks/{blockedUid}`, readable/writable only by the owner.
- **Account deletion** (App Store 5.1.1(v)): a `deleteAccount` callable removes
  the auth user, profile (identity/ward/stats), block list, and retracts the
  user's standing approvals (tallies walk back via the trigger). Pseudonymous
  content and cast ballots remain. Officials must be off-boarded by the
  operator - their public record isn't self-erasable.
- **Own-content control**: authors can edit a concern *only before anyone
  votes or comments* (editing voted-on text would change what votes meant),
  withdraw a concern (trigger cascades to its ballots/comments), delete their
  comments (counts stay honest), and withdraw *unanswered* questions -
  answered/dodged questions are part of the official's record and cannot be
  deleted (rules enforce all of this).
- **My activity**: a profile-linked screen listing the user's concerns and AMA
  questions (new indexes + a public collection-group read on questions).
- **Privacy & data screen**: in-app plain-language policy matching actual
  behavior. The store listing still needs it hosted at a public URL.

### Operator tooling, identity dedup, quorum & SSO (follow-up pass, same day)

- **Admin console**: rules-level `isAdmin()` (operator email) grants read/
  lifecycle on `reports` and takedown deletes on concerns, comments, and
  questions. The in-app queue (profile → "Review reports") views content in
  context, removes it, or dismisses the report. Non-admins are denied at the
  rules layer (verified by test); admin cannot alter report contents, only
  `status`. `onQuestionDeleted` now rebalances asked/responded/answered/dodged
  and sweeps judgments so an admin takedown of an answered thread leaves every
  report card consistent (verified by test).
- **Verified-only verdicts**: a question's answered/dodged flip counts ONLY
  verified judgments. The quorum was later removed by product decision
  (2026-08-20): a response counts as answered immediately and flips to dodged
  whenever verified dodge votes outnumber verified answered votes, live from
  the first judgment. Unverified judgments remain visible alongside but never
  decide. Accepted risk: a single verified account can flip a verdict until
  outvoted by other verified users.
- **One human, one verified account**: the Persona webhook maps the inquiry's
  Persona account id to the uid in `personaAccounts/{accountId}` (deny-by-
  default collection) and refuses to verify an identity that already verified
  a different account. Account deletion releases the claim. Requires account
  deduplication enabled on the Persona template.
- **SSO**: Google and Apple sign-in (web popup; native via
  @react-native-google-signin and expo-apple-authentication). All sign-in
  methods converge on one listener-driven profile-creation path governed by
  the same self-registration rules.
- **App Check**: web reCAPTCHA v3 attestation wired behind
  `EXPO_PUBLIC_RECAPTCHA_V3_SITE_KEY`; native attestation and console
  enforcement documented in the README as launch prerequisites.
  Firestore enforcement was ON from 2026-08-03 to 2026-09-01, then flipped
  back to UNENFORCED: the Android (Play closed testing) build's Play
  Integrity attestation produced invalid tokens, so enforcement locked every
  Android client out of Firestore (auth succeeded - identitytoolkit is
  unenforced - while the profile listener was denied, leaving authed users
  looking signed out). ROOT CAUSE (found 2026-09-02): the Play App Signing
  key had been rotated, and the PREVIOUS signing key's SHA-256 was never
  registered on the Firebase Android app - Play-installed builds signed by
  it decoded fine but failed App Check's certificate-digest match. Fixed by
  registering the previous key's SHA-256 and SHA-1 (all three keys - upload,
  current, previous - now registered under both hash types); Android then
  attested VALID and Firestore enforcement was re-ENFORCED 2026-09-02.
  Lesson for the next key event: App Check matches SHA-256, Google Sign-In
  matches SHA-1 - register BOTH for every signing key, from Play Console ->
  Protected with Play -> App signing.

### Known limitations (updated)

1. **Rate limiting** still depends on App Check enforcement being flipped on
   in the console after native attestation is wired - see README.
2. **One person ≠ one account** for unverified users (by design - that's what
   verification is for). Verified dedup now enforced via Persona account ids.
3. **Admin is a single hard-coded email** in rules + `src/lib/admin.ts`; move
   to custom claims when a second operator exists.

## Audit - 2026-07-30

### Trust & integrity findings (fixed)

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | Vote tallies were aggregated in client transactions; a hostile client could inflate totals | **Critical** | All aggregation moved to Cloud Functions triggers; rules now grant clients zero write paths to any tally, score, counter, or status |
| 2 | `authorName` on concerns/comments/questions was client-supplied and unchecked - users could post under any name | **High** | Rules require `authorName == users/{uid}.displayName` at create time |
| 3 | Judgments could be filed against questions with no response yet, pre-loading the answered/dodged count | Medium | Rules now require the question's `response != null` |
| 4 | User self-registration didn't validate display-name length or initial stats | Medium | Create rules validate name 3–30 chars and all-zero stats |
| 5 | Poll creation accepted unbounded question length and option counts | Low | Rules cap question at 280 chars, options at 2–12 |
| 6 | Officials could edit their own `name`/`title` (could quietly change office claims) | Low | Self-edit narrowed to `bio` + `photoUrl` only; name/title are admin-provisioned |
| 7 | `Alert.alert` is a silent no-op on web - errors (including permission denials) vanished | Medium | Cross-platform `notify()`; every error path now surfaces on all platforms |
| 8 | `router.back()` crashed when a modal was opened via deep link with no history | Low | `canGoBack()` guards with sensible fallbacks |

### Privacy posture (verified, unchanged)

- Identity documents never touch our servers: Persona performs verification;
  the webhook stores only `verified`, `wardId`, `registeredVoter`.
- Official portraits are **links** to externally hosted images - we render,
  never store.
- User profiles are readable only by their owner; public-facing fields are
  denormalized snapshots.
- Ballots and judgments are readable only by the person who cast them.

### Grading-system integrity

- Approval ballots snapshot the voter's `verified` / `registeredVoter` /
  `wardId` at cast time, validated by rules against the live profile.
- The graded approval number counts **constituents only** (verified residents
  of the official's ward; citywide offices count all verified residents), with
  a 5-ballot minimum before an axis grades - one grumpy neighbor can't hand
  out an F.
- Officials cannot rate themselves or judge their own responses (rules).
- The answer score is community-judged with no quorum (verified majority,
  live; answered until dodges lead); status flips and every counter move only
  in `onJudgmentWrite`.

### Known limitations (accepted for now, revisit before scale)

1. **No rate limiting** on posts/comments/questions. Firestore rules can't
   express "N per hour" well; add an App Check + Cloud Functions write path or
   rules-based cooldown timestamps before public launch.
2. **Poll ballots aren't validated against the option list in rules** (rules
   can't cheaply introspect arrays). Bogus keys can't inflate any displayed
   number (the UI renders known options only) but do count toward totals;
   validate in a trigger if it becomes a problem.
3. **One approval account = one ballot, but one person ≠ one account** for
   unverified users. This is exactly why the graded number is
   constituents-only and every surface shows the verified lens.
4. **Ward assignment** from the verified address: done 2026-09-24 (see that
   update).
5. **Officials are provisioned manually** by the operator via Admin SDK - an
   intentional control, documented so it isn't mistaken for an oversight.

### UX audit (fixed in the same pass)

- Voting from the big board needed 2 taps + navigation → priority pills are
  now on every board card (one tap).
- "Sign in to vote" dead-end text → live buttons into the sign-in modal.
- Blank screens while queries warmed up → skeleton placeholders.
- No feedback moments → milestone celebrations (server-counted, replay-proof).
- Cold visual hierarchy → Chicago-flag accents, portraits, grade badges,
  entrance/press animations.

## Update - 2026-08-23: imported platforms and policy takeover

Real mayoral campaigns are now imported from their own websites, which changes
two things in the trust model:

- **Synced policies gained exactly one client write path: takeover.** The
  owning candidate may update a `source: 'site'` policy, and the rules force
  the written `source` to `'app'` in the same update - so the only possible
  transition is site -> app, one way, by the owner. After takeover the sync
  function skips the doc (it already refused to touch non-site ids), so the
  campaign site can never overwrite what the candidate wrote in-app. Tallies
  and counters remain trigger-only. Until takeover, imported policies are
  publicly labeled "Imported from <host>" with a link to the source page, so
  nobody mistakes an operator import for the candidate's own in-app words.
- **Placeholder candidate accounts.** `add-candidate --create` provisions a
  candidate who never signed up: a passwordless Auth user keyed to the
  campaign's published contact address (from their own website), plus a
  `users/{uid}` profile (`verified: false`). Nobody can sign into the account
  without controlling that inbox (password reset is the claim path), which is
  the same trust anchor as the sourceUrl itself. The operator remains the
  only path that mints candidates.
- The platform parser now recognizes three page layouts (grouped lists,
  Elementor popup cards, accordion cards). It still throws on an unrecognized
  layout so a redesign fails the sync loudly instead of archiving a platform.

## Update - 2026-08-24: claim gating and notifications

- **Every act-as-politician write now requires a verified email.** Rules gate
  official/candidate card edits, AMA responses, poll creation, policy
  writes, and writing credits on `request.auth.token.email_verified`. All
  legitimate claim paths for the placeholder accounts (password reset, magic
  link, SSO) verify the address by construction, so an email/password
  sign-in that never proved inbox control can read but do nothing. Operator
  scripts (`verify-user`) mark their accounts verified explicitly.
- **`claimed` is server-derived, never client-written.** `refreshClaim`
  (callable, self only) and the nightly `sweepClaims` set it from whether
  the auth account has any provider attached - which for a placeholder can
  only happen via a claim path. It drives the public "on the platform"
  status and holds unanswered questions as pending (not ignored) until a
  real person is behind the account.
- **Notifications are a one-way, trigger-only surface.** Docs under
  `users/{uid}/notifications` are created exclusively by Cloud Functions
  (deny-by-default create in rules), so nobody can forge a notification into
  another user's inbox; owners can only read, flip `read`, and delete.
  Notification doc ids derive from trigger event ids, so redelivered events
  overwrite rather than duplicate.
