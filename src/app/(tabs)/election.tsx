import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, orderBy, query } from 'firebase/firestore';
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { FlagAccent } from '@/components/flag-accent';
import { CandidateRow } from '@/components/politician-row';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ChicagoStar, EmptyState, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { plural, timeAgo } from '@/lib/format';
import { notify } from '@/lib/notify';
import type { Candidate, ElectionQuestion } from '@/lib/types';
import { askElectionQuestion } from '@/services/election';

/**
 * The election tab: every candidate on the platform, each carrying their
 * more perfect platform - and below the field, the election AMA, where one
 * question goes to every candidate at once.
 */
export default function ElectionScreen() {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const amaY = useRef(0);

  const { data: candidates, loading } = useLiveQuery<Candidate & { id: string }>(
    () => query(collection(db, 'candidates'), orderBy('name')),
    []
  );

  return (
    <Screen tab ref={scrollRef}>
      <View style={{ gap: Spacing.one, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
            election
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          The more perfect platform: every candidate lays out their full platform, and the city
          debates each policy, plank by plank.
        </ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
          <View style={{ flex: 1 }} />
          <FlagAccent />
          <View style={{ flex: 1, alignItems: 'flex-start', paddingLeft: Spacing.three }}>
            <Pressable
              onPress={() =>
                scrollRef.current?.scrollTo({ y: amaY.current, animated: true })
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Jump to the election AMA"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
                see ama
              </ThemedText>
              <Ionicons name="chevron-down" size={13} color={theme.primary} />
            </Pressable>
          </View>
        </View>
      </View>

      {loading ? (
        <SkeletonCards />
      ) : candidates.length === 0 ? (
        <EmptyState icon="ribbon-outline" message="No candidates on the platform yet." />
      ) : (
        // Real candidates first (alphabetical), the declared-candidates
        // directory entry at the end.
        [...candidates.filter((c) => !c.directory), ...candidates.filter((c) => c.directory)].map(
          (candidate, i) => (
            <Animated.View
              key={candidate.uid}
              entering={FadeInDown.duration(280).delay(Math.min(i, 8) * 45)}>
              <CandidateRow candidate={candidate} />
            </Animated.View>
          )
        )
      )}

      <View
        onLayout={(e) => {
          // layout.y is relative to the Screen shell's inner view, which sits
          // at contentContainer paddingTop (insets.top + spacing). Landing at
          // layout.y + spacing puts the section header just under the status
          // bar instead of behind it.
          amaY.current = e.nativeEvent.layout.y + Spacing.three;
        }}>
        <ElectionAma />
      </View>
    </Screen>
  );
}

/** One question, every candidate: propose questions, read answers side by side. */
function ElectionAma() {
  const router = useRouter();
  const theme = useTheme();
  const { profile, loading: authLoading } = useAuth();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: questions, loading } = useLiveQuery<ElectionQuestion>(
    () => query(collection(db, 'electionQuestions'), orderBy('createdAt', 'desc')),
    []
  );

  const ask = async () => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    setSaving(true);
    try {
      const id = await askElectionQuestion(profile, draft);
      setDraft('');
      router.push(`/election-question/${id}`);
    } catch (e) {
      notify('Could not post the question', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: Spacing.three }}>
      <SectionHeader
        title="election ama"
        subtitle="One question, every candidate on the record. Answers land side by side, ranked by your votes."
      />

      <Card>
        <Field
          placeholder="Ask every candidate at once…"
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={1000}
        />
        {profile || authLoading ? (
          <Button
            title="Put it to the candidates"
            onPress={ask}
            loading={saving}
            disabled={draft.trim().length < 10}
          />
        ) : (
          <Button
            title="Sign in to ask"
            variant="secondary"
            onPress={() => router.push('/sign-in')}
          />
        )}
      </Card>

      {loading ? (
        <SkeletonCards count={2} />
      ) : questions.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          message="No questions yet. Ask the first one and put the whole field on the record."
        />
      ) : (
        questions.map((q) => (
          <Card key={q.id} onPress={() => router.push(`/election-question/${q.id}`)}>
            <ThemedText type="smallBold" style={{ fontSize: 15 }}>
              {q.body}
            </ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' }}>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {q.authorName} · {timeAgo(q.createdAt)}
              </ThemedText>
              {q.authorVerified && <VerifiedBadge compact />}
              <View style={{ flex: 1 }} />
              {q.answerCount > 0 && (
                <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 12 }}>
                  {plural(q.answerCount, 'candidate has answered', 'candidates have answered')}
                </ThemedText>
              )}
            </View>
          </Card>
        ))
      )}
    </View>
  );
}
