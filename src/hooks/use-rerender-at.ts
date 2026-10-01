import { useEffect, useReducer } from 'react';

/**
 * Render again when a moment arrives (a posting limit reopening), so a
 * button disabled "until 3:15 PM" turns back on at 3:15 without anything
 * else having to change on screen.
 */
export function useRerenderAt(at: Date | null): void {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const ms = at?.getTime() ?? null;
  useEffect(() => {
    if (ms == null) return;
    // setTimeout can't wait longer than about 24 days; a later moment is
    // re-armed by the render the early tick causes.
    const wait = Math.min(Math.max(0, ms - Date.now()) + 500, 2 ** 31 - 1);
    const id = setTimeout(tick, wait);
    return () => clearTimeout(id);
  }, [ms]);
}
