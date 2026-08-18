import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Field } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { notify } from '@/lib/notify';
import { useTheme } from '@/hooks/use-theme';
import type { Scope } from '@/lib/types';
import { createConcern } from '@/services/concerns';

export default function NewConcernScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<Scope>('city');
  const [saving, setSaving] = useState(false);

  const canPostToWard = profile?.wardId != null && (profile.verified || profile.role === 'official');

  const submit = async () => {
    if (!profile) {
      router.replace('/sign-in');
      return;
    }
    if (title.trim().length < 8) {
      notify('Almost there', 'Give your concern a title of at least 8 characters.');
      return;
    }
    if (body.trim().length < 20) {
      notify('Almost there', 'Describe the concern in at least 20 characters.');
      return;
    }
    setSaving(true);
    try {
      const id = await createConcern(profile, { title, body, scope });
      // Land on the newly opened concern. Dismiss the modal first - a bare
      // replace() from inside a native modal can pop to whatever screen sat
      // under it instead of the target.
      if (router.canDismiss()) router.dismiss();
      router.push(`/concern/${id}`);
    } catch (e) {
      notify('Could not post', e instanceof Error ? e.message : 'Something went wrong.');
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Raise a concern for your neighbors to prioritize. Clear, specific concerns climb the board.
      </ThemedText>

      <Field label="Title" placeholder="e.g. Fix the potholes on Western Ave" value={title} onChangeText={setTitle} />
      <Field
        label="What’s going on?"
        placeholder="Describe the issue, where it happens, and who it affects…"
        value={body}
        onChangeText={setBody}
        multiline
        style={{ minHeight: 120 }}
      />

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Where does this belong?
        </ThemedText>
        <View style={styles.scopeRow}>
          <Pressable
            onPress={() => setScope('city')}
            style={[
              styles.scopeButton,
              {
                borderColor: scope === 'city' ? theme.primary : theme.border,
                backgroundColor: scope === 'city' ? theme.backgroundSelected : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="small" style={scope === 'city' ? { color: theme.primary, fontWeight: '700' } : undefined}>
              Citywide
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={!canPostToWard}
            onPress={() => setScope('ward')}
            style={[
              styles.scopeButton,
              {
                opacity: canPostToWard ? 1 : 0.4,
                borderColor: scope === 'ward' ? theme.primary : theme.border,
                backgroundColor: scope === 'ward' ? theme.backgroundSelected : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="small" style={scope === 'ward' ? { color: theme.primary, fontWeight: '700' } : undefined}>
              {canPostToWard ? `My ward (${wardLabel(profile!.wardId)})` : 'My ward (verify first)'}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <Button title="Post concern" onPress={submit} loading={saving} />
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
