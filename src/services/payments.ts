import { httpsCallable } from 'firebase/functions';

import { functions } from '@/lib/firebase';

/**
 * What starting a verification costs this person right now (see
 * getVerificationQuote in functions/src/index.ts): free, covered by a
 * credit they already bought, or a store product to buy first.
 */
export interface VerificationQuote {
  free: boolean;
  creditType: 'id' | 'bill';
  /** Purchased verifications not yet used, of this kind. */
  credits: number;
  /** The product to buy when neither free nor covered. */
  productId: string | null;
  /** Ties a purchase to this account (Apple appAccountToken / Google account id). */
  accountToken: string;
}

export async function getVerificationQuote(method: 'id' | 'address'): Promise<VerificationQuote> {
  const call = httpsCallable<{ method: 'id' | 'address' }, VerificationQuote>(
    functions,
    'getVerificationQuote'
  );
  return (await call({ method })).data;
}

/** Hand a completed store purchase to the server, which checks it and adds a credit. */
export async function redeemVerificationPurchase(
  platform: 'ios' | 'android',
  productId: string,
  token: string
): Promise<void> {
  const call = httpsCallable(functions, 'redeemVerificationPurchase');
  await call({ platform, productId, token });
}
