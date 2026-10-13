import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { FlagAccent } from '@/components/flag-accent';
import { NewsRow } from '@/components/news';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ChicagoStar, EmptyState } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { useT } from '@/lib/i18n';
import { useNewsPrefs, useNewsSources, visibleNews } from '@/lib/news';
import { usePageSummary } from '@/lib/page-help';
import type { NewsItem } from '@/lib/types';

const PAGE = 30;

/**
 * The news tab (2026-10-07): every included newsroom's headlines, newest
 * first, never ranked. "Your ward" narrows it to stories naming the home
 * ward. Sources and languages are each person's own choice (news-sources).
 */
export default function NewsScreen() {
  const router = useRouter();
  const t = useT();
  const theme = useTheme();
  const { profile } = useAuth();
  const homeWard = profile?.wardId ?? null;
  const [wardOnly, setWardOnly] = useState(false);
  const [count, setCount] = useState(PAGE);
  /** How many stories were on hand when "Show more" was last tapped, and under which filter. */
  const [asked, setAsked] = useState({ key: '', n: 0 });
  const { sources } = useNewsSources();
  const { hiddenSources, hiddenLangs, showEverything } = useNewsPrefs();

  const included = sources.filter((s) => s.included);
  const shownSources = included.filter((s) => !hiddenSources.has(s.id));
  const notIncluded = sources.filter((s) => !s.included);
  const byWard = wardOnly && homeWard != null;
  // With sources turned off, the query asks for the rest by name (Firestore
  // takes up to 30), so a page is never mostly stories that get filtered out.
  const pick = hiddenSources.size > 0 && shownSources.length > 0 && shownSources.length <= 30
    ? shownSources.map((s) => s.id)
    : null;
  const { data, loading } = useLiveQuery<NewsItem>(
    () =>
      byWard
        ? query(
            collection(db, 'newsItems'),
            where('wardIds', 'array-contains', homeWard),
            orderBy('publishedAt', 'desc'),
            limit(count)
          )
        : pick
          ? query(collection(db, 'newsItems'), where('sourceId', 'in', pick), orderBy('publishedAt', 'desc'), limit(count))
          : query(collection(db, 'newsItems'), orderBy('publishedAt', 'desc'), limit(count)),
    [byWard, homeWard, pick?.join(','), count]
  );
  // "Show more" asks for a longer page, and a new query starts out empty.
  // Until it lands, the stories already on screen stay (same filter only),
  // so the list never collapses to the loading cards and drops the reader
  // back at the top.
  const filterKey = `${byWard}|${homeWard}|${pick?.join(',') ?? ''}`;
  const [kept, setKept] = useState<{ key: string; data: NewsItem[] }>({ key: '', data: [] });
  if (!loading && (kept.key !== filterKey || kept.data !== data)) setKept({ key: filterKey, data });
  const rows = loading && kept.key === filterKey ? kept.data : data;
  const items = visibleNews(rows, hiddenSources, hiddenLangs);
  const names = new Map(sources.map((s) => [s.id, s.name]));
  const allOff = included.length > 0 && shownSources.length === 0;
  const turnedOff = hiddenSources.size + hiddenLangs.size;

  usePageSummary('(tabs)/news', [
    included.length > 0 &&
      t('Newsrooms included: {n}. Turned off by you: {off}.')
        .replace('{n}', String(included.length))
        .replace('{off}', String(included.length - shownSources.length)),
    !loading && t('Headlines showing: {n}.').replace('{n}', String(items.length)),
    byWard && t('Showing only stories that name your ward.'),
    notIncluded.length > 0 && t('Not included: {names}.').replace('{names}', notIncluded.map((s) => s.name).join(', ')),
  ]);

  const tabs: { key: boolean; label: string }[] = [
    { key: false, label: t('All Chicago') },
    { key: true, label: homeWard != null ? wardLabel(homeWard) : '' },
  ];

  return (
    <Screen tab>
      <View style={{ gap: Spacing.one, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34 }}>
            {t('news')}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {included.length > 0
            ? t('Headlines from {n} newsrooms covering Chicago, newest first. Tap one to read it on the newsroom\'s site.').replace(
                '{n}',
                String(included.length)
              )
            : t('Headlines from newsrooms covering Chicago, newest first. Tap one to read it on the newsroom\'s site.')}
        </ThemedText>
        <FlagAccent />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center', justifyContent: 'space-between' }}>
        {homeWard != null ? (
          <View style={{ flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
            {tabs.map((tab) => {
              const on = wardOnly === tab.key;
              return (
                <Pressable
                  key={String(tab.key)}
                  onPress={() => {
                    setWardOnly(tab.key);
                    setCount(PAGE);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  hitSlop={{ top: 6, bottom: 6 }}
                  style={{ paddingHorizontal: Spacing.three - 4, paddingVertical: 6, backgroundColor: on ? theme.primary : 'transparent' }}>
                  <ThemedText type="smallBold" style={{ fontSize: 13, color: on ? '#fff' : theme.text }}>
                    {tab.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View />
        )}
        <Pressable
          onPress={() => router.push('/news-sources')}
          accessibilityRole="button"
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: 6 }}>
          <Ionicons name="options-outline" size={16} color={theme.primary} />
          <ThemedText type="smallBold" style={{ fontSize: 13, color: theme.primary }}>
            {turnedOff > 0 ? t('Sources ({n} off)').replace('{n}', String(turnedOff)) : t('Sources')}
          </ThemedText>
        </Pressable>
      </View>

      {allOff ? (
        <>
          <EmptyState icon="newspaper-outline" message={t('You have turned every source off.')} />
          <Button title={t('Show every source')} variant="secondary" onPress={showEverything} />
        </>
      ) : loading && rows.length === 0 ? (
        <SkeletonCards />
      ) : items.length === 0 ? (
        <EmptyState
          icon="newspaper-outline"
          message={
            byWard
              ? t('No story in the past two weeks names your ward, its alderman, or its neighborhoods.')
              : t('No headlines yet.')
          }
        />
      ) : (
        <>
          <Card style={{ gap: Spacing.four }}>
            {items.map((item) => (
              <NewsRow
                key={item.id}
                item={item}
                sourceName={names.get(item.sourceId) ?? ''}
                yourWard={!byWard && homeWard != null && item.wardIds.includes(homeWard)}
              />
            ))}
          </Card>
          {/* Stays up while the next page loads, so the list's height (and
              the reader's place) holds still. Firestore first answers a
              longer page from its cache with only the stories it already
              has; that is not the end of the list, so the button goes only
              once a page brings fewer new stories than were asked for. */}
          {(loading || data.length >= count || (asked.key === filterKey && data.length <= asked.n)) && (
            <Button
              title={t('Show more')}
              variant="ghost"
              onPress={() => {
                setAsked({ key: filterKey, n: data.length });
                setCount((n) => n + PAGE);
              }}
            />
          )}
        </>
      )}

      {notIncluded.length > 0 && (
        <Pressable onPress={() => router.push('/news-sources')} accessibilityRole="link">
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {t('Not included: {names}.').replace('{names}', notIncluded.map((s) => s.name).join(', '))}{' '}
            <ThemedText type="small" themeColor="primary" style={{ fontWeight: '600' }}>
              {t('See why')}
            </ThemedText>
          </ThemedText>
        </Pressable>
      )}
    </Screen>
  );
}
