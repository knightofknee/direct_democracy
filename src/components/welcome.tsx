import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ChicagoStar } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LANGUAGES, useLocale, useT } from '@/lib/i18n';
import { reopenAfterRedraw } from '@/lib/locale-remount';
import { MAYOR_GAMES } from '@/lib/mayor-games-data';

// v2 (2026-11-09): the welcome is about the mayor games now, so people who
// saw the tab-by-tab one see this once too.
const SEEN_KEY = 'welcome.v2';

/** Everything else the app does, one short line each, under the games. */
const ALSO: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'home', text: "Chicago's top concerns, ranked by the people." },
  { icon: 'location', text: "Your ward: your alderman's grade, meetings, and zoning." },
  { icon: 'newspaper', text: 'Headlines from Chicago newsrooms, newest first.' },
  { icon: 'help-circle-outline', text: 'A "?" on every screen says what you can do there.' },
];

/**
 * The one-time welcome (2026-10-09; rebuilt around the mayor games
 * 2026-11-09, Brian: the games are what the app is until February 23, so
 * the welcome explains them first and everything else second). It is also
 * where the language is chosen: the app opens in English, and the globe in
 * the corner, labeled with the current language's own name, opens every
 * language named in itself. No word "language" to translate, and nobody is
 * made to pick before they can start.
 */
export function Welcome() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const { ready, locale, setLocale } = useLocale();
  const [show, setShow] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (live && !seen) setShow(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [ready]);

  if (!show) return null;
  const close = () => {
    setShow(false);
    AsyncStorage.setItem(SEEN_KEY, new Date().toISOString()).catch(() => {});
  };
  const play = () => {
    close();
    router.push('/game/blind');
  };
  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.background }]}>
          <ScrollView contentContainerStyle={{ gap: Spacing.three }} bounces={false}>
            {/* The globe is the sign every language reads; the name beside
                it is the language the app is in right now. */}
            <Pressable
              onPress={() => setPicking((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={current.name}
              accessibilityState={{ expanded: picking }}
              hitSlop={8}
              style={[styles.language, { borderColor: theme.border }]}>
              <Ionicons name="globe-outline" size={18} color={theme.primary} />
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                {current.name}
              </ThemedText>
              <Ionicons name={picking ? 'chevron-up' : 'chevron-down'} size={14} color={theme.primary} />
            </Pressable>
            {picking && (
              <View style={styles.languages}>
                {LANGUAGES.map((l) => (
                  <Button
                    key={l.code}
                    title={l.name}
                    variant={l.code === locale ? 'primary' : 'secondary'}
                    selected={l.code === locale}
                    // Each name is spoken in its own language.
                    accessibilityLanguage={l.code}
                    onPress={() => {
                      setPicking(false);
                      if (l.code === locale) return;
                      // The navigator redraws in the new language; put it
                      // back on the elections tab under this card.
                      reopenAfterRedraw('/election');
                      setLocale(l.code);
                    }}
                    style={{ flexGrow: 1, flexBasis: '45%' }}
                  />
                ))}
              </View>
            )}

            <View style={{ alignItems: 'center', gap: Spacing.one }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <ChicagoStar size={18} />
                <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
                  {t('the mayor games')}
                </ThemedText>
              </View>
              <ThemedText style={{ textAlign: 'center' }}>
                {t('Chicago picks a mayor on February 23, 2027. Meet everyone running, one game at a time.')}
              </ThemedText>
            </View>

            {MAYOR_GAMES.map((g) => (
              <View key={g.kind} style={styles.line}>
                <Ionicons name={g.icon} size={22} color={theme.accent} style={{ marginTop: 1 }} />
                <ThemedText type="small" style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
                  <ThemedText type="smallBold" style={{ fontSize: 14 }}>
                    {t(g.title)}
                  </ThemedText>
                  {'  '}
                  {t(g.tagline)}
                </ThemedText>
              </View>
            ))}

            <Button
              title={t('Go on a blind date')}
              icon={<Ionicons name="heart" size={16} color="#FFFFFF" />}
              onPress={play}
            />
            <Button title={t('Look around first')} variant="secondary" onPress={close} />

            <View style={{ gap: Spacing.two }}>
              <ThemedText
                type="smallBold"
                themeColor="textSecondary"
                style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                {t('also in the app')}
              </ThemedText>
              {ALSO.map((line) => (
                <View key={line.icon} style={styles.line}>
                  <Ionicons name={line.icon} size={16} color={theme.textSecondary} style={{ marginTop: 2 }} />
                  <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>
                    {t(line.text)}
                  </ThemedText>
                </View>
              ))}
            </View>
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
  language: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: Spacing.three,
  },
  languages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  line: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
});
