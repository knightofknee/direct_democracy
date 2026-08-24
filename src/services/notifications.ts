import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '@/lib/firebase';
import type { AppNotification } from '@/lib/types';

/**
 * The notifications inbox, client-side. Docs are created only by Cloud
 * Functions triggers; the client just reads, marks read, and deletes.
 */

export async function markNotificationRead(uid: string, noteId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'notifications', noteId), { read: true });
}

export async function markAllNotificationsRead(
  uid: string,
  notifications: AppNotification[]
): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  for (const n of unread.slice(0, 400)) {
    batch.update(doc(db, 'users', uid, 'notifications', n.id), { read: true });
  }
  await batch.commit();
}

/**
 * Ask the server to recheck whether this account has claimed its public
 * official/candidate profile (a provider now attached to the placeholder).
 * Fire-and-forget from politician screens; the nightly sweep catches the rest.
 */
export async function refreshClaim(): Promise<{ claimed: boolean }> {
  const call = httpsCallable<Record<string, never>, { claimed: boolean }>(
    functions,
    'refreshClaim'
  );
  return (await call({})).data;
}
