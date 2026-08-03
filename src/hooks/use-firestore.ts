import {
  onSnapshot,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

/**
 * Live Firestore hooks. `deps` must change whenever the query/ref does (they
 * are primitive values - uids, ids, field names), and are folded into a key
 * that both re-runs the subscription effect and marks stale results while a
 * new subscription warms up. Return null from the factory to disable
 * (e.g. while signed out) - that renders as an instant empty result.
 */

export function useLiveQuery<T>(makeQuery: () => Query | null, deps: unknown[]): {
  data: T[];
  loading: boolean;
} {
  const key = JSON.stringify(deps);
  const [result, setResult] = useState<{ key: string; data: T[] } | null>(null);

  useEffect(() => {
    const q = makeQuery();
    if (!q) return;
    return onSnapshot(
      q,
      (snap) => {
        setResult({ key, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T) });
      },
      (err) => {
        console.warn('useLiveQuery error:', err.message);
        setResult({ key, data: [] });
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!makeQuery()) return { data: [], loading: false };
  const fresh = result?.key === key;
  return { data: fresh ? result.data : [], loading: !fresh };
}

export function useLiveDoc<T>(makeRef: () => DocumentReference | null, deps: unknown[]): {
  data: T | null;
  loading: boolean;
} {
  const key = JSON.stringify(deps);
  const [result, setResult] = useState<{ key: string; data: T | null } | null>(null);

  useEffect(() => {
    const ref = makeRef();
    if (!ref) return;
    return onSnapshot(
      ref,
      (snap) => {
        setResult({ key, data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null });
      },
      (err) => {
        console.warn('useLiveDoc error:', err.message);
        setResult({ key, data: null });
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!makeRef()) return { data: null, loading: false };
  const fresh = result?.key === key;
  return { data: fresh ? result.data : null, loading: !fresh };
}
