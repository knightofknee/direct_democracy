# Launch checklist - remaining manual steps

Status as of 2026-08-02. Everything code-side is done unless a step says
otherwise; these are console/account tasks only the operator can do.
Contact/admin email everywhere: bricarlis@gmail.com.

---

## DONE (for the record)

- Bundle ID `com.briancarlisle.directdemocracy` registered via EAS; app being
  created in App Store Connect (SKU `direct-democracy-1`, exempt encryption).
- Google **web client ID** committed in `.env` as
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (public identifier - nothing to set on
  EAS servers; EAS builds read the committed .env).
- iOS `GoogleService-Info.plist` in repo root; Google sign-in iOS URL scheme
  in app.json.
- Privacy/terms/landing pages written in the waldgrave.com project
  (`~/Documents/GitHub/the-waldgave2/pages/directdemocracy/`) - deploy below.
- Branded splash (Chicago star on white) + fixed the stuck splash screen.

## 1. Deploy the waldgrave.com pages  ← unblocks the App Store listing

The pages exist locally; deploy the-waldgave2 to Heroku the same way as
always (from `~/Documents/GitHub/the-waldgave2`: commit, then `git push
heroku main` - or `git push heroku master`, whichever the remote uses).
After deploy, these URLs go into App Store Connect:

- Privacy Policy URL: `https://www.waldgrave.com/directdemocracy/privacy`
- (Optional) Marketing URL: `https://www.waldgrave.com/directdemocracy`
- Terms link exists at `/directdemocracy/terms` (Apple's standard EULA
  applies unless you point at this).

## 2. Firebase console - Authentication

console.firebase.google.com → project **direct-democracy-e338a** → Build →
**Authentication** → *Sign-in method* tab:

1. **Google** → Enable → support email bricarlis@gmail.com → Save.
2. **Apple** → Enable (needs step 4 below to fully work) → Save.
3. **Email/Password** → make sure it's enabled AND flip on the second toggle
   **"Email link (passwordless sign-in)"** → Save.
4. *Settings* tab → **Authorized domains** → confirm
   `direct-democracy-e338a.firebaseapp.com` is listed; add `waldgrave.com`
   if auth pages will ever be served from there.

## 3. Apple Sign-In backend wiring (SSO button errors until done)

Note: the App ID edit page has NO return-URL fields. Those live inside the
Services ID's "Sign In with Apple" Configure dialog. The Services ID is an
identifier you create and name yourself; ours is
`com.briancarlisle.directdemocracy.web`.

1. developer.apple.com → Identifiers → open the App ID
   `com.briancarlisle.directdemocracy` (EAS named it
   "knightofkneedirectdemocracy bacd..."; the name is cosmetic) → check
   **Sign In with Apple** in the Capabilities list → Save (top right).
2. Back to Identifiers → blue "+" → on "Register a new identifier" pick the
   **Services IDs** radio (page defaults to App IDs) → Continue →
   description `direct democracy web auth`, identifier
   `com.briancarlisle.directdemocracy.web` → Continue → Register.
3. In the Identifiers list, switch the top-right filter from "App IDs" to
   **Services IDs** → click the new one → check **Sign In with Apple** →
   click **Configure**:
   - Primary App ID: `com.briancarlisle.directdemocracy`
   - Domains and Subdomains: `direct-democracy-e338a.firebaseapp.com`
   - Return URLs: `https://direct-democracy-e338a.firebaseapp.com/__/auth/handler`
   - Next → Done → **Continue → Save** (the outer Save is easy to miss and
     it silently discards without it).
4. Sidebar → **Keys** → "+" → name `direct democracy apple signin` → check
   **Sign In with Apple** → Configure → primary App ID = the direct
   democracy one → Save → Continue → Register → **Download the .p8 now**
   (one-time download) and note the **Key ID**.
5. Firebase console → Authentication → Sign-in method → **Apple** → Enable →
   fill in the Services ID, Team ID `R3H7M2M4F5`, the Key ID, and paste the
   .p8 file contents → Save.

STATUS: done 2026-08-03. Actual values created: Services ID is
`direct-democracy-e338a.firebaseapp.com` (the domain string was used as the
identifier; unconventional but valid - use THIS as the Services ID anywhere
one is asked for), key "direct democracy sso", Key ID `V57352YU8Y`.

## 4. Email-link sign-in on NATIVE (code done 2026-08-03; works on web)

Code side is DONE: iOS universal links
(`applinks:direct-democracy-e338a.firebaseapp.com`) and Android App Links
intent filters are in app.json, and the app already completes sign-in links
it receives. If a custom link domain was configured instead of the default,
set `EXPO_PUBLIC_AUTH_LINK_DOMAIN=<that domain>` in `.env` and swap the
domain in app.json to match. When the app is not installed, links land on
`https://www.waldgrave.com/directdemocracy` (EXPO_PUBLIC_AUTH_CONTINUE_URL).

Remaining (operator):

1. Firebase console → Authentication → Settings → **Authorized domains** →
   add `waldgrave.com` (the continue URL must be on an authorized domain).
2. Firebase console → Project settings (gear icon) → the iOS app card →
   make sure **Team ID R3H7M2M4F5** and the **App Store ID** (once the
   listing exists) are filled in - Firebase uses these to serve the
   apple-app-site-association file that makes the links open the app.
3. Rebuild the app (`rm -rf ios && npx expo run:ios`, and any EAS build) so
   the Associated Domains entitlement lands in the provisioning profile.
4. Android (in progress 2026-08-03): package name
   `com.briancarlisle.directdemocracy`. Register it in Firebase, put
   google-services.json in the repo root (app.json already points at it).
   After the first `eas build -p android`, run `eas credentials -p android`,
   copy the SHA-1 AND SHA-256 fingerprints, and add both in Firebase console
   → Project settings → Your apps → Android app → "Add fingerprint".
   SHA-1 makes Google sign-in work on Android; SHA-256 makes App Links
   (email sign-in links) verify.

## 5. App Check (before public launch - this is the anti-bot layer)

What it is: every Firestore/Functions request must carry a token proving it
came from the real app (not a script using the public config). Without it,
anyone can hammer the API with fake accounts.

Where: console.firebase.google.com → project → Build (left sidebar, scroll
down) → **App Check**.

The client side is FULLY WIRED for all three platforms (web reCAPTCHA v3,
iOS App Attest, Android Play Integrity - the native providers run through
@react-native-firebase/app-check and bridge into the app's Firebase SDK).
Callable functions (deleteAccount, createVerificationSession) enforce App
Check IN CODE as of 2026-08-03 - the console toggle only covers Firestore.
Site key is in `.env` (added 2026-08-03).

Operator decision 2026-08-03: enforce immediately, skip the monitoring
period. Fine pre-launch. The steps below are NOT optional metric-watching;
they are what keeps your own devices working the moment you press Enforce.

1. **Apps** tab → register all three:
   - iOS app → Register → **App Attest** → Save.
   - Android app → Register → **Play Integrity** → Save.
   - Web app → Register → **reCAPTCHA v3** → paste the reCAPTCHA SECRET key
     (from google.com/recaptcha/admin, same key pair as the site key already
     in .env) → Save.
2. **Allowlist the dev debug token** (or your own phone stops working the
   second you enforce). The token is FIXED in the gitignored `.env.local`
   (EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN), so there is no log fishing - every
   dev build presents that one value. In Firebase console → App Check →
   **Apps** tab:
   - iOS app row → overflow menu (⋮) → **Manage debug tokens** → **Add
     debug token** → Name: `brians dev`, Value: the token from .env.local →
     Save.
   - Repeat the same on the Android app row (same value is fine).
   Never commit or share that token; anyone holding it can attest as the
   app. Emulator-suite local dev is unaffected (App Check skipped there).
3. Deploy the backend so the enforced callables go live:
   `firebase deploy --only functions`.
4. **APIs** tab → **Cloud Firestore** row → **Enforce** → confirm. (Cloud
   Functions has no console toggle for callables; step 3 already covers it.
   The Persona webhook stays open by design - Persona can't attest.)
5. Ship/keep using builds that contain the attestation code (anything built
   from the repo after 2026-08-03). Older builds can't attest and get locked
   out - irrelevant pre-launch, remember it post-launch.

## 6. Didit (identity verification - powers the "verified" system)

Switched from Persona to Didit 2026-08-03 (same job, ~4x cheaper past the
free tier). Both give 500 free verifications/month; after that Didit is
~$0.33/check vs Persona's ~$1.50. Code is fully wired: session creation,
webhook with signature + replay checks, one-document-one-account dedup
(identityClaims), claim release on account deletion.

What it is: Didit (didit.me) is a commercial identity-verification service
(scan a driver's license, optional selfie match). Users tap "Verify", do
Didit's hosted flow, and Didit webhooks the verdict back to our Cloud
Function. We never see documents. Until this is set up, nobody can become
"verified" in production; everything else still works.

1. Create an account at didit.me (Business Console).
2. Console -> create an ID-verification **workflow** (government ID;
   add selfie/face match if wanted). Copy its **workflow ID**.
3. Console -> Settings -> **API keys** -> copy the API key.
4. Console -> **Webhooks** -> set the URL to
   `https://us-central1-direct-democracy-e338a.cloudfunctions.net/diditWebhook` and copy the **webhook secret**.
5. Set the three secrets from YOUR terminal (each command prompts for the
   value; paste it there, not into chat, so it never lands in any log):
   ```
   npx firebase-tools functions:secrets:set DIDIT_API_KEY
   npx firebase-tools functions:secrets:set DIDIT_WORKFLOW_ID
   npx firebase-tools functions:secrets:set DIDIT_WEBHOOK_SECRET
   ```
   Then tell Claude - the functions now BIND these secrets (2026-08-03), so
   the next deploy fails unless all three exist first. Claude redeploys and
   the Verify button goes live.
6. Verify pricing at signup (didit.me/pricing): 500 free/month, then per
   check. If users ever pay a verification fee in-app, Apple requires IAP.

Ward assignment from the verified address (Chicago ward-boundary lookup) is
future work; until then production verification grants city-level verified
status with no home ward.

## 7. Deploy the backend - DONE 2026-08-03

Rules, indexes, and all 15 functions deployed to direct-democracy-e338a.
Re-run after any rules/functions change (Claude runs this).

```
firebase deploy --only firestore:rules,firestore:indexes,functions
```

Run from the repo root, logged into the Firebase CLI as bricarlis@gmail.com.
Re-run after any rules/functions change. (Functions on first deploy may ask
to enable APIs / upgrade to Blaze plan - required for Cloud Functions.)

STATUS: deployed 2026-08-03 (rules + indexes + all 15 functions updated).
The deploy flagged 2 project indexes missing from `firestore.indexes.json`;
both were dead `concerns.scoreRegistered` indexes left over from the removed
registered-voter lens, and both were deleted. Production and
`firestore.indexes.json` are now in sync at 9 indexes each - verify any time
with `gcloud firestore indexes composite list --project=direct-democracy-e338a`.
Persona webhook URL: `https://personawebhook-fol5cw3qya-uc.a.run.app`.

### 7a. Before that deploy: confirm the operator email is VERIFIED

STATUS: verified 2026-08-03 - the production account bricarlis@gmail.com has
`emailVerified: true` via the `google.com` provider, so the tightened
`isAdmin()` keeps operator access. Re-check with the steps below if the
operator account is ever recreated or moved to email/password.

The 2026-08-03 audit closed a hole where operator powers were granted by
email address alone - anyone can self-register an email/password account
under any address without proving they own it. `isAdmin()` now also requires
`email_verified`. **If the bricarlis@gmail.com account in production has an
unverified address, deploying these rules removes your own access to the
report queue.** Check before deploying:

```
firebase auth:export /tmp/dd-users.json --format=json --project direct-democracy-e338a
```

```
python3 -c "import json;[print(u.get('email'),u.get('emailVerified')) for u in json.load(open('/tmp/dd-users.json'))['users'] if u.get('email')]"
```

If the operator row prints `False`, fix it either way:

- Sign into the app with **Continue with Google** as bricarlis@gmail.com.
  Google always asserts `email_verified: true`, and Firebase links it to the
  existing account. Easiest option.
- Or Firebase console → Authentication → Users → the operator row → send a
  verification email and click the link.

Delete `/tmp/dd-users.json` afterward - it is a full user export.

### 7b. After that deploy: enable the TTL policy

STATUS: enabled 2026-08-03 - `processedEvents/expiresAt` TTL policy reports
`state: ACTIVE`. Nothing further needed unless the collection is renamed.

The tally triggers now claim each event id in `processedEvents/{eventId}` so
a redelivered Firestore event can't double-count a vote. Nothing expires
those markers without a TTL policy, and the collection grows forever. Run
once per project:

```
gcloud firestore fields ttls update expiresAt --collection-group=processedEvents --enable-ttl --project=direct-democracy-e338a
```

(Console equivalent: Google Cloud console → Firestore → Time-to-live →
Create policy → collection group `processedEvents`, field `expiresAt`.)
Verify with:

```
gcloud firestore fields ttls list --project=direct-democracy-e338a
```

### 7c. Commit the .env file

STATUS: staged 2026-08-03 (`git add .env`). It still needs to land in a
commit before EAS sees it - EAS builds from committed history, not the
working tree.

`.env` holds public identifiers only (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
`EXPO_PUBLIC_AUTH_CONTINUE_URL`) and EAS builds from the git archive - so
while it is untracked, EAS builds ship WITHOUT those values and native
Google sign-in fails in real builds. It is currently untracked:

```
git add .env && git status --short .env
```

Never put a secret in it. Secrets go in EAS secrets or
`firebase functions:secrets:set`; `.gitignore` covers `.env.local`,
`.env.*.local`, and `.env*.secret` for local-only overrides.

## 8. App icon - DONE

Chicago-flag icon set generated (iOS, Android adaptive, favicon); Expo
template assets removed.

## 9. When ready to submit

REMINDER: once the App Store Connect listing exists, copy its numeric App
Store ID (the `id123...` number in the listing URL) into Firebase console →
Project settings → General → Your apps → the iOS app → **App Store ID**
field. Team ID R3H7M2M4F5 is already filled in (2026-08-03). Universal links
(email sign-in links opening the app) stay unreliable until this is set.


- `eas build --platform ios` (production profile) → `eas submit -p ios`.
- App Store Connect listing needs: screenshots, description, the privacy
  URL from step 1, and the **App Privacy** questionnaire (declare: email
  address for account, user content, identifiers - no tracking, no ads).
- Age rating: expect 17+ or 12+ due to unfiltered user-generated content
  wiggle room; the report/block/moderation features built in are what
  guideline 1.2 checks for.
