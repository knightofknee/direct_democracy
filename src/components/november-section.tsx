import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where } from 'firebase/firestore';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, SectionHeader } from '@/components/ui';
import {
  COOK_2026_RACES,
  GENERAL_2026_QUESTION,
  GENERAL_2026_RACES,
  GENERAL_ELECTION,
  HOW_TO_VOTE_2026,
  VOTER_LOOKUP_URL,
} from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { openLink } from '@/lib/open-link';
import type { ElectionCandidateCard } from '@/lib/types';
import { usePlural, useT } from '@/lib/i18n';

/**
 * Everything else on the November 3 ballot (the school board has its own
 * section just above): how to actually vote, then the statewide and
 * countywide races as a directory, then the pieces that vary by address
 * (Congress, the legislature, judges) as lookups rather than lists.
 */
export function NovemberSection() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const pluralT = usePlural();

  const { data: candidates } = useLiveQuery<ElectionCandidateCard>(
    () =>
      query(collection(db, 'electionCandidates'), where('election', '==', GENERAL_ELECTION)),
    []
  );
  const countByRace = new Map<string, number>();
  for (const c of candidates) countByRace.set(c.race, (countByRace.get(c.race) ?? 0) + 1);

  return (
    <View style={{ gap: Spacing.three }}>
      <SectionHeader
        title={t('your november 3 ballot')}
        subtitle={t('The statewide and Cook County offices every Chicagoan votes on, and the dates and places to cast a ballot. Judges and district races follow below.')}
      />

      <HowToVoteCard />

      {[...GENERAL_2026_RACES, ...COOK_2026_RACES].map((race) => (
        <Card key={race.id} onPress={() => router.push(`/election-race/${race.id}`)}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 3 }}>
              <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                {t(race.label)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {t(race.detail)}
                {countByRace.has(race.id)
                  ? ` · ${pluralT(countByRace.get(race.id)!, 'candidate')}`
                  : ''}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </View>
        </Card>
      ))}

      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 13 }}>
          {t(GENERAL_2026_QUESTION.title)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
          {t(GENERAL_2026_QUESTION.summary)}
        </ThemedText>
      </Card>

    </View>
  );
}

/** The dates that decide whether you get to vote at all. */
function HowToVoteCard() {
  const h = HOW_TO_VOTE_2026;
  const t = useT();
  return (
    <Card>
      <ThemedText type="smallBold" style={{ fontSize: 13 }}>
        {t('When and where to vote')}
      </ThemedText>
      <VoteRow
        icon="person-add-outline"
        title={t('Register')}
        detail={t(`${h.register.online}, ${h.register.mail}, or ${h.register.inPerson}.`)}
        linkLabel={t('Register or check your registration')}
        url={h.register.url}
      />
      <VoteRow
        icon="mail-open-outline"
        title={t('Vote by mail')}
        detail={t(`${h.voteByMail.applyBy}; ${h.voteByMail.detail}.`)}
        linkLabel={t('Apply for a mail ballot')}
        url={h.voteByMail.url}
        extraLink={{ label: t('Track your mail ballot'), url: VOTER_LOOKUP_URL }}
      />
      <VoteRow
        icon="calendar-outline"
        title={t('Vote early')}
        detail={t(`${h.earlyVoting.starts}; ${h.earlyVoting.detail}.`)}
        linkLabel={t('Early voting sites')}
        url={h.earlyVoting.url}
      />
      <VoteRow
        icon="checkbox-outline"
        title={t(`Election day: ${h.electionDay}`)}
        detail={t(`Polls are open ${h.pollingHours}.`)}
        linkLabel={t('Find your polling place')}
        url={VOTER_LOOKUP_URL}
      />
    </Card>
  );
}

function VoteRow({
  icon,
  title,
  detail,
  linkLabel,
  url,
  extraLink,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  linkLabel: string;
  url: string;
  extraLink?: { label: string; url: string };
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.two }}>
      <Ionicons name={icon} size={16} color={theme.primary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="smallBold" style={{ fontSize: 13 }}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
          {detail}
        </ThemedText>
        <LinkRow label={linkLabel} onPress={() => openLink(url)} />
        {extraLink && <LinkRow label={extraLink.label} onPress={() => openLink(extraLink.url)} />}
      </View>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="link"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {icon ? <Ionicons name={icon} size={14} color={theme.primary} /> : null}
      <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
