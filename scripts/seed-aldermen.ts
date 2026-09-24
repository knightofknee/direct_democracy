/**
 * Provisions all 50 Chicago aldermen from the city's own Ward Offices
 * dataset (data.cityofchicago.org, id htai-wnw4): name, ward, public email,
 * phone, website, and the city-hosted portrait link. Everything written here
 * is public record published by the city itself.
 *
 * Each alderman gets a passwordless placeholder account keyed to their
 * published ward email (claim path: password reset to that inbox), a
 * users/{uid} profile (role official), and an officials/{uid} card. Safe to
 * re-run after elections or appointments: existing cards are updated in
 * place by email, and counters/bio/photo are only seeded on first create so
 * a claimed official's own edits survive.
 *
 *   gcloud auth application-default login
 *   npm run seed-aldermen -- --dry-run   # print what would be written
 *   npm run seed-aldermen
 */

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'direct-democracy-e338a';
const DATASET_URL = 'https://data.cityofchicago.org/resource/htai-wnw4.json?$limit=60';

const dryRun = process.argv.includes('--dry-run');

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

interface WardRow {
  ward: string;
  alderman: string; // "Last, First M."
  email?: string;
  ward_phone?: string;
  website?: { url: string };
  photo_link?: { url: string };
}

function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

/**
 * "La Spata, Daniel" -> "Daniel La Spata"; "Cardona, Jr., Felix" ->
 * "Felix Cardona Jr." (the dataset is last-name-first, suffix in the middle).
 */
function displayName(datasetName: string): string {
  const parts = datasetName.split(',').map((p) => p.trim());
  if (parts.length === 1) return parts[0];
  if (parts.length >= 3 && /^(Jr\.?|Sr\.?|I{2,3}|IV)$/i.test(parts[1])) {
    return `${parts.slice(2).join(' ')} ${parts[0]} ${parts[1]}`;
  }
  return `${parts.slice(1).join(' ')} ${parts[0]}`;
}

/**
 * Keep only https URLs (upgrading the dataset's few plain-http ones). A
 * couple of rows have emails crammed into the website field - reject
 * anything with an @.
 */
function httpsOrNull(url: string | undefined): string | null {
  if (!url || url.includes('@')) return null;
  const normalized = url.replace(/^http:\/\//, 'https://');
  return normalized.startsWith('https://') ? normalized : null;
}

async function main() {
  const resp = await fetch(DATASET_URL, { headers: { accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Fetching ward dataset failed: ${resp.status}`);
  const rows = ((await resp.json()) as WardRow[]).sort(
    (a, b) => Number(a.ward) - Number(b.ward)
  );
  if (rows.length !== 50) throw new Error(`Expected 50 wards, got ${rows.length}.`);
  const emails = rows.map((r) => r.email?.toLowerCase()).filter(Boolean);
  if (new Set(emails).size !== emails.length) {
    throw new Error('Duplicate ward emails in the dataset - resolve before seeding.');
  }

  let created = 0;
  let updated = 0;
  // Where the ward's own chicago.gov page publishes a better inbox than the
  // dataset, the page wins (checked 2026-09-22). Accounts are keyed by this
  // email, so an override here must match the live auth user.
  const EMAIL_OVERRIDES: Record<number, string> = {
    1: 'info@the1stward.com', // dataset: Ward01@cityofchicago.org; chicago.gov Ward 1 page and La Spata's office use info@
  };
  for (const row of rows) {
    const wardId = Number(row.ward);
    const name = displayName(row.alderman);
    const title = `Alderman, ${ordinal(wardId)} Ward`;
    const email = EMAIL_OVERRIDES[Number(row.ward)] ?? row.email;
    if (!email) {
      console.warn(`Ward ${wardId} (${name}): no email in dataset - skipped.`);
      continue;
    }
    const websiteUrl = httpsOrNull(row.website?.url);
    const photoUrl = httpsOrNull(row.photo_link?.url);
    const phone = row.ward_phone?.split('/')[0].trim() || null;

    if (dryRun) {
      console.log(
        `ward ${String(wardId).padStart(2)}: ${name} | ${email} | ${phone ?? '-'} | ${websiteUrl ?? '-'} | photo ${photoUrl ? 'yes' : 'no'}`
      );
      continue;
    }

    let user = await auth.getUserByEmail(email).catch(() => null);
    if (!user) {
      user = await auth.createUser({ email, displayName: name, emailVerified: false });
    }

    const profileRef = db.doc(`users/${user.uid}`);
    if ((await profileRef.get()).exists) {
      await profileRef.update({ role: 'official', verified: true, wardId });
    } else {
      await profileRef.set({
        displayName: name,
        role: 'official',
        verified: true,
        wardId,
        stats: { concerns: 0, comments: 0, votes: 0, judgments: 0 },
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    const cardRef = db.doc(`officials/${user.uid}`);
    const existing = await cardRef.get();
    await cardRef.set(
      {
        uid: user.uid,
        name,
        title,
        wardId,
        // Public record refreshes on every run; bio/photo and the
        // trigger-maintained counters are seeded once and then left to the
        // official (photo falls back to the city's portrait initially).
        contactEmail: email,
        phone,
        websiteUrl,
        ...(existing.exists
          ? {}
          : {
              bio: '',
              photoUrl,
              questionsAsked: 0,
              questionsResponded: 0,
              questionsAnswered: 0,
              questionsDodged: 0,
            }),
      },
      { merge: true }
    );
    if (existing.exists) updated += 1;
    else created += 1;
    console.log(`✓ ward ${String(wardId).padStart(2)}: ${name} (${email})`);
  }

  if (!dryRun) console.log(`Done: ${created} created, ${updated} updated.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
