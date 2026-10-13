import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { collection, query, where } from 'firebase/firestore';
import React from 'react';
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { WEB_APP_URL } from '@/components/share-button';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, SectionHeader } from '@/components/ui';
import {
  COOK_2026_RACES,
  DISTRICT_FAMILIES,
  GENERAL_2026_QUESTION,
  GENERAL_2026_RACES,
  GENERAL_ELECTION,
  GENERAL_ELECTION_DATE,
  JUDICIAL_RACES,
} from '@/constants/elections';
import { schoolBoardRaceLabel } from '@/constants/school-board';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { contestOf, useBallot } from '@/lib/ballot';
import { useMyDistricts, type DistrictType } from '@/lib/districts';
import { db } from '@/lib/firebase';
import { tapHaptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { confirmDestructive, notify } from '@/lib/notify';
import { usePageSummary } from '@/lib/page-help';
import type { ElectionCandidateCard, SchoolBoardCandidate } from '@/lib/types';

interface Contest {
  key: string;
  label: string;
  /** Where to make or change the pick. */
  href: string;
  candidates: { id: string; name: string; writeIn?: boolean }[];
}

interface Section {
  title: string;
  contests: Contest[];
}

/**
 * My ballot (2026-10-09): every choice on this person's November 3 ballot,
 * roughly in the order the ballot prints them, with their pick in each.
 * Picks are made on the race screens and kept on this device only
 * (src/lib/ballot.ts). District races need the address lookup; without it
 * the page lists what every Chicagoan votes on and asks for the address.
 */
export default function MyBallotScreen() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const { profile } = useAuth();
  const mine = useMyDistricts();
  const ballot = useBallot();

  const { data: cards, loading: cardsLoading } = useLiveQuery<ElectionCandidateCard>(
    () => query(collection(db, 'electionCandidates'), where('election', '==', GENERAL_ELECTION)),
    []
  );
  const { data: board, loading: boardLoading } = useLiveQuery<SchoolBoardCandidate & { id: string }>(
    () => query(collection(db, 'schoolBoardCandidates')),
    []
  );
  const loading = cardsLoading || boardLoading;

  const inRace = (race: string) => cards.filter((c) => c.race === race);
  const contest = (race: string, label: string): Contest | null => {
    const candidates = inRace(race);
    return candidates.length ? { key: race, label, href: `/election-race/${race}`, candidates } : null;
  };
  const district = (type: DistrictType, prefix: string): Contest | null => {
    const n = mine.exact ? (mine.of(type)?.[0] as number | undefined) : undefined;
    const family = DISTRICT_FAMILIES.find((f) => f.prefix === prefix);
    return n != null && family ? contest(`${prefix}-${n}`, family.districtLabel(n)) : null;
  };
  /** A judicial race is one choice per vacancy. */
  const vacancies = (race: string, label: string): Contest[] => {
    const seats = new Map<string, ElectionCandidateCard[]>();
    for (const c of inRace(race)) seats.set(c.seat ?? '', [...(seats.get(c.seat ?? '') ?? []), c]);
    return [...seats].map(([seat, candidates]) => ({
      key: contestOf(race, seat || null),
      label: seat ? `${label}: ${seat}` : label,
      href: `/election-race/${race}`,
      candidates,
    }));
  };
  const statewide = (ids: string[]) =>
    ids.map((id) => {
      const race = [...GENERAL_2026_RACES, ...COOK_2026_RACES].find((r) => r.id === id)!;
      return contest(id, t(race.label));
    });
  const schoolSeat = mine.exact ? (mine.of('schoolBoard')?.[0] as string | undefined) : undefined;
  const schoolContest = (seat: string): Contest | null => {
    const candidates = board.filter((c) => c.race === seat);
    return candidates.length
      ? { key: `sb-${seat}`, label: `${t('School board')}, ${schoolBoardRaceLabel(seat)}`, href: `/school-board/${seat}`, candidates }
      : null;
  };
  const subcircuitN = mine.exact ? (mine.of('subcircuit')?.[0] as number | undefined) : undefined;
  const judicialLabel = (id: string) => t(JUDICIAL_RACES.find((r) => r.id === id)!.label);

  const sections: Section[] = [
    { title: t('Federal'), contests: [...statewide(['us-senate']), district('usHouse', 'us-house')].filter(Boolean) as Contest[] },
    {
      title: t('State'),
      contests: [
        ...statewide(['governor', 'attorney-general', 'secretary-of-state', 'comptroller', 'treasurer']),
        district('ilSenate', 'il-senate'),
        district('ilHouse', 'il-house'),
      ].filter(Boolean) as Contest[],
    },
    {
      title: t('County'),
      contests: [
        ...statewide(['cook-board-president', 'cook-clerk', 'cook-sheriff', 'cook-treasurer', 'cook-assessor']),
        district('boardOfReview', 'cook-board-of-review'),
        district('cookCommissioner', 'cook-commissioner'),
        ...statewide(['mwrd', 'mwrd-2yr']),
      ].filter(Boolean) as Contest[],
    },
    {
      title: t('School board'),
      contests: [schoolContest('president'), schoolSeat ? schoolContest(schoolSeat) : null].filter(Boolean) as Contest[],
    },
    {
      title: t('Judges'),
      contests: [
        ...vacancies('judicial-appellate', judicialLabel('judicial-appellate')),
        ...vacancies('judicial-circuit', judicialLabel('judicial-circuit')),
        ...(subcircuitN != null
          ? vacancies(
              `judicial-subcircuit-${subcircuitN}`,
              DISTRICT_FAMILIES.find((f) => f.prefix === 'judicial-subcircuit')!.districtLabel(subcircuitN)
            )
          : []),
      ],
    },
  ];
  const retention = inRace('judicial-retention').sort((a, b) => a.name.localeCompare(b.name));
  const yes = retention.filter((j) => ballot.retain[j.id] === 'yes');
  const no = retention.filter((j) => ballot.retain[j.id] === 'no');

  const all = sections.flatMap((s) => s.contests);
  const picked = (c: Contest) => (ballot.picks[c.key] ?? []).map((id) => c.candidates.find((x) => x.id === id)).filter(Boolean) as Contest['candidates'];
  const decided = all.filter((c) => picked(c).length > 0).length;
  const total = all.length + (retention.length ? 1 : 0) + 1;
  const done = decided + (yes.length + no.length > 0 ? 1 : 0) + (ballot.question ? 1 : 0);

  usePageSummary('my-ballot', [
    !loading && t('Choices made: {n} of {total}.').replace('{n}', String(done)).replace('{total}', String(total)),
    !mine.exact && t('No address on file, so district races are not listed.'),
    t('Your picks stay on this phone.'),
  ]);

  const nameOf = (c: { name: string; writeIn?: boolean }) => (c.writeIn ? `${c.name} (${t('write in')})` : c.name);

  const share = async () => {
    const lines = [t('My picks for the {date} ballot').replace('{date}', t(GENERAL_ELECTION_DATE)), ''];
    for (const s of sections) {
      for (const c of s.contests) {
        const p = picked(c);
        if (p.length) lines.push(`${c.label}: ${p.map(nameOf).join(', ')}`);
      }
    }
    if (yes.length) lines.push(`${t('Keep these judges')}: ${yes.map((j) => j.name).join(', ')}`);
    if (no.length) lines.push(`${t('Do not keep these judges')}: ${no.map((j) => j.name).join(', ')}`);
    if (ballot.question) lines.push(`${t(GENERAL_2026_QUESTION.title)}: ${ballot.question === 'yes' ? t('Yes') : t('No')}`);
    if (lines.length === 2) {
      notify(t('Nothing picked yet'), t('Pick a candidate in a race first.'));
      return;
    }
    lines.push('', `${t('Plan yours with direct democracy')}: ${WEB_APP_URL}/election`);
    const message = lines.join('\n');
    try {
      if (Platform.OS === 'web') {
        const nav = globalThis.navigator as Navigator | undefined;
        if (nav?.share) {
          await nav.share({ text: message });
          return;
        }
        await Clipboard.setStringAsync(message);
        notify(t('Copied'), t('Your picks are copied. Paste them anywhere.'));
        return;
      }
      await Share.share({ message });
    } catch {
      // The person closed the share sheet.
    }
  };

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        {t('Your choices for the {date} ballot, in about the order the ballot prints them. Tap a race to pick. Your picks stay on this phone: they are never sent to us or anyone else.').replace(
          '{date}',
          t(GENERAL_ELECTION_DATE)
        )}
      </ThemedText>

      {!loading && (
        <ThemedText type="smallBold" style={{ fontSize: 15 }}>
          {t('Choices made: {n} of {total}.').replace('{n}', String(done)).replace('{total}', String(total))}
        </ThemedText>
      )}

      {!mine.exact && (
        <Card>
          <ThemedText type="small" style={{ fontSize: 13, lineHeight: 19 }}>
            {t('Your address decides your congressional, state legislative, county board, and school board races. Add it to see them here.')}
          </ThemedText>
          <Button
            title={t(profile ? 'Find my races' : 'Sign in to find your races')}
            variant="secondary"
            onPress={() => router.push(profile ? '/my-districts' : '/sign-in')}
          />
        </Card>
      )}

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          {sections
            .filter((s) => s.contests.length > 0 || (s.title === t('Judges') && retention.length > 0))
            .map((s) => (
              <View key={s.title} style={{ gap: Spacing.two }}>
                <SectionHeader title={s.title} />
                {s.contests.map((c) => {
                  const p = picked(c);
                  return (
                    <Card key={c.key} onPress={() => router.push(c.href as never)} style={styles.contest}>
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                        {c.label}
                      </ThemedText>
                      <ThemedText
                        type="smallBold"
                        style={{ fontSize: 15, color: p.length ? theme.text : theme.textSecondary }}>
                        {p.length ? p.map(nameOf).join(', ') : t('Not decided')}
                      </ThemedText>
                    </Card>
                  );
                })}
                {s.title === t('Judges') && retention.length > 0 && (
                  <Card onPress={() => router.push('/election-race/judicial-retention')} style={styles.contest}>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                      {judicialLabel('judicial-retention')}
                    </ThemedText>
                    <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                      {t('Yes: {yes}. No: {no}. Not decided: {open}.')
                        .replace('{yes}', String(yes.length))
                        .replace('{no}', String(no.length))
                        .replace('{open}', String(retention.length - yes.length - no.length))}
                    </ThemedText>
                  </Card>
                )}
              </View>
            ))}

          <SectionHeader title={t('Question')} />
          <Card style={styles.contest}>
            <ThemedText type="smallBold" style={{ fontSize: 14 }}>
              {t(GENERAL_2026_QUESTION.title)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
              {t(GENERAL_2026_QUESTION.summary)}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              {(['yes', 'no'] as const).map((a) => {
                const on = ballot.question === a;
                return (
                  <Pressable
                    key={a}
                    onPress={() => {
                      tapHaptic();
                      ballot.setQuestion(a);
                    }}
                    // Yes and No are one choice of two.
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    hitSlop={6}
                    style={[
                      styles.answer,
                      { borderColor: theme.primary, backgroundColor: on ? theme.primary : 'transparent' },
                    ]}>
                    <ThemedText type="smallBold" style={{ fontSize: 13, color: on ? '#fff' : theme.primary }}>
                      {a === 'yes' ? t('Yes') : t('No')}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Button title={t('Share my picks')} onPress={() => void share()} />
          {done > 0 && (
            <Button
              title={t('Clear my picks')}
              variant="ghost"
              onPress={async () => {
                if (await confirmDestructive(t('Clear my picks?'), t('Every pick on this phone is removed.'), t('Clear'))) {
                  ballot.clear();
                }
              }}
            />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  contest: {
    gap: 2,
  },
  answer: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: Spacing.four,
  },
});
