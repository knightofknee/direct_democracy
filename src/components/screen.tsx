import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Scrollable screen shell: safe areas, tab-bar inset, centered max width,
 * keyboard avoidance. Every screen with a text input must live inside this
 * shell (or another ScrollView with automaticallyAdjustKeyboardInsets) so the
 * keyboard never covers what the user is typing: iOS shifts the content via
 * the keyboard inset; Android resizes the window (softwareKeyboardLayoutMode
 * defaults to resize).
 */
export function Screen({
  children,
  tab,
  style,
}: {
  children: React.ReactNode;
  /** True for screens inside the tab bar (adds top + bottom insets). */
  tab?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: tab ? insets.top + Spacing.three : Spacing.three,
          paddingBottom: (tab ? BottomTabInset : 0) + insets.bottom + Spacing.five,
        },
        style,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      bounces={false}
      overScrollMode="never">
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
  },
});
