# direct democracy — audit log

A running record of audits performed on this codebase. This platform asks for
the public's trust, so it gets treated like infrastructure: every aggregate
number a voter sees must be tamper-resistant, every identity claim must be
honest, and every failure must be visible.

## Audit — 2026-07-30

### Trust & integrity findings (fixed)

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | Vote tallies were aggregated in client transactions; a hostile client could inflate totals | **Critical** | All aggregation moved to Cloud Functions triggers; rules now grant clients zero write paths to any tally, score, counter, or status |
| 2 | `authorName` on concerns/comments/questions was client-supplied and unchecked — users could post under any name | **High** | Rules require `authorName == users/{uid}.displayName` at create time |
| 3 | Judgments could be filed against questions with no response yet, pre-loading the answered/dodged count | Medium | Rules now require the question's `response != null` |
| 4 | User self-registration didn't validate display-name length or initial stats | Medium | Create rules validate name 3–30 chars and all-zero stats |
| 5 | Poll creation accepted unbounded question length and option counts | Low | Rules cap question at 280 chars, options at 2–12 |
| 6 | Officials could edit their own `name`/`title` (could quietly change office claims) | Low | Self-edit narrowed to `bio` + `photoUrl` only; name/title are admin-provisioned |
| 7 | `Alert.alert` is a silent no-op on web — errors (including permission denials) vanished | Medium | Cross-platform `notify()`; every error path now surfaces on all platforms |
| 8 | `router.back()` crashed when a modal was opened via deep link with no history | Low | `canGoBack()` guards with sensible fallbacks |

### Privacy posture (verified, unchanged)

- Identity documents never touch our servers: Persona performs verification;
  the webhook stores only `verified`, `wardId`, `registeredVoter`.
- Official portraits are **links** to externally hosted images — we render,
  never store.
- User profiles are readable only by their owner; public-facing fields are
  denormalized snapshots.
- Ballots and judgments are readable only by the person who cast them.

### Grading-system integrity

- Approval ballots snapshot the voter's `verified` / `registeredVoter` /
  `wardId` at cast time, validated by rules against the live profile.
- The graded approval number counts **constituents only** (verified residents
  of the official's ward; citywide offices count all verified residents), with
  a 5-ballot minimum before an axis grades — one grumpy neighbor can't hand
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
5. **Officials are provisioned manually** by the operator via Admin SDK — an
   intentional control, documented so it isn't mistaken for an oversight.

### UX audit (fixed in the same pass)

- Voting from the big board needed 2 taps + navigation → priority pills are
  now on every board card (one tap).
- "Sign in to vote" dead-end text → live buttons into the sign-in modal.
- Blank screens while queries warmed up → skeleton placeholders.
- No feedback moments → milestone celebrations (server-counted, replay-proof).
- Cold visual hierarchy → Chicago-flag accents, portraits, grade badges,
  entrance/press animations.
