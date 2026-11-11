import React from 'react';

import { ThemedText } from '@/components/themed-text';
import { Card, Chip } from '@/components/ui';
import { WRITE_IN } from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { openLink } from '@/lib/open-link';
import { useTheme } from '@/hooks/use-theme';

/** The chip that marks a declared write-in wherever a candidate is listed. */
export function WriteInChip() {
  const t = useT();
  return <Chip label={t('Write-in')} icon="create-outline" tone="warning" />;
}

/**
 * Heads the write-in group on a race: just the title, starred (2026-10-13:
 * the explainer above the cards buried them); `WriteInFootnote` under the
 * group says what the star means.
 */
export function WriteInHeader() {
  const t = useT();
  return (
    <ThemedText type="smallBold" style={{ textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.two }}>
      {t('Write-in candidates')}*
    </ThemedText>
  );
}

/** Under the write-in group: what a write-in is and how to cast one. */
export function WriteInFootnote() {
  const t = useT();
  return (
    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
      * {t(WRITE_IN.explainer)}
    </ThemedText>
  );
}

/** The same explainer on a write-in's own card, with the Board's page. */
export function WriteInNote() {
  const t = useT();
  const theme = useTheme();
  return (
    <Card>
      <ThemedText type="small" style={{ fontSize: 13, lineHeight: 19 }}>
        {t(WRITE_IN.explainer)}
      </ThemedText>
      <ThemedText
        type="smallBold"
        style={{ color: theme.primary, fontSize: 13 }}
        onPress={() => openLink(WRITE_IN.url)}
        accessibilityRole="link">
        {t(WRITE_IN.urlLabel)}
      </ThemedText>
    </Card>
  );
}
