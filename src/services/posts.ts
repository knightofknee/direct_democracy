import { httpsCallable } from 'firebase/functions';

import { functions } from '@/lib/firebase';

/**
 * Edit your own post through the server (functions/src/index.ts editPost),
 * which records the edit in the post's history: always the time, and the
 * earlier text once anyone had replied. `path` is the post's Firestore path.
 */
export async function editPost(
  path: string,
  input: { body: string; title?: string; references?: string[] }
): Promise<void> {
  const call = httpsCallable(functions, 'editPost');
  await call({ path, ...input });
}
