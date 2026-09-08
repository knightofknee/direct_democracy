import { LinearGradient } from 'expo-linear-gradient';
import { useScrollToTop } from 'expo-router';
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
export const Screen = React.forwardRef<
  ScrollView,
  {
    children: React.ReactNode;
    /** True for screens inside the tab bar (adds top + bottom insets). */
    tab?: boolean;
    style?: StyleProp<ViewStyle>;
  }
>(function Screen({ children, tab, style }, ref) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Re-tapping the focused tab scrolls its screen back to the top (the
  // platform convention). No-op on screens without a tab ancestor.
  const scrollRef = React.useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const setRef = (node: ScrollView | null) => {
    scrollRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        ref={setRef}
        style={{ flex: 1 }}
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
      {tab && (
        // Tab screens have no native header, so scrolled content would sit
        // flush behind the clock; this fade keeps the status bar readable.
        <LinearGradient
          pointerEvents="none"
          colors={[theme.background, `${theme.background}00`]}
          style={[styles.statusBarFade, { height: insets.top + Spacing.two }]}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
  },
  statusBarFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
  },
});
