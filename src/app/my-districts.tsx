import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import type { Districts } from '@/constants/ward-districts';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { findMyDistricts, type FindDistrictsResult } from '@/lib/districts';
import { useT } from '@/lib/i18n';
import { usePageSummary } from '@/lib/page-help';
import { notify, notifyError } from '@/lib/notify';

/** Each district type as the list below names it, in ballot order. */
const ROWS: { type: keyof Districts; label: string }[] = [
  { type: 'usHouse', label: 'US House' },
  { type: 'ilSenate', label: 'Illinois Senate' },
  { type: 'ilHouse', label: 'Illinois House' },
  { type: 'cookCommissioner', label: 'Cook County Commissioner' },
  { type: 'boardOfReview', label: 'Board of Review' },
  { type: 'subcircuit', label: 'Judicial subcircuit' },
  { type: 'schoolBoard', label: 'School board' },
  { type: 'police', label: 'Police district' },
];

/**
 * Find your districts from your home address (findMyDistricts), so the
 * election tab shows your own races first. A match goes straight back to
 * the ballot, where "Your races" lists them. The server keeps the district
 * numbers only; the address goes to the Census geocoder and is dropped.
 */
export default function MyDistrictsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const { profile } = useAuth();
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [miss, setMiss] = useState<Exclude<FindDistrictsResult, { result: 'ok' }> | null>(null);

  usePageSummary('my-districts', [
    profile?.districts
      ? t('Districts on file, from an address in the {ward}.').replace('{ward}', wardLabel(profile.districts.wardId))
      : t('No address on file yet.'),
  ]);

  if (!profile) {
    return (
      <Screen>
        <Button title={t('Sign in first')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  const found = profile.districts;

  const find = async () => {
    if (busy) return;
    setBusy(true);
    setMiss(null);
    try {
      const r = await findMyDistricts(address.trim());
      if (r.result === 'ok') {
        // Straight back to the ballot, where "Your races" now lists them.
        setAddress('');
        if (router.canGoBack()) router.back();
        else router.replace('/election');
        return;
      }
      setMiss(r);
    } catch (e) {
      if ((e as { code?: string }).code === 'functions/resource-exhausted') {
        notify(t('Could not look up that address'), t('You can look up 5 addresses a day. Try again tomorrow.'));
        return;
      }
      notifyError(t('Could not look up that address'), e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {found && (
        <Card>
          <ThemedText type="smallBold">
            {t('Your districts ({ward})').replace('{ward}', wardLabel(found.wardId))}
          </ThemedText>
          <View style={{ gap: 6 }}>
            {ROWS.map((row) => (
              <View key={row.type} style={{ flexDirection: 'row', gap: Spacing.two }}>
                <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                  {t(row.label)}
                </ThemedText>
                <ThemedText type="smallBold">{String(found[row.type])}</ThemedText>
              </View>
            ))}
          </View>
        </Card>
      )}

      <Card>
        <ThemedText type="smallBold">{t(found ? 'Use a different address' : 'Your home address')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('Your ballot depends on your address, not just your ward. We send it to the US Census Bureau to place it on the map and keep only your district numbers, never the address.')}
        </ThemedText>
        <Field
          value={address}
          onChangeText={(v) => {
            setAddress(v);
            setMiss(null);
          }}
          placeholder={t('1234 N Clark St')}
          accessibilityLabel={t('Your home address')}
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          autoCapitalize="words"
          returnKeyType="search"
          onSubmitEditing={() => !busy && address.trim().length >= 5 && void find()}
          maxLength={200}
        />
        {miss && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {miss.result === 'notFound'
              ? t('We couldn’t find that address. Check the street number and name.')
              : miss.result === 'outside'
                ? t('That address is outside Chicago.')
                : t(
                    miss.verified
                      ? 'That address is in the {ward}, and your verified ward is the {home}. If you moved, verify your new address in Settings.'
                      : 'That address is in the {ward}, and your home ward is the {home}. Change your home ward first, then look up the address.'
                  )
                    .replace('{ward}', wardLabel(miss.wardId))
                    .replace('{home}', wardLabel(profile.wardId))}
          </ThemedText>
        )}
        {miss?.result === 'otherWard' && (
          <Button
            title={t(miss.verified ? 'Open Settings' : 'Change home ward')}
            variant="secondary"
            onPress={() => router.push(miss.verified ? '/settings' : '/set-ward')}
          />
        )}
      </Card>
      <Button
        title={t('Find my districts')}
        onPress={() => void find()}
        loading={busy}
        disabled={address.trim().length < 5}
      />
    </Screen>
  );
}
