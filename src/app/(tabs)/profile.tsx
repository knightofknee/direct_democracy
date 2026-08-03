import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlocks } from '@/hooks/use-blocks';
import { useTheme } from '@/hooks/use-theme';
import { isAdminUser } from '@/lib/admin';
import { nextMilestones } from '@/lib/milestones';
import { randomDisplayName } from '@/lib/names';
import { notify } from '@/lib/notify';
import { unblockUser } from '@/services/moderation';
import { updateDisplayName } from '@/services/users';

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const { blocks } = useBlocks();
  const [editingName, setEditingName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  if (loading) return <Screen tab>{null}</Screen>;

  if (!user || !profile) {
    return (
      <Screen tab>
        <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34, textAlign: 'center' }}>
          profile
        </ThemedText>
        <Card>
          <View style={{ alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three }}>
            <Ionicons name="person-circle-outline" size={44} color={theme.primary} />
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              Sign in to vote on concerns, join ward votes, and hold officials to account.
            </ThemedText>
            <Button title="Sign in or create account" onPress={() => router.push('/sign-in')} />
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
      notify('Could not update name', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <Screen tab>
      <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34, textAlign: 'center' }}>
        profile
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
                <Chip label="Unverified" tone="neutral" icon="shield-outline" />
              )}
              {profile.role === 'official' && <Chip label="Elected official" tone="primary" icon="ribbon" />}
              {profile.wardId != null && <Chip label={wardLabel(profile.wardId)} />}
            </View>
          </View>
        </View>

        {editingName === null ? (
          <Button title="Edit display name" variant="secondary" onPress={() => setEditingName(profile.displayName)} />
        ) : (
          <View style={{ gap: Spacing.two }}>
            <Field value={editingName} onChangeText={setEditingName} autoFocus maxLength={30} />
            <View style={styles.buttonRow}>
              <Button
                title="Shuffle"
                variant="secondary"
                onPress={() => setEditingName(randomDisplayName())}
                style={{ flex: 1 }}
              />
              <Button
                title="Save"
                onPress={() => saveName(editingName)}
                loading={savingName}
                style={{ flex: 1 }}
              />
            </View>
            <Button title="Cancel" variant="ghost" onPress={() => setEditingName(null)} />
          </View>
        )}
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          Display names are whatever you want them to be - your real identity is never shown, even
          when verified.
        </ThemedText>
      </Card>

      <SectionHeader title="Civic record" subtitle="Counted as you participate - milestones celebrate along the way" />
      <Card>
        <View style={styles.statsGrid}>
          <StatTile label="Concerns" value={profile.stats?.concerns ?? 0} icon="megaphone" />
          <StatTile label="Comments" value={profile.stats?.comments ?? 0} icon="chatbubble" />
          <StatTile label="Votes" value={profile.stats?.votes ?? 0} icon="checkbox" />
          <StatTile label="Judgments" value={profile.stats?.judgments ?? 0} icon="scale" />
        </View>
        {nextMilestones(profile.stats ?? { concerns: 0, comments: 0, votes: 0, judgments: 0 })
          .slice(0, 2)
          .map((m) => (
            <View key={m.label} style={{ gap: 3 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                  {m.label} - next milestone
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                  {m.current} / {m.target}
                </ThemedText>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: theme.primary,
                      width: `${Math.min(100, Math.round((m.current / m.target) * 100))}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
      </Card>

      <Button title="My activity" variant="secondary" onPress={() => router.push('/my-activity')} />
      {isAdminUser(user) && (
        <Button title="Review reports (admin)" variant="secondary" onPress={() => router.push('/admin')} />
      )}

      <SectionHeader title="Identity verification" />
      <Card>
        {profile.verified ? (
          <>
            <ThemedText type="small">
              You’re verified as a{' '}
              {profile.wardId != null ? `resident of the ${wardLabel(profile.wardId)}` : 'Chicago resident'}
              . Your votes count in the verified tallies.
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText type="small">
              Verify once to unlock your ward tab and make your votes count in the verified tallies.
              A third-party service (Persona) checks your ID. We only ever receive a yes/no and
              your ward. No documents, no address, nothing else.
            </ThemedText>
            <Button title="Verify my identity" onPress={() => router.push('/verify')} />
          </>
        )}
      </Card>

      {blocks.length > 0 && (
        <>
          <SectionHeader
            title="Blocked users"
            subtitle="Their content is hidden for you - unblock any time"
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
                  title="Unblock"
                  variant="ghost"
                  onPress={() =>
                    profile &&
                    unblockUser(profile, b.id).catch((e) => notify(
                      'Could not unblock',
                      e instanceof Error ? e.message : 'Something went wrong.'
                    ))
                  }
                />
              </View>
            ))}
          </Card>
        </>
      )}

      <Button title="Settings" variant="ghost" onPress={() => router.push('/settings')} />
      <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
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
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
