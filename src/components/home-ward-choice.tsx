import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useT } from '@/lib/i18n';
import type { UserProfile } from '@/lib/types';
import { formatWhen, wardLockedUntil } from '@/lib/ward-posting';

/**
 * The two ways into a ward, offered side by side wherever the app used to
 * say "verify": verify residency with an ID (votes count as verified), or
 * set a home ward without one (full participation, all-users tally). Only
 * for signed-in accounts with no ward yet; a declared ward gets
 * DeclaredWardNote instead.
 */
export function HomeWardChoice({ note }: { note?: string }) {
  const router = useRouter();
  const t = useT();
  const { profile } = useAuth();
  // Neither door opens for an official account: it keeps the ward (or the
  // citywide office) it was set up with.
  if (profile?.role === 'official') {
    return (
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {t('Official accounts keep the ward they were set up with.')}
      </ThemedText>
    );
  }
  return (
    <View style={{ gap: Spacing.two }}>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {note}
        </ThemedText>
      ) : null}
      <Button title={t('Verify your residency')} variant="secondary" onPress={() => router.push('/verify')} />
      <Button title={t('Set your home ward')} variant="secondary" onPress={() => router.push('/set-ward')} />
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {t('No ID needed to set a home ward. Verified residents also count in the verified tallies.')}
      </ThemedText>
    </View>
  );
}

/**
 * An unverified account's declared ward: what it is, the way to verify, and
 * either the way to change it or, once posting there has locked it, until
 * when (declareWard enforces the same lock).
 */
export function DeclaredWardNote({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const t = useT();
  const lockedUntil = wardLockedUntil(profile);
  return (
    <View style={{ gap: Spacing.two }}>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {t('Your home ward is the {ward}, set without verification. Verify your residency to make your votes count in the verified tallies; verifying places you in the ward on your ID.').replace('{ward}', wardLabel(profile.wardId))}
      </ThemedText>
      <Button title={t('Verify your residency')} onPress={() => router.push('/verify')} />
      {lockedUntil ? (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('You’ve posted in your home ward, so you can change it on {date}.').replace('{date}', formatWhen(lockedUntil, false))}
        </ThemedText>
      ) : (
        <Button title={t('Change home ward')} variant="secondary" onPress={() => router.push('/set-ward')} />
      )}
    </View>
  );
}
