import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { YourRaces } from '@/components/your-races';
import {
  COOK_2026_RACES,
  GENERAL_2026_QUESTION,
  GENERAL_2026_RACES,
  GENERAL_ELECTION,
  HOW_TO_VOTE_2026,
  VOTING_HELP_2026,
  VOTER_LOOKUP_URL,
} from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { openDirections, openLink } from '@/lib/open-link';
import type { ElectionCandidateCard } from '@/lib/types';
import { useLocale, usePlural, useT } from '@/lib/i18n';
import { useAuth } from '@/hooks/use-auth';
import { EARLY_VOTING_2026, EARLY_VOTING_SITES_2026 } from '@/constants/early-voting-2026';

/**
 * The head of the November 3 ballot: the races this person's address
 * decides (or the ask for an address), how to actually vote, then the
 * statewide and countywide races as a directory and the advisory question.
 * The school board, judges, and every district follow as their own
 * sections, all inside the November band.
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
      {/* The band's own "November 3, 2026 ballot" label titles this. */}
      <ThemedText type="small" themeColor="textSecondary">
        {t('Your races first, then when and where to vote, the offices every Chicagoan votes on, the school board, judges, and every district race.')}
      </ThemedText>

      <YourRaces />

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
        url={h.earlyVoting.url}>
        <MyEarlyVotingSite />
      </VoteRow>
      <VoteRow
        icon="checkbox-outline"
        title={t(`Election day: ${h.electionDay}`)}
        detail={t(`Polls are open ${h.pollingHours}.`)}
        linkLabel={t('Find your polling place')}
        url={VOTER_LOOKUP_URL}
      />
      <VotingHelp />
    </Card>
  );
}

/**
 * Help beyond the basics (access, language, mail roster, under-18,
 * working the polls), folded into one quiet row so the card stays simple
 * for the average voter and is there for everyone else.
 */
function VotingHelp() {
  const theme = useTheme();
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: Spacing.two }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <Ionicons name="help-buoy-outline" size={16} color={theme.primary} />
        <ThemedText type="smallBold" style={{ fontSize: 13, flex: 1 }}>
          {t('More help voting')}
        </ThemedText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textSecondary} />
      </Pressable>
      {open &&
        VOTING_HELP_2026.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => openLink(item.url)}
            accessibilityRole="link"
            style={{ flexDirection: 'row', gap: Spacing.two, paddingLeft: 24 }}>
            <Ionicons name={item.icon} size={14} color={theme.textSecondary} style={{ marginTop: 2 }} />
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17, flex: 1 }}>
              {t(item.text)}
            </ThemedText>
            <Ionicons name="open-outline" size={12} color={theme.primary} style={{ marginTop: 3 }} />
          </Pressable>
        ))}
    </View>
  );
}

function VoteRow({
  icon,
  title,
  detail,
  linkLabel,
  url,
  extraLink,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  linkLabel: string;
  url: string;
  extraLink?: { label: string; url: string };
  children?: React.ReactNode;
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
        {children}
        <LinkRow label={linkLabel} onPress={() => openLink(url)} />
        {extraLink && <LinkRow label={extraLink.label} onPress={() => openLink(extraLink.url)} />}
      </View>
    </View>
  );
}

/**
 * The early voting site in the viewer's home ward, with its hours and a tap
 * for directions (any site works; this is just the obvious one). Nothing
 * shows without a home ward: the Board's full list is the link below.
 */
function MyEarlyVotingSite() {
  const theme = useTheme();
  const t = useT();
  const { profile } = useAuth();
  const { locale } = useLocale();
  const site = profile?.wardId != null ? EARLY_VOTING_SITES_2026[profile.wardId] : undefined;
  if (!site) return null;
  const where = `${site.name}, ${site.address}, Chicago, IL`;
  return (
    <View style={[styles.site, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
        {t('Your ward’s site, open starting {date}').replace('{date}', t(EARLY_VOTING_2026.opens))}
      </ThemedText>
      <Pressable onPress={() => void openDirections(where)} accessibilityRole="link" hitSlop={4}>
        <ThemedText type="smallBold" style={{ fontSize: 13, lineHeight: 18 }}>
          {site.name}
        </ThemedText>
        <ThemedText type="small" style={{ fontSize: 13, lineHeight: 18, color: theme.primary }}>
          {site.address}
        </ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
        {t(EARLY_VOTING_2026.hours)}
      </ThemedText>
      {locale !== 'en' && site.bilingual.includes(locale) && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
          {t('Election officials there speak your language.')}
        </ThemedText>
      )}
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
  site: {
    gap: 2,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    marginVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
