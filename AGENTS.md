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
- Roles: `citizen` vs `official` on `users/{uid}`; `verified` and `wardId` are
  written only by the Admin SDK / Cloud Functions (Didit webhook), never by
  clients - security rules enforce this.
- Officials are graded on two axes in `src/services/officials.ts`: constituent
  approval (5-ballot minimum) and the community-judged answer score, averaged
  into an overall letter. Approval ballots live at
  `officials/{uid}/approvals/{voterUid}` and aggregate in `onApprovalWrite`.
- Official portraits are external https links (`photoUrl`) - never store or
  proxy the image.
- Personal stats on `users/{uid}.stats` are trigger-written and drive the
  milestone celebrations in `src/components/celebration.tsx` +
  `src/lib/milestones.ts`.
- Use `notify()` from `src/lib/notify.ts` for user-facing errors - RN's
  Alert is a silent no-op on web.
- Seed data must never depict real Chicago officials - fictional names only.
- Security posture and accepted limitations are documented in `docs/AUDIT.md`;
  update it when the trust model changes.
- Typecheck with `npm run typecheck` before finishing.
