import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { useT } from '@/lib/i18n';
import { openLink } from '@/lib/open-link';
import type { Official, RollCall } from '@/lib/types';
import { formatWhen } from '@/lib/ward-posting';

const PAGE = 10;
const FETCH = 30;

/** How a vote reads on the page. Anything else is shown as the Clerk wrote it. */
const VOTE_LABELS: Record<string, string> = { yes: 'Voted yes', no: 'Voted no' };

/**
 * An alderman's voting record, at the bottom of their page: the Council
 * votes that split (the losing side had 5 or more), and every vote where
 * this alderman was on the losing side, however lopsided. Facts only, as
 * the City Clerk records them: how they voted, the Council's action and
 * tally, and a link to the legislation. No score, no color for "good" or
 * "bad" votes.
 */
export function VotingRecord({ official }: { official: Official }) {
  const t = useT();
  const personId = official.elmsPersonId;
  const [shown, setShown] = useState(PAGE);
  const { data: split } = useLiveQuery<RollCall>(
    () =>
      personId
        ? query(
            collection(db, 'rollCalls'),
            where('council', '==', true),
            where('divided', '==', true),
            orderBy('date', 'desc'),
            limit(FETCH)
          )
        : null,
    [personId]
  );
  const { data: dissents } = useLiveQuery<RollCall>(
    () =>
      personId
        ? query(
            collection(db, 'rollCalls'),
            where('minorityVoters', 'array-contains', personId),
            orderBy('date', 'desc'),
            limit(FETCH)
          )
        : null,
    [personId]
  );
  if (!personId) return null;

  const byId = new Map<string, RollCall>();
  for (const r of [...split, ...dissents]) if (r.votes?.[personId]) byId.set(r.id, r);
  const rows = [...byId.values()].sort((a, b) => b.date.toMillis() - a.date.toMillis());
  if (rows.length === 0) return null;

  return (
    <>
      <SectionHeader
        title={t('Voting record')}
        subtitle={t('Votes where the Council split, and every vote where this alderman was on the losing side. From the City Clerk.')}
      />
      <Card>
        {rows.slice(0, shown).map((r, i) => (
          <VoteRow key={r.id} rollCall={r} vote={r.votes[personId]} first={i === 0} />
        ))}
        {rows.length > shown && (
          <Button title={t('Show more')} variant="ghost" onPress={() => setShown((n) => n + PAGE)} />
        )}
      </Card>
    </>
  );
}

function VoteRow({ rollCall: r, vote, first }: { rollCall: RollCall; vote: string; first: boolean }) {
  const theme = useTheme();
  const t = useT();
  const label = VOTE_LABELS[vote] ? t(VOTE_LABELS[vote]) : t(vote);
  return (
    <Pressable
      onPress={() => void openLink(r.url)}
      accessibilityRole="link"
      style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
      <ThemedText type="smallBold" style={{ fontSize: 13 }}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={{ fontSize: 14, lineHeight: 19 }}>
        {r.title}
      </ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.two }}>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {`${t(r.actionName)} ${r.yes}-${r.no}`}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {formatWhen(r.date.toDate(), false)}
        </ThemedText>
        {!r.council && (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {r.body}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 2,
    paddingVertical: Spacing.two,
  },
});
