import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { UserProfile } from '@/lib/types';
import { tr } from '@/lib/i18n';

/**
 * Content moderation, user-side. Reports are write-only for clients (the
 * operator reviews them with the Admin SDK); blocks are a personal filter -
 * blocked users' content is hidden on this account, not taken down.
 */

export type ReportReason = 'spam' | 'harassment' | 'misleading' | 'childSafety' | 'other';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment or abuse' },
  { key: 'misleading', label: 'Misleading or fraudulent' },
  // Named explicitly (not folded into "other") - child safety reports must
  // be unmistakable to file and impossible to miss in the review queue.
  { key: 'childSafety', label: 'Child safety' },
  { key: 'other', label: 'Something else' },
];

/**
 * The most serious of the reasons picked, sent as `reason` beside the full
 * `reasons` list: older review tools and the shadowban read the one field.
 */
const SEVERITY: ReportReason[] = ['childSafety', 'harassment', 'misleading', 'spam', 'other'];

/** The kinds of post a report can name. */
export type ReportContentType = 'concern' | 'comment' | 'question' | 'response' | 'policy' | 'electionQuestion';

export async function reportContent(
  profile: UserProfile,
  input: {
    /** Firestore path of the offending document. */
    contentPath: string;
    contentType: ReportContentType;
    /** Every reason the reporter picked (at least one). */
    reasons: ReportReason[];
    /** Snapshot of the offending text so the report is reviewable even if edited. */
    excerpt: string;
    authorUid?: string;
    /** What's wrong, in the reporter's words: required for "Something else". */
    note?: string;
  }
): Promise<void> {
  const note = input.note?.trim() ?? '';
  const reasons = SEVERITY.filter((r) => input.reasons.includes(r));
  if (reasons.length === 0) throw new Error(tr('Pick at least one reason.'));
  if (reasons.includes('other') && note.length < 5) {
    throw new Error(tr('Say what’s wrong with it (at least 5 characters).'));
  }
  await addDoc(collection(db, 'reports'), {
    reporterUid: profile.uid,
    contentPath: input.contentPath,
    contentType: input.contentType,
    reason: reasons[0],
    reasons,
    excerpt: input.excerpt.slice(0, 300),
    authorUid: input.authorUid ?? null,
    ...(note ? { note: note.slice(0, 500) } : {}),
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

export async function blockUser(
  profile: UserProfile,
  blockedUid: string,
  displayName: string
): Promise<void> {
  if (profile.uid === blockedUid) throw new Error(tr('You cannot block yourself.'));
  await setDoc(doc(db, 'users', profile.uid, 'blocks', blockedUid), {
    displayName,
    createdAt: serverTimestamp(),
  });
}

export async function unblockUser(profile: UserProfile, blockedUid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', profile.uid, 'blocks', blockedUid));
}
