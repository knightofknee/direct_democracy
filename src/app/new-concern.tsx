import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCelebration } from '@/components/celebration';
import { HomeWardChoice } from '@/components/home-ward-choice';
import { ReferenceEditor } from '@/components/references';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { DailyLimitNote, WardPostNote } from '@/components/ward-post-note';
import { Button, Field } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useT } from '@/lib/i18n';
import { errorMessage, notify } from '@/lib/notify';
import { useTheme } from '@/hooks/use-theme';
import type { Scope } from '@/lib/types';
import { useRateWindow } from '@/lib/rate-limits';
import { useWardPostWindow } from '@/lib/ward-posting';
import { createConcern } from '@/services/concerns';

export default function NewConcernScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const { anticipate } = useCelebration();
  const t = useT();
  const params = useLocalSearchParams<{ scope?: string; wardId?: string }>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [references, setReferences] = useState<string[]>([]);
  const [scope, setScope] = useState<Scope>(params.scope === 'ward' ? 'ward' : 'city');
  const [saving, setSaving] = useState(false);

  // Anyone may post in any ward: the one they came from (a ward page passes
  // it), else their home ward. The limits (3 a day at home, once a week
  // elsewhere) are the triggers'; this screen says them before, not after.
  const paramWard = Number(params.wardId);
  const targetWard = Number.isInteger(paramWard) && paramWard > 0 ? paramWard : (profile?.wardId ?? null);
  const canPostToWard = targetWard != null;
  // A deep link could ask for ward scope with no ward to post in.
  if (scope === 'ward' && profile && !canPostToWard) setScope('city');
  const postWindow = useWardPostWindow(canPostToWard ? targetWard : null);
  const cityOpensAt = useRateWindow('cityConcerns');
  const blockedUntil = scope === 'ward' ? postWindow.nextAt : cityOpensAt;

  const submit = async () => {
    if (!profile) {
      router.replace('/sign-in');
      return;
    }
    if (title.trim().length < 4) {
      notify(t('Almost there'), t('Give your concern a title of at least 4 characters.'));
      return;
    }
    if (body.trim().length < 20) {
      notify(t('Almost there'), t('Describe the concern in at least 20 characters.'));
      return;
    }
    setSaving(true);
    try {
      const id = await createConcern(profile, { title, body, scope, wardId: targetWard, references });
      anticipate('concerns');
      // Land on the newly opened concern. Dismiss the modal first - a bare
      // replace() from inside a native modal can pop to whatever screen sat
      // under it instead of the target.
      if (router.canDismiss()) router.dismiss();
      router.push(`/concern/${id}`);
    } catch (e) {
      notify(t('Could not post'), errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        {t('Raise a concern for your neighbors to prioritize. Clear, specific concerns climb the board.')}
      </ThemedText>

      <Field label={t('Title')} placeholder={t('e.g. Fix the potholes on Western Ave')} value={title} onChangeText={setTitle} maxLength={140} />
      <Field
        label={t('What’s going on?')}
        placeholder={t('Describe the issue, where it happens, and who it affects…')}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={4000}
        style={{ minHeight: 120 }}
      />

      <ReferenceEditor references={references} onChange={setReferences} />

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('Where does this belong?')}
        </ThemedText>
        <View style={styles.scopeRow}>
          <Pressable
            onPress={() => setScope('city')}
            accessibilityRole="radio"
            accessibilityState={{ selected: scope === 'city' }}
            style={[
              styles.scopeButton,
              {
                borderColor: scope === 'city' ? theme.primary : theme.border,
                backgroundColor: scope === 'city' ? theme.backgroundSelected : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="small" style={scope === 'city' ? { color: theme.primary, fontWeight: '700' } : undefined}>
              {t('Citywide')}
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={!canPostToWard}
            onPress={() => setScope('ward')}
            accessibilityRole="radio"
            accessibilityState={{ selected: scope === 'ward', disabled: !canPostToWard }}
            style={[
              styles.scopeButton,
              {
                opacity: canPostToWard ? 1 : 0.4,
                borderColor: scope === 'ward' ? theme.primary : theme.border,
                backgroundColor: scope === 'ward' ? theme.backgroundSelected : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="small" style={scope === 'ward' ? { color: theme.primary, fontWeight: '700' } : undefined}>
              {!canPostToWard
                ? t('My ward (set your ward first)')
                : postWindow.home
                  ? `${t('My ward')} (${wardLabel(targetWard)})`
                  : wardLabel(targetWard)}
            </ThemedText>
          </Pressable>
        </View>
        {profile && !canPostToWard && <HomeWardChoice />}
        {scope === 'ward' && targetWard != null && <WardPostNote wardId={targetWard} window={postWindow} />}
        {scope === 'city' && <DailyLimitNote bucket="cityConcerns" nextAt={cityOpensAt} />}
      </View>

      <Button title={t('Post concern')} onPress={submit} loading={saving} disabled={blockedUntil != null} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scopeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  scopeButton: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
  },
});
