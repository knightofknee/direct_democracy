import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Field } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import type { PollType, Scope } from '@/lib/types';
import { createPoll } from '@/services/polls';

const TYPES: { key: PollType; label: string; hint: string }[] = [
  { key: 'yesNo', label: 'Yes / No', hint: 'A straight up-or-down question' },
  { key: 'multipleChoice', label: 'Multiple choice', hint: 'Voters pick one option' },
  { key: 'approval', label: 'Approval', hint: 'Voters pick every option they support' },
  { key: 'scale5', label: '5-point scale', hint: 'Strongly oppose → strongly support' },
];

export default function NewPollScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [question, setQuestion] = useState('');
  const [detail, setDetail] = useState('');
  const [type, setType] = useState<PollType>('yesNo');
  const [scope, setScope] = useState<Scope>('ward');
  const [optionsText, setOptionsText] = useState('');
  const [saving, setSaving] = useState(false);

  if (profile?.role !== 'official') {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" message="Only elected officials can create polls." />
      </Screen>
    );
  }

  const needsOptions = type === 'multipleChoice' || type === 'approval';

  const submit = async () => {
    if (question.trim().length < 10) {
      Alert.alert('Almost there', 'Write a question of at least 10 characters.');
      return;
    }
    const options = optionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label, i) => ({ key: `opt${i}`, label }));
    if (needsOptions && options.length < 2) {
      Alert.alert('Almost there', 'List at least two options, one per line.');
      return;
    }
    setSaving(true);
    try {
      await createPoll(profile, {
        question,
        detail,
        type,
        options,
        scope,
        wardId: profile.wardId,
      });
      if (router.canGoBack()) router.back();
      else router.replace('/ward');
    } catch (e) {
      Alert.alert('Could not create poll', e instanceof Error ? e.message : 'Something went wrong.');
      setSaving(false);
    }
  };

  const choice = (selected: boolean) => ({
    borderColor: selected ? theme.primary : theme.border,
    backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
  });

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Put a question directly to your constituents. Ward polls are votable only by verified
        residents of your ward; citywide polls are open to everyone, with verified results alongside.
      </ThemedText>

      <Field label="Question" placeholder="Should the ward…" value={question} onChangeText={setQuestion} />
      <Field
        label="Context (optional)"
        placeholder="Background, tradeoffs, links…"
        value={detail}
        onChangeText={setDetail}
        multiline
        style={{ minHeight: 80 }}
      />

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Vote format
        </ThemedText>
        <View style={styles.wrapRow}>
          {TYPES.map((t) => (
            <Pressable key={t.key} onPress={() => setType(t.key)} style={[styles.choice, choice(type === t.key)]}>
              <ThemedText type="small" style={type === t.key ? { color: theme.primary, fontWeight: '700' } : undefined}>
                {t.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {TYPES.find((t) => t.key === type)?.hint}
        </ThemedText>
      </View>

      {needsOptions && (
        <Field
          label="Options (one per line)"
          placeholder={'Option A\nOption B\nOption C'}
          value={optionsText}
          onChangeText={setOptionsText}
          multiline
          style={{ minHeight: 100 }}
        />
      )}

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Audience
        </ThemedText>
        <View style={styles.wrapRow}>
          {profile.wardId != null && (
            <Pressable onPress={() => setScope('ward')} style={[styles.choice, choice(scope === 'ward')]}>
              <ThemedText type="small" style={scope === 'ward' ? { color: theme.primary, fontWeight: '700' } : undefined}>
                {wardLabel(profile.wardId)} (verified residents)
              </ThemedText>
            </Pressable>
          )}
          <Pressable onPress={() => setScope('city')} style={[styles.choice, choice(scope === 'city')]}>
            <ThemedText type="small" style={scope === 'city' ? { color: theme.primary, fontWeight: '700' } : undefined}>
              Citywide (everyone)
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <Button title="Open the vote" onPress={submit} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  choice: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
  },
});
