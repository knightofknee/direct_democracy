import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, orderBy, query } from 'firebase/firestore';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card, ChicagoStar, EmptyState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import type { Official } from '@/lib/types';
import { computeScore } from '@/services/ama';

export default function AmaScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: officials, loading } = useLiveQuery<Official & { id: string }>(
    () => query(collection(db, 'officials'), orderBy('name')),
    []
  );

  // Best answer scores at the top; unrated officials at the bottom.
  const sorted = [...officials].sort((a, b) => {
    const sa = computeScore(a).score ?? -1;
    const sb = computeScore(b).score ?? -1;
    return sb - sa;
  });

  return (
    <Screen tab>
      <View style={{ gap: Spacing.one }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
            ama
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Ongoing ask-me-anythings with Chicago’s elected officials. You decide whether a question
          was really answered — dodging costs them.
        </ThemedText>
      </View>

      {sorted.length === 0 && !loading ? (
        <EmptyState icon="people-outline" message="No officials on the platform yet." />
      ) : (
        sorted.map((official) => {
          const score = computeScore(official);
          const gradeColor =
            score.score == null
              ? theme.textSecondary
              : score.score >= 80
                ? theme.verified
                : score.score >= 60
                  ? theme.warning
                  : theme.danger;
          return (
            <Card key={official.uid} onPress={() => router.push(`/official/${official.uid}`)}>
              <View style={styles.row}>
                <View style={[styles.gradeCircle, { borderColor: gradeColor }]}>
                  <ThemedText type="smallBold" style={{ color: gradeColor, fontSize: 18 }}>
                    {score.grade}
                  </ThemedText>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText type="smallBold">{official.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                    {official.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                    {score.asked} asked · {score.answered} answered · {score.dodged} dodged ·{' '}
                    {score.ignored} ignored
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  gradeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
