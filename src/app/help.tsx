import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { pageHelp, pageSummary } from '@/lib/page-help';

/**
 * The help sheet the "?" opens (2026-09-30): what the page underneath
 * shows, a summary of what is on it right now (from the page's own data,
 * usePageSummary), and what can be done there.
 */
export default function HelpScreen() {
  const t = useT();
  const { profile } = useAuth();
  const { page } = useLocalSearchParams<{ page?: string }>();
  const help = page ? pageHelp(page, profile?.role) : undefined;
  const live = page ? pageSummary(page) : [];

  if (!help) {
    return (
      <Screen>
        <ThemedText type="small" themeColor="textSecondary">
          {t('There is no help for this page yet.')}
        </ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <ThemedText type="smallBold" style={styles.heading}>
          {t('On this page')}
        </ThemedText>
        <ThemedText type="small" style={styles.body}>
          {t(help.what)}
        </ThemedText>
        {live.length > 0 && (
          <View style={{ gap: 6 }}>
            {live.map((line, i) => (
              <Bullet key={i} text={line} />
            ))}
          </View>
        )}
      </Card>
      <Card>
        <ThemedText type="smallBold" style={styles.heading}>
          {t('What you can do')}
        </ThemedText>
        <View style={{ gap: Spacing.two }}>
          {help.can.map((line) => (
            <Bullet key={line} text={t(line)} />
          ))}
        </View>
      </Card>
    </Screen>
  );
}

function Bullet({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.bullet}>
      <View style={[styles.dot, { backgroundColor: theme.primary }]} />
      <ThemedText type="small" style={[styles.body, { flex: 1 }]}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 15,
    lineHeight: 20,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  bullet: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
});
