import React from 'react';

import { ThemedText } from '@/components/themed-text';
import { wardLabel } from '@/constants/chicago';
import { useT } from '@/lib/i18n';
import type { DailyBucket } from '@/lib/rate-limits';
import { formatWhen, type useWardPostWindow } from '@/lib/ward-posting';

/**
 * The one line under a ward post box (a ward concern, a question to an
 * alderman): when the next post opens and which limit is holding it, or,
 * for a ward that isn't home, the weekly limit before it is spent. Says
 * nothing for an open home-ward post.
 */
export function WardPostNote({
  wardId,
  window: w,
}: {
  wardId: number;
  window: ReturnType<typeof useWardPostWindow>;
}) {
  const t = useT();
  if (w.loading || (!w.nextAt && w.home)) return null;
  const text = !w.nextAt
    ? t('The {ward} isn’t your home ward, so you can post here once a week.')
    : w.reason === 'home'
      ? t('You can post up to 3 times a day in your home ward. You can post again {date}.')
      : w.reason === 'away'
        ? t('You can post in a ward that isn’t yours once a week. You can post in the {ward} again {date}.')
        : t('You can post in up to 5 wards besides your home ward in a week. You can post in another ward again {date}.');
  return (
    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
      {text.replace('{ward}', wardLabel(wardId)).replace('{date}', w.nextAt ? formatWhen(w.nextAt) : '')}
    </ThemedText>
  );
}

const DAILY_NOTES: Record<DailyBucket, string> = {
  cityConcerns: 'You can raise up to 2 citywide concerns a day. You can raise another {date}.',
  cityQuestions: 'You can ask citywide officials up to 3 questions a day. You can ask again {date}.',
  electionQuestions: 'You can ask up to 3 election questions a day. You can ask again {date}.',
};

/** The daily limit line under a post box, shown only once the limit is reached. */
export function DailyLimitNote({ bucket, nextAt }: { bucket: DailyBucket; nextAt: Date | null }) {
  const t = useT();
  if (!nextAt) return null;
  return (
    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
      {t(DAILY_NOTES[bucket]).replace('{date}', formatWhen(nextAt))}
    </ThemedText>
  );
}
