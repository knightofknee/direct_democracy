import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions, usingEmulators } from '@/lib/firebase';
import { validateDisplayName } from '@/lib/names';

export async function updateDisplayName(uid: string, name: string): Promise<void> {
  const error = validateDisplayName(name);
  if (error) throw new Error(error);
  await updateDoc(doc(db, 'users', uid), { displayName: name.trim() });
}

/**
 * Identity verification, Persona-shaped.
 *
 * Production flow (documented in README):
 *  1. App asks our `createVerificationSession` function for a Persona inquiry.
 *  2. User completes Persona's hosted flow (government ID + address). The ID
 *     data never touches our servers or database.
 *  3. Persona webhooks our `personaWebhook` function, which stores only:
 *     verified=true, wardId (derived from the verified address), and the
 *     registered-voter flag. Nothing else is retained.
 *
 * Against the emulator there is no Persona, so `devVerify` (a callable that
 * only exists in emulator/dev builds) simulates a passing inquiry.
 */
export async function startVerification(input: {
  wardId: number;
  registeredVoter: boolean;
}): Promise<{ mode: 'dev' | 'persona' }> {
  if (usingEmulators) {
    const devVerify = httpsCallable(functions, 'devVerify');
    await devVerify(input);
    return { mode: 'dev' };
  }
  const createSession = httpsCallable<
    Record<string, never>,
    { inquiryUrl: string }
  >(functions, 'createVerificationSession');
  const { data } = await createSession({});
  // The hosted Persona inquiry is opened in the browser; the webhook finishes
  // the job and the profile listener picks up verified=true when it lands.
  const { openBrowserAsync } = await import('expo-web-browser');
  await openBrowserAsync(data.inquiryUrl);
  return { mode: 'persona' };
}
