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
import { Card, ChicagoStar, EmptyState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import type { Official } from '@/lib/types';
import { computeGrade } from '@/services/officials';

export default function AmaScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: officials, loading } = useLiveQuery<Official & { id: string }>(
    () => query(collection(db, 'officials'), orderBy('name')),
    []
  );

  // Best overall grades first; ungraded officials at the bottom.
  const sorted = [...officials].sort((a, b) => {
    const ga = computeGrade(a).overall ?? -1;
    const gb = computeGrade(b).overall ?? -1;
    return gb - ga;
  });

  return (
    <Screen tab>
      <View style={{ gap: Spacing.one, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
            ama
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          Ongoing ask-me-anythings with Chicago’s elected officials, each graded two ways: approval
          from their constituents, and whether they actually answer questions.
        </ThemedText>
        <FlagAccent />
      </View>

      {loading ? (
        <SkeletonCards />
      ) : sorted.length === 0 ? (
        <EmptyState icon="people-outline" message="No officials on the platform yet." />
      ) : (
        sorted.map((official, i) => {
          const grade = computeGrade(official);
          return (
            <Animated.View key={official.uid} entering={FadeInDown.duration(280).delay(Math.min(i, 8) * 45)}>
              <Card onPress={() => router.push(`/official/${official.uid}`)}>
                <View style={styles.row}>
                  <OfficialAvatar name={official.name} photoUrl={official.photoUrl} size={48} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                      {official.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                      {official.title}
                    </ThemedText>
                    <View style={styles.axisRow}>
                      <AxisPill
                        icon="thumbs-up"
                        label={
                          grade.approval.constituentPct == null
                            ? 'Approval -'
                            : `${grade.approval.constituentPct}% approval`
                        }
                      />
                      <AxisPill
                        icon="chatbox-ellipses"
                        label={grade.answersGraded ? `Answers ${grade.answers.grade}` : 'Answers -'}
                      />
                    </View>
                  </View>
                  <GradeBadge letter={grade.letter} score={grade.overall} />
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </View>
              </Card>
            </Animated.View>
          );
        })
      )}
    </Screen>
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
