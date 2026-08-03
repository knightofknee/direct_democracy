# direct democracy - audit log

A running record of audits performed on this codebase. This platform asks for
the public's trust, so it gets treated like infrastructure: every aggregate
number a voter sees must be tamper-resistant, every identity claim must be
honest, and every failure must be visible.

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

The deploy reported two indexes existing in the project that aren't in
`firestore.indexes.json`. They were left in place - `--force` would have
deleted them, and deleting an index that a live query depends on breaks that
query. Worth reconciling in the console when convenient.

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
- **Verified-only verdicts**: a question's answered/dodged flip now counts
  ONLY verified judgments (quorum 5). Verified by test: five unverified
  judgments left a question underReview; five verified ones decided it.
  Unverified judgments remain visible alongside.
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
- The answer score is community-judged with a 5-judgment quorum; status flips
  and every counter move only in `onJudgmentWrite`.

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
4. **Ward assignment via Persona** still needs the address→ward lookup wired
   in the inquiry template (Chicago ward boundary dataset).
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
