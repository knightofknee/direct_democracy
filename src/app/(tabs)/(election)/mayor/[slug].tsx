import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CopyLinkButton } from '@/components/copy-link';
import { HeaderActions } from '@/components/help-button';
import { MayorHeader, QuoteBlock, SplitList } from '@/components/mayor-games';
import { Screen } from '@/components/screen';
import { ShareButton } from '@/components/share-button';
import { SkeletonCards } from '@/components/skeleton';
import { SummaryChunks } from '@/components/summary-chunks';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { host } from '@/lib/format';
import { useLocalized, useT } from '@/lib/i18n';
import { costPerPoint, money, randomSeed, splitsFor, useMayorGames } from '@/lib/mayor-games';
import { openLink } from '@/lib/open-link';
import { usePageSummary } from '@/lib/page-help';

/**
 * Everything the mayor games know about one candidate, in the order a
 * voter with a minute needs it (reordered 2026-11-09, Brian: show what
 * matters most first and expect them to leave if it is not there): who
 * they are and their three numbers, then what sets them apart, then where
 * they stand on the questions that split the field, then their own words.
 * The books, the pizza, and the sources follow for whoever keeps reading.
 */
export default function MayorCandidateScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const loc = useLocalized();
  const { data, loading } = useMayorGames();
  const [seed] = useState(randomSeed);
  const candidate = data?.candidates.find((c) => c.slug === slug) ?? null;

  const per = candidate ? costPerPoint(candidate) : null;
  const sidesTaken = data && candidate ? splitsFor(data, candidate.slug).length : 0;
  usePageSummary('mayor/[slug]', [
    candidate && `${candidate.name}, ${loc(candidate.title, candidate.titleEs)}.`,
    candidate?.support?.pct != null && t('Poll support: {pct}%.').replace('{pct}', String(candidate.support.pct)),
    candidate?.finance?.spent != null &&
      t('Spent {spent} ({period}).')
        .replace('{spent}', money(candidate.finance.spent))
        .replace('{period}', loc(candidate.finance.period, candidate.finance.periodEs) ?? ''),
    candidate &&
      data &&
      t('Has taken a side on {n} of the {total} questions that split the field.')
        .replace('{n}', String(sidesTaken))
        .replace('{total}', String(data.splits?.length ?? 0)),
  ]);

  if (!candidate || !data) {
    return (
      <Screen>
        {loading ? <SkeletonCards count={2} /> : <EmptyState icon="alert-circle-outline" message={t('Candidate not found.')} />}
      </Screen>
    );
  }

  const fin = candidate.finance;
  const platform = candidate.candidateUid
    ? () => router.push(`/candidate/${candidate.candidateUid}`)
    : candidate.platformUrl
      ? () => void openLink(candidate.platformUrl!)
      : null;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: candidate.name,
          headerRight: () => (
            <HeaderActions>
              <ShareButton path={`/mayor/${candidate.slug}`} title={candidate.name} />
            </HeaderActions>
          ),
        }}
      />
      <Card>
        <MayorHeader candidate={candidate} size={64} />
        <View style={styles.stats}>
          <Stat
            label={t('Poll support')}
            value={candidate.support?.pct != null ? `${candidate.support.pct}%` : t('not polled')}
          />
          <Stat label={t('Spent')} value={fin?.spent != null ? money(fin.spent) : t('not found')} />
          <Stat label={t('Per point')} value={per != null ? money(per) : t('no points')} />
        </View>
        <ThemedText type="small">{loc(candidate.bio, candidate.bioEs)}</ThemedText>
        {candidate.statusNote ? (
          <ThemedText type="small" themeColor="textSecondary">
            {loc(candidate.statusNote, candidate.statusNoteEs)}
          </ThemedText>
        ) : null}
      </Card>

      <SectionHeader title={t('what sets them apart')} />
      <Card>
        <SummaryChunks text={loc(candidate.summary, candidate.summaryEs) ?? ''} />
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('Written by AI from the campaign\'s platform and the candidate\'s own words, under one set of rules for every candidate. What nearly all of them say is left out.')}
        </ThemedText>
      </Card>

      <SectionHeader title={t('where they split')} subtitle={t('The questions that divide the field, and this candidate\'s side.')} />
      <Card>
        <SplitList doc={data} slug={candidate.slug} seed={seed} />
      </Card>

      <SectionHeader title={t('in their words')} />
      <Card>
        {candidate.points.map((p, i) => (
          <View key={i} style={{ gap: Spacing.two }}>
            <View style={styles.row}>
              <Ionicons name="ellipse" size={8} color={theme.accent} style={{ marginTop: 7 }} />
              <ThemedText style={{ flex: 1 }}>{loc(p.text, p.textEs)}</ThemedText>
            </View>
            {p.quote ? (
              <View style={{ paddingLeft: Spacing.three + 8 }}>
                <QuoteBlock quote={p.quote} />
              </View>
            ) : null}
          </View>
        ))}
      </Card>

      {platform && (
        <Button
          title={t(candidate.candidateUid ? 'Full platform, open to your comments' : 'Full platform on their site')}
          icon={<Ionicons name={candidate.candidateUid ? 'document-text-outline' : 'globe-outline'} size={16} color="#FFFFFF" />}
          onPress={platform}
        />
      )}
      {candidate.website ? (
        <View style={[styles.row, { alignItems: 'center' }]}>
          <Button
            title={`${t('Campaign website')} (${host(candidate.website)})`}
            variant="secondary"
            icon={<Ionicons name="globe-outline" size={15} />}
            onPress={() => void openLink(candidate.website!)}
            style={{ flex: 1 }}
          />
          <CopyLinkButton url={candidate.website} label={t('Copy campaign website link')} />
        </View>
      ) : null}

      <SectionHeader title={t('on money')} subtitle={t('Taxes, the budget, and what it costs to live here.')} />
      <Card>
        <ThemedText>{loc(candidate.money.summary, candidate.money.summaryEs)}</ThemedText>
        {candidate.money.quotes.map((q, i) => (
          <QuoteBlock key={i} quote={q} />
        ))}
      </Card>

      <SectionHeader title={t('campaign money')} subtitle={loc(data.financeNote, data.financeNoteEs) ?? undefined} />
      <Card>
        {fin ? (
          <>
            {fin.committee ? (
              <ThemedText type="small" themeColor="textSecondary">
                {fin.committee}
              </ThemedText>
            ) : null}
            <MoneyRow label={t('Raised')} value={fin.raised} />
            <MoneyRow label={t('Spent')} value={fin.spent} />
            <MoneyRow label={t('Cash on hand')} value={fin.cashOnHand} />
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {loc(fin.period, fin.periodEs)}.{fin.note ? ` ${loc(fin.note, fin.noteEs)}` : ''}
            </ThemedText>
            <Pressable onPress={() => void openLink(fin.url)} accessibilityRole="link">
              <ThemedText type="small" style={{ color: theme.primary, fontSize: 12 }}>
                {t('Source')}: {host(fin.url)}
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t('No spending report found for this campaign yet.')}
          </ThemedText>
        )}
        {candidate.support ? (
          <Pressable onPress={() => void openLink(candidate.support!.url)} accessibilityRole="link">
            <ThemedText type="small" style={{ color: theme.primary, fontSize: 12 }}>
              {t('Poll support')}: {candidate.support.poll}
            </ThemedText>
          </Pressable>
        ) : null}
      </Card>

      <SectionHeader title={t('pizza')} />
      <Card>
        <ThemedText type="smallBold">
          {t(
            candidate.pizza.verdict === 'thin'
              ? 'Correct'
              : candidate.pizza.verdict === 'both'
                ? 'Hedging'
                : candidate.pizza.verdict === 'deep'
                  ? 'Incorrect'
                  : 'No position on record'
          )}
        </ThemedText>
        {candidate.pizza.preference ? <ThemedText>{loc(candidate.pizza.preference, candidate.pizza.preferenceEs)}</ThemedText> : null}
        {candidate.pizza.quote ? <QuoteBlock quote={candidate.pizza.quote} /> : null}
      </Card>

      {candidate.fun.length > 0 && (
        <>
          <SectionHeader title={t('also on the record')} />
          <Card>
            {candidate.fun.map((f, i) => (
              <Pressable key={i} onPress={() => void openLink(f.url)} accessibilityRole="link" style={styles.row}>
                <Ionicons name="sparkles-outline" size={14} color={theme.accent} style={{ marginTop: 4 }} />
                <ThemedText style={{ flex: 1 }}>{loc(f.text, f.textEs)}</ThemedText>
              </Pressable>
            ))}
          </Card>
        </>
      )}

      <Button
        title={t('Put a question to every candidate')}
        variant="secondary"
        icon={<Ionicons name="chatbubbles-outline" size={16} />}
        onPress={() => router.push('/election')}
      />

      {candidate.sourceUrls.length > 0 && (
        <View style={{ gap: Spacing.one }}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('Compiled from public sources:')}
          </ThemedText>
          {candidate.sourceUrls.map((url) => (
            <ThemedText
              key={url}
              type="small"
              themeColor="textSecondary"
              style={{ fontSize: 12, textDecorationLine: 'underline' }}
              onPress={() => openLink(url)}>
              {host(url)}
            </ThemedText>
          ))}
        </View>
      )}
    </Screen>
  );
}

/** One of the three numbers under the name: the figure large, its name small. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 1 }}>
      <ThemedText type="smallBold" style={{ fontSize: 18, lineHeight: 23 }}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 15 }}>
        {label}
      </ThemedText>
    </View>
  );
}

function MoneyRow({ label, value }: { label: string; value: number | null }) {
  const t = useT();
  return (
    <View style={styles.between}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value != null ? money(value) : t('not found')}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
