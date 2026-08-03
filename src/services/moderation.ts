import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { UserProfile } from '@/lib/types';

/**
 * Content moderation, user-side. Reports are write-only for clients (the
 * operator reviews them with the Admin SDK); blocks are a personal filter -
 * blocked users' content is hidden on this account, not taken down.
 */

export type ReportReason = 'spam' | 'harassment' | 'misleading' | 'other';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment or abuse' },
  { key: 'misleading', label: 'Misleading or fraudulent' },
  { key: 'other', label: 'Something else' },
];

export async function reportContent(
  profile: UserProfile,
  input: {
    /** Firestore path of the offending document. */
    contentPath: string;
    contentType: 'concern' | 'comment' | 'question' | 'response';
    reason: ReportReason;
    /** Snapshot of the offending text so the report is reviewable even if edited. */
    excerpt: string;
    authorUid?: string;
  }
): Promise<void> {
  await addDoc(collection(db, 'reports'), {
    reporterUid: profile.uid,
    contentPath: input.contentPath,
    contentType: input.contentType,
    reason: input.reason,
    excerpt: input.excerpt.slice(0, 300),
    authorUid: input.authorUid ?? null,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

export async function blockUser(
  profile: UserProfile,
  blockedUid: string,
  displayName: string
): Promise<void> {
  if (profile.uid === blockedUid) throw new Error('You cannot block yourself.');
  await setDoc(doc(db, 'users', profile.uid, 'blocks', blockedUid), {
    displayName,
    createdAt: serverTimestamp(),
  });
}

export async function unblockUser(profile: UserProfile, blockedUid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', profile.uid, 'blocks', blockedUid));
}
