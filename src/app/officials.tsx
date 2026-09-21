import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, orderBy, query } from 'firebase/firestore';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { OfficialAvatar } from '@/components/avatar';
import { FlagAccent } from '@/components/flag-accent';
import { GradeBadge } from '@/components/grade-badge';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Card, ChicagoStar, Chip, EmptyState, SectionHeader } from '@/components/ui';
import { TEST_WARD } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useScreenRoom } from '@/hooks/use-screen-room';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { useT } from '@/lib/i18n';
import type { Official } from '@/lib/types';
import { computeGrade } from '@/services/officials';

export default function AmaScreen() {
  const { profile } = useAuth();
  const t = useT();
  const { data: officials, loading } = useLiveQuery<Official & { id: string }>(
    () => query(collection(db, 'officials'), orderBy('name')),
    []
  );

  // Citywide offices first, then wards in order. The hidden test ward never
  // shows unless it is your own ward (operator-assigned test accounts).
  const sorted = officials
    .filter((o) => o.wardId !== TEST_WARD || profile?.wardId === TEST_WARD)
    .sort((a, b) => (a.wardId ?? 0) - (b.wardId ?? 0));
  // Your own alderman is pinned up top and stays in the full list too, so
  // the ward-ordered list never has a confusing gap.
  const mine = profile?.wardId != null ? sorted.find((o) => o.wardId === profile.wardId) : null;

  return (
    <Screen>
      <View style={{ gap: Spacing.one, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
            {t('ama')}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {t('Ongoing ask-me-anythings with Chicago’s elected officials, each graded two ways: approval from their constituents, and whether they actually answer questions.')}
        </ThemedText>
        <FlagAccent />
      </View>

      {loading ? (
        <SkeletonCards />
      ) : sorted.length === 0 ? (
        <EmptyState icon="people-outline" message={t('No officials on the platform yet.')} />
      ) : (
        <>
          {mine && (
            <>
              <SectionHeader title={t('your alderman')} />
              <OfficialRow official={mine} highlighted />
            </>
          )}
          {mine && <SectionHeader title={t('every ward')} />}
          {sorted.map((official, i) => (
            <Animated.View
              key={official.uid}
              entering={FadeInDown.duration(280).delay(Math.min(i, 8) * 45)}>
              <OfficialRow official={official} />
            </Animated.View>
          ))}
        </>
      )}
    </Screen>
  );
}

function OfficialRow({ official, highlighted }: { official: Official; highlighted?: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  // The whole card is the tap target; on a tight screen the chevron's width
  // goes to the name instead.
  const { tight } = useScreenRoom();
  const t = useT();
  const grade = computeGrade(official);
  return (
    <Card
      onPress={() => router.push(`/official/${official.uid}`)}
      style={highlighted ? { borderColor: theme.primary, borderWidth: 1 } : undefined}>
      <View style={styles.row}>
        <OfficialAvatar name={official.name} photoUrl={official.photoUrl} size={48} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: Spacing.two, rowGap: 2 }}>
            <ThemedText type="smallBold" style={{ fontSize: 15 }}>
              {official.name}
            </ThemedText>
            {official.claimed && <Chip label={t('on the platform')} tone="success" />}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {official.title}
          </ThemedText>
          <View style={styles.axisRow}>
            <AxisPill
              icon="thumbs-up"
              label={
                grade.approval.constituentPct == null
                  ? t('Approval -')
                  : t('{pct}% approval').replace('{pct}', String(grade.approval.constituentPct))
              }
            />
            <AxisPill
              icon="chatbox-ellipses"
              label={grade.answersGraded ? `${t('Answers')} ${grade.answers.grade}` : t('Answers -')}
            />
          </View>
        </View>
        <GradeBadge letter={grade.letter} score={grade.overall} />
        {tight ? null : <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
      </View>
    </Card>
  );
}

function AxisPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.axisPill, { backgroundColor: theme.backgroundSelected }]}>
      <Ionicons name={icon} size={11} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  axisRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  axisPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
