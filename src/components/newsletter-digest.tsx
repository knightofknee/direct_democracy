import { collection, limit, orderBy, query } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable } from 'react-native';

import { SummaryChunks } from '@/components/summary-chunks';
import { ThemedText } from '@/components/themed-text';
import { Card, SectionHeader } from '@/components/ui';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { useLocalized, usePlural, useT } from '@/lib/i18n';
import type { NewsletterDigest } from '@/lib/types';
import { formatWhen } from '@/lib/ward-posting';

/** A digest older than this is last week's news; the section hides. */
const FRESH_DAYS = 10;

/**
 * What the ward offices told residents this week, summarized across every
 * ward newsletter we can read (newsletterDigests, written each Monday by the
 * operator's scheduled task from that week's issue summaries; one fixed
 * prompt, scripts/data/newsletter-prompt.md). On the home tab under City
 * Council. Each ward's own latest issue is summarized on its ward page.
 */
export function NewsletterDigestSection() {
  const t = useT();
  const pluralT = usePlural();
  const loc = useLocalized();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const { data } = useLiveQuery<NewsletterDigest>(
    () => query(collection(db, 'newsletterDigests'), orderBy('weekOf', 'desc'), limit(1)),
    []
  );
  const digest = data[0];
  if (!digest) return null;
  const weekOf = new Date(`${digest.weekOf}T12:00:00-05:00`);
  if (now - weekOf.getTime() > FRESH_DAYS * 86_400_000) return null;
  const text = loc(digest.summary, digest.summaryEs) ?? digest.summary;
  const chunks = text.split(/\n{2,}/);

  return (
    <>
      <SectionHeader
        title={t('This week in the wards')}
        subtitle={t('What aldermen told residents in their newsletters, the week of {date}.').replace(
          '{date}',
          formatWhen(weekOf, false)
        )}
      />
      <Card>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {`${t('AI summary')} · ${pluralT(digest.issueCount, 'newsletter')} · ${pluralT(digest.wards.length, 'ward office')}`}
        </ThemedText>
        <SummaryChunks text={open ? text : chunks.slice(0, 2).join('\n\n')} />
        {chunks.length > 2 && (
          <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" hitSlop={6}>
            <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
              {open ? t('Show less') : t('Show more')}
            </ThemedText>
          </Pressable>
        )}
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('Each ward’s latest newsletter is summarized on its ward page.')}
        </ThemedText>
      </Card>
    </>
  );
}
