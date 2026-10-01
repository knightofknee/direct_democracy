import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions, usingEmulators } from '@/lib/firebase';
import { validateDisplayName } from '@/lib/names';
import { openLinkAfterAwait } from '@/lib/open-link';

export async function updateDisplayName(uid: string, name: string): Promise<void> {
  const error = validateDisplayName(name);
  if (error) throw new Error(error);
  await updateDoc(doc(db, 'users', uid), { displayName: name.trim() });
}

/**
 * Permanently delete the account: auth user, profile, block list, and every
 * ballot, approval, and judgment it cast (the triggers take them out of the
 * tallies). Runs server-side so the removal is complete even if the client
 * disconnects mid-way. Posts stay under "[deleted]" (see the deleteAccount
 * function's doc comment).
 */
export async function deleteAccount(): Promise<void> {
  const call = httpsCallable(functions, 'deleteAccount');
  await call({});
}

/**
 * Identity verification, Didit-shaped.
 *
 * Production flow (documented in README):
 *  1. App asks our `createVerificationSession` function for a Didit inquiry.
 *  2. User completes Didit's hosted flow (government ID + address). The ID
 *     data never touches our servers or database.
 *  3. Didit webhooks our `diditWebhook` function, which stores only:
 *     verified=true and wardId (derived from the verified address). Nothing
 *     else is retained.
 *
 * Against the emulator there is no Didit, so `devVerify` (a callable that
 * only exists in emulator/dev builds) simulates a passing inquiry.
 */
export async function startVerification(input: {
  wardId: number;
  /** For a move: read the address off the ID, or off a bill or statement. */
  method?: 'id' | 'address';
}): Promise<{ mode: 'dev' | 'didit' }> {
  if (usingEmulators) {
    const devVerify = httpsCallable(functions, 'devVerify');
    await devVerify({ wardId: input.wardId });
    return { mode: 'dev' };
  }
  const createSession = httpsCallable<
    { method?: 'id' | 'address' },
    { inquiryUrl: string }
  >(functions, 'createVerificationSession');
  const { data } = await createSession(input.method ? { method: input.method } : {});
  // The hosted Didit inquiry is opened in the browser; the webhook finishes
  // the job and the profile listener picks up verified=true when it lands.
  await openLinkAfterAwait(data.inquiryUrl);
  return { mode: 'didit' };
}

/**
 * Set a home ward without verifying (declareWard in functions): once, then
 * locked until verification replaces it with the ward on the ID.
 */
export async function declareWard(wardId: number): Promise<void> {
  const call = httpsCallable(functions, 'declareWard');
  await call({ wardId });
}
