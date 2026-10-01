import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import type { PostEdit } from '@/lib/types';
import { formatWhen } from '@/lib/ward-posting';

/**
 * "Edited" on a post, which opens its history: when each edit happened,
 * and, for edits made after someone had replied, the text as it stood
 * before, so a reply can always be read against what it answered.
 */
export function EditHistory({ edits }: { edits?: PostEdit[] }) {
  const theme = useTheme();
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!edits || edits.length === 0) return null;
  const newestFirst = [...edits].reverse();
  return (
    <View style={{ gap: Spacing.two }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.toggle}>
        <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {open ? t('Hide edit history') : t('Edited · See edit history')}
        </ThemedText>
      </Pressable>
      {open &&
        newestFirst.map((edit, i) => {
          const when = formatWhen(edit.at.toDate());
          const kept = edit.body != null || edit.title != null;
          return (
            <View key={i} style={[styles.entry, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {kept ? t('Before the edit on {date}:').replace('{date}', when) : t('Edited {date}').replace('{date}', when)}
              </ThemedText>
              {edit.title ? (
                <ThemedText type="smallBold" style={{ fontSize: 14 }}>
                  {edit.title}
                </ThemedText>
              ) : null}
              {edit.body ? <ThemedText type="small">{edit.body}</ThemedText> : null}
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  entry: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.two,
    gap: 2,
  },
});
