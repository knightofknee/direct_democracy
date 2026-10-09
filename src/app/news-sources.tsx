import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Switch, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { NEWS_LANGS, useNewsPrefs, useNewsSources } from '@/lib/news';
import { openLink } from '@/lib/open-link';
import { usePageSummary } from '@/lib/page-help';
import type { NewsSource } from '@/lib/types';

/** Why a newsroom is not on the news tab, in the app's words. */
const STATUS_TEXT: Record<NonNullable<NewsSource['status']>, string> = {
  blocked: "Its site turns away automated feed readers, so its headlines can't be included without its permission.",
  asked: "Its site turns away automated feed readers. We've asked for permission to include its headlines.",
  declined: 'We asked to include its headlines, and it declined.',
};

/**
 * Which newsrooms and story languages the news tab shows, all on until the
 * person turns one off; then the inclusion rule and the newsrooms that are
 * not in, with why. Signed in, the choices follow the account.
 */
export default function NewsSourcesScreen() {
  const t = useT();
  const theme = useTheme();
  const { profile } = useAuth();
  const { sources, loading } = useNewsSources();
  const { hiddenSources, hiddenLangs, setSourceShown, setLangShown, showEverything } = useNewsPrefs();
  const included = sources.filter((s) => s.included);
  const notIncluded = sources.filter((s) => !s.included);

  usePageSummary('news-sources', [
    included.length > 0 &&
      t('Newsrooms included: {n}. Turned off by you: {off}.')
        .replace('{n}', String(included.length))
        .replace('{off}', String(included.filter((s) => hiddenSources.has(s.id)).length)),
    notIncluded.length > 0 && t('Not included: {names}.').replace('{names}', notIncluded.map((s) => s.name).join(', ')),
    profile ? t('Your choices are saved to your account.') : t('Your choices are saved on this device.'),
  ]);

  const row = (key: string, label: string, value: boolean, onChange: (on: boolean) => void, note?: string) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText style={{ fontSize: 15 }}>{label}</ThemedText>
        {note ? (
          <ThemedText type="small" style={{ fontSize: 12, color: theme.warning }}>
            {note}
          </ThemedText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
      />
    </View>
  );

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        {t(
          'Every newsroom that covers Chicago or Illinois government, has a public feed, and is among the million most popular websites (the Tranco list) is here. Every one is on until you turn it off. Stories are listed newest first. The app never ranks them or hides any.'
        )}
      </ThemedText>

      {loading ? (
        <SkeletonCards />
      ) : (
        <>
          <SectionHeader title={t('Newsrooms')} />
          <Card style={{ gap: Spacing.three }}>
            {included.map((s) =>
              row(
                s.id,
                s.name,
                !hiddenSources.has(s.id),
                (on) => setSourceShown(s.id, on),
                s.lastError ? t('Its feed is not answering right now.') : undefined
              )
            )}
          </Card>

          <SectionHeader title={t('Story languages')} subtitle={t('Headlines stay in the language the newsroom wrote them in.')} />
          <Card style={{ gap: Spacing.three }}>
            {NEWS_LANGS.map((l) => row(l.code, l.label, !hiddenLangs.has(l.code), (on) => setLangShown(l.code, on)))}
          </Card>

          {(hiddenSources.size > 0 || hiddenLangs.size > 0) && (
            <Button title={t('Show every source')} variant="secondary" onPress={showEverything} />
          )}

          {notIncluded.length > 0 && (
            <>
              <SectionHeader title={t('Not included')} />
              <Card style={{ gap: Spacing.three }}>
                {notIncluded.map((s) => (
                  <View key={s.id} style={{ gap: 2 }}>
                    <Pressable
                      onPress={() => void openLink(s.homepage)}
                      accessibilityRole="link"
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.one }}>
                      <ThemedText style={{ fontSize: 15, color: theme.primary, fontWeight: '600' }}>{s.name}</ThemedText>
                      <Ionicons name="open-outline" size={13} color={theme.primary} />
                    </Pressable>
                    {s.status ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {t(STATUS_TEXT[s.status])}
                      </ThemedText>
                    ) : null}
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
