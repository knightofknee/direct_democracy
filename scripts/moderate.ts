/**
 * The operator's moderation desk (2026-09-29). Apart from child safety
 * (reports and feedback alert the operator at once), there is no alert:
 * the weekly task runs the review and tells Brian what's waiting, and Brian
 * decides what happens.
 *
 *   npm run moderate
 *     Open reports grouped by the person reported (name, role, how many
 *     different accounts reported them, each report's reason and the
 *     reported text), everyone shadowbanned right now, and open feedback
 *     from Settings (child safety first; those also alert the operator the
 *     moment they arrive, as child safety reports do).
 *
 *   npm run moderate -- --clear <uid>
 *     Nothing wrong: dismiss their open reports. Their posts stay up, and
 *     if they were shadowbanned, everyone can see their posts again.
 *
 *   npm run moderate -- --remove <contentPath>
 *     Take down one post (concerns/abc, officials/o/questions/q/comments/c,
 *     ...); its reports are marked resolved.
 *
 *   npm run moderate -- --remove-posts <uid>
 *     Take down everything that account posted. The shadowban stays.
 *
 *   npm run moderate -- --delete-user <uid> [--keep-posts]
 *     Delete the account, remove its posts (unless --keep-posts), and ban
 *     its verified ID so it can't verify another account. Runs server-side
 *     (onModerationAction) so it's the same deletion users get.
 *
 *   npm run moderate -- --handled <feedbackId>
 *     Mark a feedback message dealt with.
 *
 * A shadowban starts on its own once 5 different accounts have open reports
 * against a citizen (onReportCreated): their posts are hidden from everyone
 * but them, and notify nobody, until a decision here.
 *
 * Production needs `gcloud auth application-default login`; add --emulator
 * for the Emulator Suite.
 */

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : null;
}
const useEmulator = process.argv.includes('--emulator');
if (useEmulator) process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:8080';

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Timestamp } from 'firebase-admin/firestore';

const PROJECT_ID = 'direct-democracy-e338a';
const app = useEmulator
  ? initializeApp({ projectId: PROJECT_ID })
  : initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore(app);

const when = (t: Timestamp | undefined) => (t ? t.toDate().toISOString().slice(0, 16).replace('T', ' ') : '?');

async function review() {
  const [open, banned] = await Promise.all([
    db.collection('reports').where('status', '==', 'open').get(),
    db.doc('moderation/shadowbanned').get(),
  ]);
  const hidden = (banned.data()?.uids ?? []) as string[];
  const since = (banned.data()?.since ?? {}) as Record<string, Timestamp>;
  const byAuthor = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  for (const r of open.docs) {
    const key = (r.data().authorUid as string | null) ?? '(unknown author)';
    byAuthor.set(key, [...(byAuthor.get(key) ?? []), r]);
  }
  for (const uid of hidden) if (!byAuthor.has(uid)) byAuthor.set(uid, []);

  if (byAuthor.size === 0) {
    console.log('No open reports and nobody shadowbanned.');
    return;
  }
  const people = [...byAuthor.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [uid, reports] of people) {
    const user = uid.startsWith('(') ? null : (await db.doc(`users/${uid}`).get()).data();
    const reporters = new Set(reports.map((r) => r.data().reporterUid as string));
    const flags = [
      user?.role && user.role !== 'citizen' ? user.role : null,
      user?.verified ? 'verified' : null,
      hidden.includes(uid) ? `SHADOWBANNED since ${when(since[uid])}` : null,
      user ? null : uid.startsWith('(') ? null : 'account gone',
    ].filter(Boolean);
    console.log(`\n${user?.displayName ?? '?'} (${uid})${flags.length ? ` [${flags.join(', ')}]` : ''}`);
    console.log(`  ${reports.length} open report(s) from ${reporters.size} account(s)`);
    for (const r of reports) {
      const d = r.data();
      const reasons = (d.reasons as string[] | undefined)?.join(' + ') ?? d.reason;
      console.log(`  - ${when(d.createdAt)} ${reasons} on ${d.contentType} ${d.contentPath} (report ${r.id})`);
      if (d.note) console.log(`    reporter says: "${String(d.note).replace(/\s+/g, ' ')}"`);
      else if (d.reason === 'other' || d.reasons?.includes('other')) console.log('    reporter gave no reason');
      if (d.excerpt) console.log(`    post: "${String(d.excerpt).replace(/\s+/g, ' ').slice(0, 300)}"`);
    }
  }
}

/** Open messages from Settings > Send feedback, child safety first. */
async function reviewFeedback() {
  const open = await db.collection('feedback').where('status', '==', 'open').get();
  if (open.empty) {
    console.log('\nNo open feedback.');
    return;
  }
  const items = open.docs.sort(
    (a, b) =>
      Number(b.data().topic === 'childSafety') - Number(a.data().topic === 'childSafety') ||
      (b.data().createdAt?.toMillis() ?? 0) - (a.data().createdAt?.toMillis() ?? 0)
  );
  console.log(`\nFeedback (${items.length} open)`);
  for (const f of items) {
    const d = f.data();
    const who = [d.email ?? 'no email', d.uid ?? 'signed out', d.platform, d.appVersion].filter(Boolean).join(', ');
    console.log(`  - ${when(d.createdAt)} ${d.topic === 'childSafety' ? 'CHILD SAFETY' : d.topic} (${who}) (feedback ${f.id})`);
    console.log(`    "${String(d.message).replace(/\s+/g, ' ')}"`);
  }
}

async function markReports(uid: string, status: 'dismissed' | 'resolved', path?: string) {
  const q = path
    ? db.collection('reports').where('contentPath', '==', path).where('status', '==', 'open')
    : db.collection('reports').where('authorUid', '==', uid).where('status', '==', 'open');
  const open = await q.get();
  await Promise.all(open.docs.map((d) => d.ref.update({ status })));
  return open.size;
}

/** Run a server-side action and wait for its result. */
async function act(action: Record<string, unknown>) {
  const ref = await db.collection('moderationActions').add({ ...action, createdAt: FieldValue.serverTimestamp() });
  for (let i = 0; i < 120; i++) {
    const d = (await ref.get()).data();
    if (d?.done) return d;
    if (d?.error) throw new Error(String(d.error));
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`No result after 4 minutes; check moderationActions/${ref.id}.`);
}

async function main() {
  const clear = arg('clear');
  const remove = arg('remove');
  const removePosts = arg('remove-posts');
  const deleteUser = arg('delete-user');
  const handled = arg('handled');

  if (clear) {
    const n = await markReports(clear, 'dismissed');
    const banned = ((await db.doc('moderation/shadowbanned').get()).data()?.uids ?? []) as string[];
    if (banned.includes(clear)) {
      await db.doc('moderation/shadowbanned').set(
        { uids: FieldValue.arrayRemove(clear), since: { [clear]: FieldValue.delete() } },
        { merge: true }
      );
    }
    console.log(
      `Cleared ${clear}: ${n} report(s) dismissed, their posts stay up` +
        (banned.includes(clear) ? ', and their posts are visible to everyone again.' : '.')
    );
  } else if (remove) {
    const ref = db.doc(remove);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`${remove} doesn't exist.`);
    await ref.delete();
    const n = await markReports('', 'resolved', remove);
    console.log(`Removed ${remove}; ${n} report(s) resolved.`);
  } else if (removePosts) {
    const r = await act({ type: 'removePosts', uid: removePosts, removePosts: true });
    console.log(`Removed ${r.removed} post(s) by ${removePosts}; their reports are resolved.`);
  } else if (deleteUser) {
    const keep = process.argv.includes('--keep-posts');
    const r = await act({ type: 'deleteUser', uid: deleteUser, removePosts: !keep, ban: true });
    console.log(`Deleted ${deleteUser} and banned their ID${keep ? '' : `; ${r.removed} post(s) removed`}.`);
  } else if (handled) {
    await db.doc(`feedback/${handled}`).update({ status: 'handled' });
    console.log(`Feedback ${handled} marked handled.`);
  } else {
    await review();
    await reviewFeedback();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
