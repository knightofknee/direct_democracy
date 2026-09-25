import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { FunctionsError } from 'firebase/functions';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { WARDS, wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useStorePurchase } from '@/hooks/use-store-purchase';
import { notify } from '@/lib/notify';
import { useTheme } from '@/hooks/use-theme';
import { usingEmulators } from '@/lib/firebase';
import { useT } from '@/lib/i18n';
import { reverifyOpensAt } from '@/lib/verification';
import { getVerificationQuote, type VerificationQuote } from '@/services/payments';
import { startVerification } from '@/services/users';

export default function VerifyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT();
  const { profile } = useAuth();
  // ?move=1 (from Settings): someone verified is verifying a new address.
  // &with=address: the move adds a bill or statement for an ID that still
  // shows the old address.
  const {
    move,
    with: withParam,
    previewPrice,
  } = useLocalSearchParams<{ move?: string; with?: string; previewPrice?: string }>();
  // Emulator only: ?previewPrice=$0.29 renders the production purchase screen
  // with that store price (the store has no web or emulator), for App Store
  // review screenshots. Never reachable against production.
  const storePreview = usingEmulators && previewPrice ? previewPrice : null;
  const devMode = usingEmulators && !storePreview;
  const [wardId, setWardId] = useState<number | null>(profile?.wardId ?? null);
  const [busy, setBusy] = useState(false);

  // Price first: free inside Didit's monthly 500, covered by a credit the
  // person already bought, or a store purchase before the session starts.
  const store = useStorePurchase();
  const [quote, setQuote] = useState<VerificationQuote | null>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const method: 'id' | 'address' = move === '1' && withParam === 'address' ? 'address' : 'id';
  const priced = !devMode && profile != null && (!profile.verified || move === '1');
  const refreshQuote = useCallback(() => {
    if (!priced) return;
    getVerificationQuote(method).then(
      (q) => {
        setQuote(q);
        setQuoteFailed(false);
      },
      () => setQuoteFailed(true)
    );
  }, [priced, method]);
  useEffect(refreshQuote, [refreshQuote]);
  const productId = quote?.productId ?? null;
  useEffect(() => {
    if (productId) store.loadProducts([productId]);
    // loadProducts is rebuilt every render; reload only when the product or connection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, store.available]);
  const mustPay = quote != null && !quote.free && quote.credits < 1;
  const price = storePreview ?? (productId ? store.priceOf(productId) : null);

  if (!profile) {
    return (
      <Screen>
        <Button title={t('Sign in first')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  const moving = profile.verified && move === '1' && reverifyOpensAt(profile) == null;
  const withBill = moving && withParam === 'address';

  if (profile.verified && !moving) {
    return (
      <Screen>
        <Card>
          <View style={{ alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three }}>
            <Ionicons name="shield-checkmark" size={40} color={theme.verified} />
            <ThemedText type="smallBold">{t('You’re verified')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {profile.wardId != null ? t('Resident of the {ward}.').replace('{ward}', wardLabel(profile.wardId)) : t('Verified Chicago resident.')}
            </ThemedText>
          </View>
        </Card>
      </Screen>
    );
  }

  const begin = async () => {
    if (devMode && wardId == null) {
      notify('Pick a ward', 'Choose the ward you live in to simulate verification.');
      return;
    }
    if (storePreview) return;
    if (!devMode && mustPay) {
      if (!price || !productId || !quote) return;
      setBusy(true);
      try {
        if ((await store.buy(productId, quote.accountToken)) === 'cancelled') {
          setBusy(false);
          return;
        }
      } catch (e) {
        notify(t('Payment failed'), e instanceof Error ? e.message : t('Something went wrong.'));
        setBusy(false);
        refreshQuote();
        return;
      }
    }
    setBusy(true);
    try {
      const { mode } = await startVerification({
        wardId: wardId ?? 1,
        method: moving ? (withBill ? 'address' : 'id') : undefined,
      });
      if (mode === 'dev') {
        notify('Verified (dev)', 'Simulated a passing Didit inquiry against the emulator.');
        if (router.canGoBack()) router.back();
        else router.replace('/ward');
      }
      // In the real Didit flow the webhook flips the profile; the app reacts
      // to the live profile listener, so there's nothing to do here.
    } catch (e) {
      // The month's free 500 can run out between showing the price and
      // starting; the refreshed quote puts the price on the button.
      if ((e as FunctionsError).details && ((e as FunctionsError).details as { paymentRequired?: boolean }).paymentRequired) {
        notify(t('This month’s free verifications just ran out'), t('The price is on the button now.'));
      } else {
        notify(t('Verification failed'), e instanceof Error ? e.message : t('Something went wrong.'));
      }
    } finally {
      setBusy(false);
      refreshQuote();
    }
  };

  const priceNote = !priced
    ? null
    : quoteFailed
      ? t('Couldn’t load the price. Check your connection and try again.')
      : quote == null
        ? null
        : !mustPay
          ? quote.free
            ? null
            : t('Already paid. This attempt is covered.')
          : !store.available && !price
            ? t('Paying for verification works in the iPhone and Android apps.')
            : !price
              ? t('Getting the price…')
              : `${
                  quote.creditType === 'bill'
                    ? t('Checking a bill or statement costs {price}.')
                    : t('The first 500 verifications each month are free. This month’s are used up, so this one costs {price}.')
                } ${t('If you don’t open the verification link, your payment carries over to your next attempt.')}`.replace('{price}', price);

  return (
    <Screen>
      {moving && (
        <Card>
          <ThemedText type="smallBold">{t('Verify a new address')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {withBill
              ? t('Have your ID and a utility bill or bank statement from the last 3 months showing your name and your new Chicago address. If it’s in a different ward, your ward moves there. If we can’t place it in Chicago, nothing changes. You can do this once every 3 months.')
              : t('Use an ID that shows your new Chicago address. If it’s in a different ward, your ward moves there. If we can’t place it in Chicago, nothing changes. You can do this once every 3 months.')}
          </ThemedText>
        </Card>
      )}
      <Card>
        <ThemedText type="smallBold">{t('How verification works')}</ThemedText>
        <Step n={1} text={t('You verify your ID and Chicago address with Didit, a third-party identity service. Your documents go to them, never to us.')} />
        <Step n={2} text={t('All we ever save: a verified yes/no, the ward you live in, and a unique identifier that stops one person from verifying twice.')} />
        <Step n={3} text={t('No name, no address, no document. Your display name stays anonymous, even once verified.')} />
      </Card>

      {devMode && (
        <>
          <Card>
            <ThemedText type="smallBold" style={{ color: theme.warning }}>
              Dev mode (emulator)
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              No Didit in the emulator - pick a ward and simulate a passing verification.
            </ThemedText>
            <View style={styles.wardGrid}>
              {WARDS.map((w) => {
                const selected = wardId === w.id;
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => setWardId(w.id)}
                    style={[
                      styles.wardCell,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.backgroundSelected : theme.background,
                      },
                    ]}>
                    <ThemedText
                      type="small"
                      style={{ fontSize: 12, ...(selected ? { color: theme.primary, fontWeight: '700' as const } : {}) }}>
                      {w.id}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {wardId != null && (
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {wardLabel(wardId)} · {WARDS.find((w) => w.id === wardId)?.areas}
              </ThemedText>
            )}
          </Card>
        </>
      )}

      {priceNote && (
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {priceNote}
        </ThemedText>
      )}
      <Button
        title={
          devMode
            ? 'Simulate verification'
            : mustPay && price
              ? t('Pay {price} and start').replace('{price}', price)
              : t('Start verification with Didit')
        }
        onPress={begin}
        loading={busy}
        disabled={!devMode && (quote == null || (mustPay && !price))}
      />
    </Screen>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepBubble, { backgroundColor: theme.primarySoft }]}>
        <ThemedText type="smallBold" style={{ fontSize: 12, color: theme.primary }}>
          {n}
        </ThemedText>
      </View>
      <ThemedText type="small" style={{ flex: 1 }}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  stepBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  wardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  wardCell: {
    width: 44,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
