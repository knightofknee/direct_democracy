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
import { notify } from '@/lib/notify';
import { useTheme } from '@/hooks/use-theme';
import { usingEmulators } from '@/lib/firebase';
import { startVerification } from '@/services/users';

export default function VerifyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [wardId, setWardId] = useState<number | null>(profile?.wardId ?? null);
  const [busy, setBusy] = useState(false);

  if (!profile) {
    return (
      <Screen>
        <Button title="Sign in first" onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  if (profile.verified) {
    return (
      <Screen>
        <Card>
          <View style={{ alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three }}>
            <Ionicons name="shield-checkmark" size={40} color={theme.verified} />
            <ThemedText type="smallBold">You’re verified</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {profile.wardId != null ? `Resident of the ${wardLabel(profile.wardId)}.` : 'Verified Chicago resident.'}
            </ThemedText>
          </View>
        </Card>
      </Screen>
    );
  }

  const begin = async () => {
    if (usingEmulators && wardId == null) {
      notify('Pick a ward', 'Choose the ward you live in to simulate verification.');
      return;
    }
    setBusy(true);
    try {
      const { mode } = await startVerification({ wardId: wardId ?? 1 });
      if (mode === 'dev') {
        notify('Verified (dev)', 'Simulated a passing Didit inquiry against the emulator.');
        if (router.canGoBack()) router.back();
        else router.replace('/ward');
      }
      // In the real Didit flow the webhook flips the profile; the app reacts
      // to the live profile listener, so there's nothing to do here.
    } catch (e) {
      notify('Verification failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <ThemedText type="smallBold">How verification works</ThemedText>
        <Step n={1} text="You verify your ID and Chicago address with Didit, a third-party identity service. Your documents go to them, never to us." />
        <Step n={2} text="All we ever save: a verified yes/no, the ward you live in, and a unique identifier that stops one person from verifying twice." />
        <Step n={3} text="No name, no address, no document. Your display name stays anonymous, even once verified." />
      </Card>

      {usingEmulators && (
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

      <Button
        title={usingEmulators ? 'Simulate verification' : 'Start verification with Didit'}
        onPress={begin}
        loading={busy}
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
