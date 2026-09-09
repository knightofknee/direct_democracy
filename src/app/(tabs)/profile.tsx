import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc } from 'firebase/firestore';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FlagAccent } from '@/components/flag-accent';
import { CandidateRow, OfficialRow } from '@/components/politician-row';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ChicagoStar, Chip, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlocks } from '@/hooks/use-blocks';
import { useLiveDoc } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { isAdminUser } from '@/lib/admin';
import { db } from '@/lib/firebase';
import { plural } from '@/lib/format';
import { randomDisplayName } from '@/lib/names';
import { notify } from '@/lib/notify';
import type { Candidate, Official } from '@/lib/types';
import { unblockUser } from '@/services/moderation';
import { updateDisplayName } from '@/services/users';
import { usePlural, useT } from '@/lib/i18n';

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const t = useT();
  const pluralT = usePlural();
  const { blocks } = useBlocks();
  const [editingName, setEditingName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  // Politicians see their own public card - the same row voters get on the
  // ward and election tabs - so they know how they're being presented.
  const { data: officialCard } = useLiveDoc<Official>(
    () => (profile?.role === 'official' ? doc(db, 'officials', profile.uid) : null),
    [profile?.role, profile?.uid]
  );
  const { data: candidateCard } = useLiveDoc<Candidate>(
    () => (profile?.role === 'candidate' ? doc(db, 'candidates', profile.uid) : null),
    [profile?.role, profile?.uid]
  );

  if (loading)
    return (
      <Screen tab>
        <SkeletonCards />
      </Screen>
    );

  if (!user || !profile) {
    return (
      <Screen tab>
        <View style={{ gap: Spacing.one, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <ChicagoStar size={18} />
            <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
              {t('profile')}
            </ThemedText>
          </View>
          <FlagAccent />
        </View>
        <Card>
          <View style={{ alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three }}>
            <Ionicons name="person-circle-outline" size={44} color={theme.primary} />
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {t('Sign in to vote on concerns, join ward votes, and hold officials to account.')}
            </ThemedText>
            <Button title={t('Sign in or create account')} onPress={() => router.push('/sign-in')} />
          </View>
        </Card>
      </Screen>
    );
  }

  const saveName = async (name: string) => {
    setSavingName(true);
    try {
      await updateDisplayName(profile.uid, name);
      setEditingName(null);
    } catch (e) {
      notify(t('Could not update name'), e instanceof Error ? e.message : t('Something went wrong.'));
    } finally {
      setSavingName(false);
    }
  };

  return (
    <Screen tab>
      <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34, textAlign: 'center' }}>
        {t('profile')}
      </ThemedText>

      <Card>
        <View style={styles.nameRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText type="smallBold" style={{ fontSize: 18, lineHeight: 24 }}>
              {profile.displayName}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
              {profile.verified ? (
                <VerifiedBadge />
              ) : (
                <Chip label={t('Unverified')} tone="neutral" icon="shield-outline" />
              )}
              {profile.role === 'official' && <Chip label={t('Elected official')} tone="primary" icon="ribbon" />}
              {profile.role === 'candidate' && <Chip label={t('Candidate')} tone="primary" icon="ribbon" />}
              {profile.wardId != null && <Chip label={wardLabel(profile.wardId)} />}
            </View>
          </View>
        </View>

        {editingName === null ? (
          <Button title={t('Edit display name')} variant="secondary" onPress={() => setEditingName(profile.displayName)} />
        ) : (
          <View style={{ gap: Spacing.two }}>
            <Field value={editingName} onChangeText={setEditingName} autoFocus maxLength={30} />
            <View style={styles.buttonRow}>
              <Button
                title={t('Shuffle')}
                variant="secondary"
                onPress={() => setEditingName(randomDisplayName())}
                style={{ flex: 1 }}
              />
              <Button
                title={t('Save')}
                onPress={() => saveName(editingName)}
                loading={savingName}
                style={{ flex: 1 }}
              />
            </View>
            <Button title={t('Cancel')} variant="ghost" onPress={() => setEditingName(null)} />
          </View>
        )}
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('Display names are whatever you want them to be - your real identity is never shown, even when verified.')}
        </ThemedText>
      </Card>

      {(officialCard || candidateCard) && (
        <>
          <SectionHeader
            title={t('Your public card')}
            subtitle={t('How voters see you - tap to open your page')}
          />
          {officialCard && <OfficialRow official={officialCard} />}
          {candidateCard && <CandidateRow candidate={candidateCard} />}
        </>
      )}

      <SectionHeader title={t('Civic record')} />
      <Card>
        <View style={styles.statsGrid}>
          <StatTile label={t('Concerns')} value={profile.stats?.concerns ?? 0} icon="megaphone" />
          <StatTile label={t('Comments')} value={profile.stats?.comments ?? 0} icon="chatbubble" />
          <StatTile label={t('Votes')} value={profile.stats?.votes ?? 0} icon="checkbox" />
          <StatTile label={t('Judgments')} value={profile.stats?.judgments ?? 0} icon="scale" />
        </View>
        {(profile.stats?.credits ?? 0) > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="pencil" size={13} color={theme.verified} />
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, flex: 1 }}>
              {pluralT(profile.stats!.credits!, 'writing credit')} - {t('candidates changed a policy because of your comments.')}
            </ThemedText>
          </View>
        )}
      </Card>

      <Button title={t('My activity')} variant="secondary" onPress={() => router.push('/my-activity')} />
      {isAdminUser(user) && (
        <Button title="Review reports (admin)" variant="secondary" onPress={() => router.push('/admin')} />
      )}

      <SectionHeader title={t('Identity verification')} />
      <Card>
        {profile.verified ? (
          <>
            <ThemedText type="small">
              {profile.wardId != null
                ? t('You’re verified as a resident of the {ward}. Your votes count in the verified tallies.').replace('{ward}', wardLabel(profile.wardId))
                : t('You’re verified as a Chicago resident. Your votes count in the verified tallies.')}
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText type="small">
              {t('Verify once to unlock your ward tab and make your votes count in the verified tallies. A third-party service (Didit) checks your ID. We only ever receive a yes/no and your ward. No documents, no address, nothing else.')}
            </ThemedText>
            <Button title={t('Verify my identity')} onPress={() => router.push('/verify')} />
          </>
        )}
      </Card>

      {blocks.length > 0 && (
        <>
          <SectionHeader
            title={t('Blocked users')}
            subtitle={t('Their content is hidden for you - unblock any time')}
          />
          <Card>
            {blocks.map((b) => (
              <View
                key={b.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <ThemedText type="small" style={{ flex: 1 }}>
                  {b.displayName}
                </ThemedText>
                <Button
                  title={t('Unblock')}
                  variant="ghost"
                  onPress={() =>
                    profile &&
                    unblockUser(profile, b.id).catch((e) => notify(
                      t('Could not unblock'),
                      e instanceof Error ? e.message : t('Something went wrong.')
                    ))
                  }
                />
              </View>
            ))}
          </Card>
        </>
      )}

      <Button title={t('Settings')} variant="ghost" onPress={() => router.push('/settings')} />
      <Button title={t('Sign out')} variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.statTile, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <Ionicons name={icon} size={14} color={theme.primary} />
      <ThemedText type="smallBold" style={{ fontSize: 18, lineHeight: 24 }}>
        {value.toLocaleString()}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
  },
});
