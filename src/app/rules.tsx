import React from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';

/**
 * The community rules, linked quietly from the bottom of Settings (the app
 * stores expect them to exist; nobody needs them in their way). Enforcement
 * is scripts/moderate.ts and the 5-reporter shadowban in onReportCreated.
 */
export default function RulesScreen() {
  const t = useT();
  return (
    <Screen>
      <ThemedText type="subtitle" style={{ fontSize: 24, lineHeight: 30 }}>
        {t('Community rules')}
      </ThemedText>
      <Card>
        <Rule text={t('Keep it about Chicago and the people who govern it.')} />
        <Rule text={t('No threats, harassment, or hate aimed at a person or a group.')} />
        <Rule text={t('No spam, ads, or the same post over and over.')} />
        <Rule text={t('No one’s private information: home addresses, phone numbers, and the like.')} />
        <Rule text={t('Don’t pose as someone else, officials included.')} />
        <Rule text={t('Nothing sexual involving minors. We report it to the authorities.')} />
      </Card>
      <ThemedText type="small" themeColor="textSecondary">
        {t('Reported posts are reviewed every week. Posts that break these rules come down, and serious or repeated cases lose the account. An account reported by 5 or more people is hidden until it is reviewed.')}
      </ThemedText>
    </Screen>
  );
}

function Rule({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' }}>
      <ThemedText type="small" themeColor="textSecondary">
        •
      </ThemedText>
      <ThemedText type="small" style={{ flex: 1 }}>
        {text}
      </ThemedText>
    </View>
  );
}
