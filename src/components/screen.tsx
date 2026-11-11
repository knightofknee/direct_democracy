import { LinearGradient } from 'expo-linear-gradient';
import { useScrollToTop, useSegments } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HelpButton } from '@/components/help-button';
import { NotificationBell } from '@/components/notification-bell';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useKeyboardOverlap, useRevealFocusedField } from '@/hooks/use-keyboard-overlap';
import { useTheme } from '@/hooks/use-theme';

/**
 * Scrollable screen shell: safe areas, tab-bar inset, centered max width,
 * keyboard avoidance. Every screen with a text input must live inside this
 * shell (or another ScrollView with automaticallyAdjustKeyboardInsets) so the
 * keyboard never covers what the user is typing: iOS shifts the content via
 * the keyboard inset; on Android, which draws edge to edge and so no longer
 * shrinks the window for the keyboard, the shell pads itself by however much
 * the keyboard overlaps it (`useKeyboardOverlap`), and the ScrollView scrolls
 * the focused field back into view.
 */
export const Screen = React.forwardRef<
  ScrollView,
  {
    children: React.ReactNode;
    /** True for screens inside the tab bar (adds top + bottom insets). */
    tab?: boolean;
    style?: StyleProp<ViewStyle>;
    /**
     * Pinned under the scrolling content, always in view (the ballot's
     * Next / Done on a race page). Not for tab screens.
     */
    footer?: React.ReactNode;
  }
>(function Screen({ children, tab, style, footer }, ref) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // A page pushed inside a tab (the elections tab's stack) sits above the
  // tab bar, which already clears the phone's home indicator.
  const segments = useSegments();
  const aboveTabBar = !tab && segments[0] === '(tabs)';
  const bottomInset = aboveTabBar ? 0 : insets.bottom;
  const shellRef = React.useRef<View>(null);
  const keyboard = useKeyboardOverlap(shellRef);

  // Re-tapping the focused tab scrolls its screen back to the top (the
  // platform convention). No-op on screens without a tab ancestor.
  const scrollRef = React.useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const contentRef = React.useRef<View>(null);
  // A screen outside the tab bar may be an iOS sheet (the MODAL screens).
  useRevealFocusedField(scrollRef, contentRef, tab || aboveTabBar ? undefined : shellRef);
  const setRef = (node: ScrollView | null) => {
    scrollRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <View ref={shellRef} style={{ flex: 1, backgroundColor: theme.background, paddingBottom: keyboard }}>
      <ScrollView
        ref={setRef}
        // React Native's type for this prop leaves out the null every ref starts as.
        innerViewRef={contentRef as React.RefObject<View>}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: tab ? insets.top + Spacing.two : Spacing.three,
            paddingBottom: footer ? Spacing.four : (tab ? BottomTabInset : 0) + bottomInset + Spacing.five,
          },
          style,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        bounces={false}
        overScrollMode="never">
        <View style={styles.inner}>
          {tab && (
            // Tab screens have no header, so their help "?" sits in the
            // same top-right corner every other screen's header puts it,
            // with the notifications bell beside it. A row of its own, not
            // laid over the page: with large text on a narrow phone the
            // tab's title would run into the two icons.
            <View style={styles.corner}>
              <NotificationBell />
              <HelpButton />
            </View>
          )}
          {children}
        </View>
      </ScrollView>
      {footer != null && (
        <View
          style={[
            styles.footer,
            { borderTopColor: theme.border, backgroundColor: theme.background, paddingBottom: bottomInset + Spacing.two },
          ]}>
          <View style={styles.inner}>{footer}</View>
        </View>
      )}
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
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  corner: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 18,
    // The page's gap below it is enough; the row itself adds no space.
    marginBottom: -Spacing.two,
  },
});
