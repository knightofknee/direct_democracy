import { useState } from 'react';

/**
 * Assume-success overlay for a trigger-written aggregate (Brian's rule:
 * a user's own vote essentially never fails, so the numbers move the
 * instant they tap; only a failed write rolls back and alerts).
 *
 * `predict(next)` overlays a predicted value over the current server value.
 * The overlay is keyed to the server value it was predicted FROM, so the
 * moment the server value changes at all (almost always our own trigger
 * landing) the real numbers take over; a stale overlay can never outlive
 * the recount. `rollback()` drops the overlay after a failed write, which
 * is when the user gets told.
 *
 * Same contract as the inline overlays in concern/[id].tsx and
 * poll-card.tsx (the originals of this pattern); use this hook for new
 * surfaces instead of hand-rolling the baseline bookkeeping.
 */
export function useOptimistic<T>(server: T): {
  value: T;
  predict: (next: T) => void;
  rollback: () => void;
} {
  const key = JSON.stringify(server);
  // A stale overlay (key no longer matching) is simply ignored; the next
  // predict replaces it, so nothing needs clearing in an effect.
  const [overlay, setOverlay] = useState<{ key: string; value: T } | null>(null);

  return {
    value: overlay && overlay.key === key ? overlay.value : server,
    predict: (next: T) => setOverlay({ key, value: next }),
    rollback: () => setOverlay(null),
  };
}
