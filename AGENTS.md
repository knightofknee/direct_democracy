# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# direct democracy — project notes

Chicago civic app: citywide "big board" of concerns, verified-only ward tab with
alderman polls, and AMAs where the community judges whether answers were real.
See README.md for the full product and setup story.

Conventions:

- App name is lowercase: "direct democracy". Tab titles are lowercase too.
- Expo SDK 57 + expo-router (screens in `src/app/`), TypeScript strict.
- Firebase JS SDK; `src/lib/firebase.ts` auto-connects to the Emulator Suite
  while the config placeholder starts with `demo-`. Run `npm run emulators`,
  `npm run seed`, then `npx expo start`.
- Every vote is tallied three ways (all / verified / registered) via the
  `DualTally` type; tally math lives in `src/lib/tally.ts` and is applied in
  Firestore transactions in `src/services/`. Keep new vote surfaces on this path.
- Vote docs snapshot the voter's `verified`/`registeredVoter` at cast time;
  changed votes must remove the old ballot under its stored slices first.
- Roles: `citizen` vs `official` on `users/{uid}`; `verified` and `wardId` are
  written only by the Admin SDK / Cloud Functions (Persona webhook), never by
  clients — security rules enforce this.
- Seed data must never depict real Chicago officials — fictional names only.
- Typecheck with `npm run typecheck` before finishing.
