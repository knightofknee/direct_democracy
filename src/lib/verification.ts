import type { UserProfile } from '@/lib/types';

/**
 * Moving: a verified citizen can verify a new address from Settings once per
 * this many days. Mirror of REVERIFY_COOLDOWN_MS in functions/src/index.ts,
 * which is the one that actually enforces it.
 */
export const REVERIFY_COOLDOWN_DAYS = 90;

/** When this person can next verify a new address, or null if they can now. */
export function reverifyOpensAt(profile: UserProfile, now = Date.now()): Date | null {
  const last = profile.reverifyAt?.toMillis?.();
  if (last == null) return null;
  const opens = last + REVERIFY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return opens > now ? new Date(opens) : null;
}

/**
 * Store product ids for paid verification, identical in App Store Connect and
 * Play Console (mirror of PRODUCTS in functions/src/payments.ts). Prices are
 * set on the store products; the app only ever shows the store's price.
 */
export const VERIFICATION_PRODUCTS = [
  'verification_standard',
  'verification_bill_reduced',
  'verification_bill_standard',
] as const;
