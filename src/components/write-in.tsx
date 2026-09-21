import React from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Chip } from '@/components/ui';
import { WRITE_IN_2026 } from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { openLink } from '@/lib/open-link';
import { useTheme } from '@/hooks/use-theme';

/** The chip that marks a declared write-in wherever a candidate is listed. */
export function WriteInChip() {
  const t = useT();
  return <Chip label={t('Write-in')} icon="create-outline" tone="warning" />;
}

/** Heads the write-in group on a race: what a write-in is and how to cast one. */
export function WriteInHeader() {
  const t = useT();
  return (
    <View style={{ gap: 2, marginTop: Spacing.two }}>
      <ThemedText type="smallBold" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
        {t('Write-in candidates')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
        {t(WRITE_IN_2026.explainer)}
      </ThemedText>
    </View>
  );
}

/** The same explainer on a write-in's own card, with the Board's page. */
export function WriteInNote() {
  const t = useT();
  const theme = useTheme();
  return (
    <Card>
      <ThemedText type="small" style={{ fontSize: 13, lineHeight: 19 }}>
        {t(WRITE_IN_2026.explainer)}
      </ThemedText>
      <ThemedText
        type="smallBold"
        style={{ color: theme.primary, fontSize: 13 }}
        onPress={() => openLink(WRITE_IN_2026.url)}
        accessibilityRole="link">
        {t(WRITE_IN_2026.urlLabel)}
      </ThemedText>
    </Card>
  );
}
