import { Ionicons } from '@expo/vector-icons';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Chip, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { timeAgo } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useNewsPrefs, useNewsSources, visibleNews } from '@/lib/news';
import { openLink } from '@/lib/open-link';
import type { NewsItem } from '@/lib/types';

/**
 * One headline: the newsroom and how long ago, then the headline as the
 * newsroom wrote it (never translated). A tap reads the story on the
 * newsroom's own site.
 */
export function NewsRow({
  item,
  sourceName,
  yourWard,
}: {
  item: NewsItem;
  sourceName: string;
  /** Marks a story that names the viewer's home ward. */
  yourWard?: boolean;
}) {
  const t = useT();
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => void openLink(item.url)}
      accessibilityRole="link"
      accessibilityHint={t('Opens the story on {source}\'s site').replace('{source}', sourceName)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={styles.meta}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={{ fontSize: 12, flexShrink: 1 }}>
          {sourceName}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {timeAgo(item.publishedAt)}
        </ThemedText>
        {yourWard && <Chip label={t('Your ward')} tone="primary" icon="location-outline" />}
      </View>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <ThemedText style={{ flex: 1, fontWeight: '600' }}>{item.title}</ThemedText>
        <Ionicons name="open-outline" size={14} color={theme.textSecondary} style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
}

const IN_THE_NEWS_FIRST = 4;
const IN_THE_NEWS_MAX = 15;

/**
 * "In the news" on a ward page (stories naming the ward, its alderman, or
 * one of its neighborhoods) or an official's page (stories naming them in
 * full), as tagged by syncNewsFeeds. Follows the viewer's own news choices.
 * Draws nothing when no story in the past two weeks matches.
 */
export function InTheNews({ wardId, officialUid }: { wardId?: number; officialUid?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { sources } = useNewsSources();
  const { hiddenSources, hiddenLangs } = useNewsPrefs();
  const { data } = useLiveQuery<NewsItem>(
    () =>
      wardId != null
        ? query(
            collection(db, 'newsItems'),
            where('wardIds', 'array-contains', wardId),
            orderBy('publishedAt', 'desc'),
            limit(IN_THE_NEWS_MAX)
          )
        : officialUid
          ? query(
              collection(db, 'newsItems'),
              where('officialIds', 'array-contains', officialUid),
              orderBy('publishedAt', 'desc'),
              limit(IN_THE_NEWS_MAX)
            )
          : null,
    [wardId, officialUid]
  );
  const items = visibleNews(data, hiddenSources, hiddenLangs);
  if (items.length === 0) return null;
  const names = new Map(sources.map((s) => [s.id, s.name]));
  const shown = open ? items : items.slice(0, IN_THE_NEWS_FIRST);
  return (
    <>
      <SectionHeader
        title={t('In the news')}
        subtitle={
          wardId != null
            ? t('Stories from the past two weeks that name this ward, its alderman, or one of its neighborhoods.')
            : t('Stories from the past two weeks that name them.')
        }
      />
      <Card style={{ gap: Spacing.three }}>
        {shown.map((item) => (
          <NewsRow key={item.id} item={item} sourceName={names.get(item.sourceId) ?? ''} />
        ))}
        {items.length > shown.length && (
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={6}>
            <ThemedText type="smallBold" themeColor="primary">
              {t('Show more ({n} left)').replace('{n}', String(items.length - shown.length))}
            </ThemedText>
          </Pressable>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 2,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
