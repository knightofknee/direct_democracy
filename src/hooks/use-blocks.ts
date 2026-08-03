import { collection, query } from 'firebase/firestore';
import { useMemo } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { db } from '@/lib/firebase';

export interface BlockEntry {
  id: string; // the blocked uid
  displayName: string;
}

/**
 * The signed-in user's block list, live. `isBlocked` drives content
 * filtering everywhere author-attributed content renders.
 */
export function useBlocks(): {
  blocks: BlockEntry[];
  isBlocked: (uid: string | null | undefined) => boolean;
} {
  const { profile } = useAuth();
  const { data: blocks } = useLiveQuery<BlockEntry>(
    () => (profile ? query(collection(db, 'users', profile.uid, 'blocks')) : null),
    [profile?.uid]
  );
  const blockedSet = useMemo(() => new Set(blocks.map((b) => b.id)), [blocks]);
  return {
    blocks,
    isBlocked: (uid) => (uid ? blockedSet.has(uid) : false),
  };
}
