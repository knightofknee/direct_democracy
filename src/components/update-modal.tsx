import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  checkForAppUpdate,
  isSnoozed,
  loadDismissRecord,
  saveDismissRecord,
  type AppUpdateInfo,
} from '@/lib/app-update';

// Minimum gap between config checks. Foreground events fire constantly during
// normal use; one check per half hour keeps the prompt near-immediate once a
// release is flipped live without hammering Firestore.
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Root-mounted nudge shown when the installed binary is behind
 * config/app.latestVersion (see src/lib/app-update.ts for why the source of
 * truth is our own config doc, not the store). App Store updates aren't
 * actually automatic for everyone (auto-update can be off or delayed), and
 * the goal is getting fixes to active users fast - so this checks at launch
 * AND on every app foreground (throttled), not just at cold start. iOS apps
 * stay resident for days; waiting for a cold start would add days on top of
 * Apple review.
 *
 * Purely a suggestion: Update deep-links to the store listing, and either
 * button snoozes the nudge for a day (persisted across relaunches; a later,
 * newer release re-prompts immediately). One nag per day, but nagging resumes
 * until the user is actually current.
 */
export function UpdateModal() {
  const theme = useTheme();
  const [info, setInfo] = useState<AppUpdateInfo | null>(null);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    let unmounted = false;

    async function runCheck() {
      if (Date.now() - lastCheckRef.current < CHECK_INTERVAL_MS) return;
      lastCheckRef.current = Date.now();
      const result = await checkForAppUpdate();
      if (unmounted || !result) return;
      const dismissed = await loadDismissRecord();
      if (unmounted || isSnoozed(result.latestVersion, dismissed, Date.now())) return;
      setInfo(result);
    }

    runCheck();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runCheck();
    });
    return () => {
      unmounted = true;
      sub.remove();
    };
  }, []);

  if (!info) return null;

  const openStore = () => {
    // A store visit earns the same day of quiet as Close: whether they update
    // or bail, re-nagging sooner is noise.
    saveDismissRecord(info.latestVersion);
    Linking.openURL(info.storeUrl).catch(() => {});
  };

  const dismiss = () => {
    saveDismissRecord(info.latestVersion);
    setInfo(null);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.background }]}>
          <ThemedText style={styles.emoji}>⬆️</ThemedText>
          <ThemedText type="smallBold" style={styles.title}>
            Update available
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            A newer version of direct democracy is on the store. Update now for
            the latest fixes and features.
          </ThemedText>
          <Button title="Update" onPress={openStore} style={styles.updateButton} />
          <Pressable
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={styles.closeButton}>
            <ThemedText type="small" themeColor="textSecondary">
              Close
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: Spacing.five,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
  },
  emoji: {
    fontSize: 40,
    lineHeight: 46,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  // The one action we want taken: full width, visually loudest on the card.
  updateButton: {
    alignSelf: 'stretch',
  },
  // Quiet escape hatch, visually subordinate to Update.
  closeButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
});
