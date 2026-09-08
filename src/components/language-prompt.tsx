import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLocale } from '@/lib/i18n';

/**
 * Asked once, ever, on first launch: which language. Both languages appear
 * in full so nobody has to read the wrong one to find the right one; the
 * choice is changeable any time in Settings. No dismiss without choosing,
 * because "later" would just mean English by default for Spanish speakers.
 */
export function LanguagePrompt() {
  const theme = useTheme();
  const { ready, prompted, setLocale } = useLocale();
  if (!ready || prompted) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.background }]}>
          <ThemedText type="smallBold" style={styles.title}>
            Choose your language
          </ThemedText>
          <ThemedText type="smallBold" style={styles.title}>
            Elige tu idioma
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            You can change this any time in Settings. · Puedes cambiarlo cuando quieras en Ajustes.
          </ThemedText>
          <Pressable
            onPress={() => setLocale('en')}
            accessibilityRole="button"
            style={[styles.choice, { backgroundColor: theme.primary }]}>
            <ThemedText type="smallBold" style={styles.choiceText}>
              English
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setLocale('es')}
            accessibilityRole="button"
            style={[styles.choice, { backgroundColor: theme.primary }]}>
            <ThemedText type="smallBold" style={styles.choiceText}>
              Español
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
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  choice: {
    alignSelf: 'stretch',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  choiceText: {
    color: '#fff',
    fontSize: 17,
  },
});
