import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { WARDS, wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { usePageSummary } from '@/lib/page-help';
import { notify, notifyError } from '@/lib/notify';
import { openLink } from '@/lib/open-link';
import { formatWhen, wardLockedUntil } from '@/lib/ward-posting';
import { declareWard } from '@/services/users';

const WARD_LOOKUP = 'https://www.chicago.gov/city/en/depts/mayor/iframe/lookup_ward_and_alderman.html';

/**
 * Set or change a home ward without verifying: first how it works (free to
 * change until you post there, then locked for a week or 3 months), then
 * the picker. The server enforces the lock (declareWard); this screen says
 * it plainly first. Someone changing an existing ward skips straight to the
 * picker, they have read the rules already.
 */
export default function SetWardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT();
  const { profile } = useAuth();
  const [step, setStep] = useState<'rules' | 'pick'>(profile?.wardId != null ? 'pick' : 'rules');
  const [wardId, setWardId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  usePageSummary('set-ward', [
    !profile
      ? t('You are signed out.')
      : profile.wardId == null
        ? t('You have no home ward yet.')
        : t(profile.verified ? 'Your home ward: the {ward}, verified.' : 'Your home ward: the {ward}, set without an ID.').replace(
            '{ward}',
            wardLabel(profile.wardId)
          ),
  ]);

  if (!profile) {
    return (
      <Screen>
        <Button title={t('Sign in first')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  const lockedUntil = wardLockedUntil(profile);

  // A ward that isn't this screen's to change: the one on a verified ID, an
  // official's, or a declared one locked by posting there.
  if (profile.wardId != null && (profile.verified || profile.role === 'official' || lockedUntil)) {
    return (
      <Screen>
        <Card>
          <ThemedText type="smallBold">
            {t('Your home ward is the {ward}.').replace('{ward}', wardLabel(profile.wardId))}
          </ThemedText>
          {lockedUntil && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {t('You’ve posted there, so it stays until {date}. Verifying your residency changes it sooner: it places you in the ward on your ID.').replace('{date}', formatWhen(lockedUntil, false))}
              </ThemedText>
              <Button title={t('Verify your residency')} onPress={() => router.replace('/verify')} />
            </>
          )}
        </Card>
      </Screen>
    );
  }

  if (step === 'rules') {
    return (
      <Screen>
        <Card>
          <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
            <Ionicons name="information-circle" size={22} color={theme.primary} />
            <ThemedText type="smallBold" style={{ flex: 1 }}>
              {t('How your home ward works')}
            </ThemedText>
          </View>
          <Point text={t('You can change it until you post there, up to 5 times a day.')} />
          <Point text={t('Two posts there (concerns or questions to your alderman) lock it for a week. A third locks it for 3 months.')} />
          <Point text={t('In your home ward you can post up to 3 times a day, vote on ward polls, and rate your alderman. Your votes count with everyone’s, not in the verified tally.')} />
          <Point text={t('In any other ward you can post once a week.')} />
          <Point text={t('Verifying your residency checks your ID with Didit and places you in the ward on it, replacing the one you set here.')} />
        </Card>
        <Button title={t('Next')} onPress={() => setStep('pick')} />
      </Screen>
    );
  }

  const changing = profile.wardId != null;
  const set = async () => {
    if (wardId == null || wardId === profile.wardId) return;
    setSaving(true);
    try {
      await declareWard(wardId);
      notify(t('Home ward set'), t('You’re in the {ward}.').replace('{ward}', wardLabel(wardId)));
      // Dismiss the modal first: a bare replace() from inside a native modal
      // can land on whatever screen sat under it.
      if (router.canDismiss()) router.dismiss();
      router.navigate('/ward');
    } catch (e) {
      if ((e as { code?: string }).code === 'functions/resource-exhausted') {
        notify(t('Could not set your home ward'), t('You can change your home ward up to 5 times a day. Try again tomorrow.'));
        return;
      }
      notifyError(t('Could not set your home ward'), e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Card>
        <ThemedText type="smallBold">{t('Pick your home ward')}</ThemedText>
        {changing && (
          <ThemedText type="small" themeColor="textSecondary">
            {t('Your home ward is the {ward}.').replace('{ward}', wardLabel(profile.wardId))}
          </ThemedText>
        )}
        <Pressable onPress={() => openLink(WARD_LOOKUP)} hitSlop={6} accessibilityRole="link">
          <ThemedText type="small" style={{ color: theme.primary }}>
            {t('Not sure of your ward? Look up your address')}
          </ThemedText>
        </Pressable>
        <View style={styles.grid}>
          {WARDS.map((w) => {
            const selected = wardId === w.id;
            return (
              <Pressable
                key={w.id}
                onPress={() => setWardId(w.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={wardLabel(w.id)}
                style={[
                  styles.cell,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.backgroundSelected : theme.background,
                  },
                ]}>
                <ThemedText
                  type="small"
                  style={{ fontSize: 13, ...(selected ? { color: theme.primary, fontWeight: '700' as const } : {}) }}>
                  {w.id}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        {wardId != null && (
          <ThemedText type="small" themeColor="textSecondary">
            {wardLabel(wardId)} · {WARDS.find((w) => w.id === wardId)?.areas}
          </ThemedText>
        )}
      </Card>
      <Button
        title={t(changing ? 'Change home ward' : 'Set home ward')}
        onPress={set}
        loading={saving}
        disabled={wardId == null || wardId === profile.wardId}
      />
    </Screen>
  );
}

function Point({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' }}>
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        •
      </ThemedText>
      <ThemedText type="small" style={{ flex: 1 }}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cell: {
    width: 44,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
