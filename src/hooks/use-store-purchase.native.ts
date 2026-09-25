import { finishTransaction, isUserCancelledError, useIAP, type Purchase } from 'expo-iap';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { VERIFICATION_PRODUCTS } from '@/lib/verification';
import { redeemVerificationPurchase } from '@/services/payments';

import type { StorePurchase } from './use-store-purchase';

export type { StorePurchase } from './use-store-purchase';

const OURS = new Set<string>(VERIFICATION_PRODUCTS);

/**
 * Buying verification through Apple or Google. A purchase only counts once
 * the server has checked it with the store and added the credit; then it's
 * finished as a consumable so the same product can be bought again. A
 * purchase interrupted before that (app killed, no signal) comes back from
 * the store on the next connection and is settled the same way.
 */
export function useStorePurchase(): StorePurchase {
  const pending = useRef<{
    resolve: (r: 'paid' | 'cancelled') => void;
    reject: (e: unknown) => void;
  } | null>(null);
  const settling = useRef(new Set<string>());

  const settle = useCallback(async (purchase: Purchase) => {
    if (!OURS.has(purchase.productId) || !purchase.purchaseToken) return;
    const key = purchase.transactionId ?? purchase.purchaseToken;
    if (settling.current.has(key)) return;
    settling.current.add(key);
    const waiter = pending.current;
    pending.current = null;
    try {
      await redeemVerificationPurchase(
        Platform.OS === 'ios' ? 'ios' : 'android',
        purchase.productId,
        purchase.purchaseToken
      );
      await finishTransaction({ purchase, isConsumable: true });
      waiter?.resolve('paid');
    } catch (e) {
      settling.current.delete(key);
      waiter?.reject(e);
    }
  }, []);

  const store = useIAP({
    onPurchaseSuccess: (purchase) => void settle(purchase),
    onPurchaseError: (error) => {
      const waiter = pending.current;
      pending.current = null;
      if (isUserCancelledError(error)) waiter?.resolve('cancelled');
      else waiter?.reject(error);
    },
  });

  // Settle anything left over from an interrupted purchase.
  useEffect(() => {
    if (store.connected) store.getAvailablePurchases().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.connected]);
  useEffect(() => {
    for (const p of store.availablePurchases) void settle(p);
  }, [store.availablePurchases, settle]);

  const { connected, products, fetchProducts, requestPurchase } = store;
  return {
    available: connected,
    priceOf: (productId) => products.find((p) => p.id === productId)?.displayPrice ?? null,
    loadProducts: (productIds) => {
      if (connected && productIds.length) {
        fetchProducts({ skus: productIds, type: 'in-app' }).catch(() => {});
      }
    },
    buy: (productId, accountToken) =>
      new Promise((resolve, reject) => {
        pending.current = { resolve, reject };
        requestPurchase({
          request: {
            apple: { sku: productId, appAccountToken: accountToken },
            google: { skus: [productId], obfuscatedAccountId: accountToken },
          },
          type: 'in-app',
        }).catch((e: unknown) => {
          pending.current = null;
          if (isUserCancelledError(e as never)) resolve('cancelled');
          else reject(e);
        });
      }),
  };
}
