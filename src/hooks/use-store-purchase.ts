/**
 * Web has no app store, so verification that costs money can't be bought
 * here (see use-store-purchase.native.ts for the phones).
 */
export interface StorePurchase {
  /** True once the phone's store is connected. */
  available: boolean;
  /** The store's localized price for a product, once loaded. */
  priceOf: (productId: string) => string | null;
  loadProducts: (productIds: string[]) => void;
  /** Buy one, have the server check and credit it, then finish it with the store. */
  buy: (productId: string, accountToken: string) => Promise<'paid' | 'cancelled'>;
}

export function useStorePurchase(): StorePurchase {
  return {
    available: false,
    priceOf: () => null,
    loadProducts: () => {},
    buy: async () => {
      throw new Error('Paying for verification works in the iPhone and Android apps.');
    },
  };
}
