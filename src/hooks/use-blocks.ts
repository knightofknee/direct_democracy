import { collection, doc, query } from 'firebase/firestore';
import { useMemo } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { db } from '@/lib/firebase';

export interface BlockEntry {
  id: string; // the blocked uid
  displayName: string;
}

/**
 * The signed-in user's block list, live, plus the accounts hidden pending
 * review (moderation/shadowbanned: 5+ people reported them). `isBlocked`
 * drives content filtering everywhere author-attributed content renders; a
 * shadowbanned account still sees its own posts, so nothing tells it apart
 * from an ordinary quiet day.
 */
export function useBlocks(): {
  blocks: BlockEntry[];
  isBlocked: (uid: string | null | undefined) => boolean;
  isShadowbanned: (uid: string | null | undefined) => boolean;
} {
  const { profile } = useAuth();
  const { data: blocks } = useLiveQuery<BlockEntry>(
    () => (profile ? query(collection(db, 'users', profile.uid, 'blocks')) : null),
    [profile?.uid]
  );
  const { data: hidden } = useLiveDoc<{ uids?: string[] }>(() => doc(db, 'moderation', 'shadowbanned'), []);
  const blockedSet = useMemo(() => new Set(blocks.map((b) => b.id)), [blocks]);
  const hiddenSet = useMemo(() => new Set(hidden?.uids ?? []), [hidden]);
  const isShadowbanned = (uid: string | null | undefined) =>
    !!uid && uid !== profile?.uid && hiddenSet.has(uid);
  return {
    blocks,
    isBlocked: (uid) => (uid ? blockedSet.has(uid) || isShadowbanned(uid) : false),
    isShadowbanned,
  };
}
