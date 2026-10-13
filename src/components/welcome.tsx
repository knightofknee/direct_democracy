import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLocale, useT } from '@/lib/i18n';

const SEEN_KEY = 'welcome.v1';

const LINES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'home', title: 'home', body: "Chicago's top concerns, ranked by the people, plus citywide polls and City Council." },
  { icon: 'location', title: 'wards', body: "Your ward's concerns, your alderman's grade, and its meetings, zoning hearings, and ward office." },
  { icon: 'newspaper', title: 'news', body: 'Headlines from Chicago newsrooms, newest first.' },
  { icon: 'ribbon', title: 'election', body: 'Who is on your ballot, and My ballot to plan your picks.' },
  { icon: 'help-circle-outline', title: '?', body: 'On every screen: what is there and what you can do.' },
];

/**
 * A one-time welcome (2026-10-09, from tester feedback that new users
 * needed a guide): one line per tab and a pointer to the "?" on every
 * screen, shown once after the language is chosen. People updating from
 * an older version see it once too, which is how they hear about the news
 * tab and the bell.
 */
export function Welcome() {
  const theme = useTheme();
  const t = useT();
  const { ready, prompted } = useLocale();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!ready || !prompted) return;
    let live = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (live && !seen) setShow(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [ready, prompted]);

  if (!show) return null;
  const close = () => {
    setShow(false);
    AsyncStorage.setItem(SEEN_KEY, new Date().toISOString()).catch(() => {});
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.background }]}>
          <ScrollView contentContainerStyle={{ gap: Spacing.three }} bounces={false}>
            <ThemedText type="smallBold" style={styles.title} accessibilityRole="header">
              {t('Welcome to direct democracy')}
            </ThemedText>
            {LINES.map((line) => (
              <View key={line.title} style={styles.line}>
                <Ionicons name={line.icon} size={22} color={theme.primary} style={{ marginTop: 1 }} />
                <ThemedText type="small" style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
                  <ThemedText type="smallBold" style={{ fontSize: 14 }}>
                    {line.title === '?' ? '?' : t(line.title)}
                  </ThemedText>
                  {'  '}
                  {t(line.body)}
                </ThemedText>
              </View>
            ))}
            <Button title={t('Got it')} onPress={close} />
          </ScrollView>
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '100%',
    borderRadius: 16,
    padding: Spacing.four,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
  },
  line: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
});
