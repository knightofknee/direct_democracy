import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { randomDisplayName } from '@/lib/names';
import { updateDisplayName } from '@/services/users';

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [editingName, setEditingName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  if (loading) return <Screen tab>{null}</Screen>;

  if (!user || !profile) {
    return (
      <Screen tab>
        <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
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
      Alert.alert('Could not update name', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <Screen tab>
      <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
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
              {profile.registeredVoter && <Chip label="Registered voter" tone="success" />}
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
          Display names are whatever you want them to be — your real identity is never shown, even
          when verified.
        </ThemedText>
      </Card>

      <SectionHeader title="Identity verification" />
      <Card>
        {profile.verified ? (
          <>
            <ThemedText type="small">
              You’re verified as a resident of the {wardLabel(profile.wardId ?? undefined)}. Your
              votes count in the verified and{' '}
              {profile.registeredVoter ? 'registered-voter' : 'all-user'} tallies.
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText type="small">
              Verify once to unlock your ward tab and make your votes count in the verified tallies.
              A third-party service (Persona) checks your ID — we only ever receive a yes/no, your
              ward, and whether you’re a registered voter. No documents, no address, nothing else.
            </ThemedText>
            <Button title="Verify my identity" onPress={() => router.push('/verify')} />
          </>
        )}
      </Card>

      <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
    </Screen>
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
});
