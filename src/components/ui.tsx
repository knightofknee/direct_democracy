import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tr } from '@/lib/i18n';

export function Card({
  children,
  style,
  onPress,
  accessible,
  accessibilityLabel,
  accessibilityHint,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /**
   * A tappable card is one screen reader element by default. A card that
   * holds its own buttons passes false so each control stays reachable, and
   * makes its title the link that opens it.
   */
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const base = [
    styles.card,
    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessible={accessible}
        accessibilityRole={accessible === false ? undefined : 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [
          ...base,
          pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
        ]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View
      style={base}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  icon,
  selected,
  expanded,
  accessibilityLanguage,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
  /** The chosen one of a set (a language), told to screen readers. */
  selected?: boolean;
  /** For a show more / show less button: whether the text is open. */
  expanded?: boolean;
  /** Speak the title in this language (a language's own name). */
  accessibilityLanguage?: string;
}) {
  const theme = useTheme();
  const background =
    variant === 'primary'
      ? theme.primary
      : variant === 'danger'
        ? theme.danger
        : variant === 'secondary'
          ? theme.backgroundSelected
          : 'transparent';
  const color =
    variant === 'primary' || variant === 'danger' ? '#FFFFFF' : theme.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      // A screen reader hears a button, its name even while the spinner
      // shows, and whether it's off (posting limits) or working.
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityLanguage={accessibilityLanguage}
      accessibilityState={{
        disabled: !!(disabled || loading),
        busy: !!loading,
        selected,
        expanded,
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          {icon}
          <ThemedText type="smallBold" style={{ color }}>
            {title}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const theme = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: Spacing.one }}>
      {label ? (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        // Typed text follows the phone's text size as far as body text does
        // (ThemedText's 2x); uncapped it reached 3x and a placeholder filled
        // the screen.
        maxFontSizeMultiplier={2}
        {...rest}
        // The visible label (or the placeholder) names the field for a
        // screen reader, which otherwise hears only "text field".
        accessibilityLabel={rest.accessibilityLabel ?? label ?? rest.placeholder}
        style={[
          styles.field,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            color: theme.text,
          },
          style,
        ]}
      />
    </View>
  );
}

/** Green check shown everywhere a verified identity speaks or is counted. */
export function VerifiedBadge({ compact }: { compact?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.badge, { backgroundColor: theme.verifiedSoft }]}
      // The compact badge is only an icon; give it its word.
      accessible={compact ? true : undefined}
      accessibilityLabel={compact ? tr('Verified') : undefined}>
      <Ionicons name="shield-checkmark" size={12} color={theme.verified} />
      {!compact && (
        <ThemedText type="small" style={{ color: theme.verified, fontSize: 12, lineHeight: 16 }}>
          {tr('Verified')}
        </ThemedText>
      )}
    </View>
  );
}

export function Chip({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  const tones = {
    neutral: { bg: theme.backgroundSelected, fg: theme.textSecondary },
    primary: { bg: theme.primarySoft, fg: theme.primary },
    success: { bg: theme.verifiedSoft, fg: theme.verified },
    warning: { bg: theme.warningSoft, fg: theme.warning },
    danger: { bg: theme.dangerSoft, fg: theme.danger },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: tones.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={tones.fg} /> : null}
      <ThemedText type="small" style={{ color: tones.fg, fontSize: 12, lineHeight: 16 }}>
        {label}
      </ThemedText>
    </View>
  );
}

export function SectionHeader({
  title,
  subtitle,
  centered,
}: {
  title: string;
  subtitle?: string;
  /** Center both lines, for a header that titles the whole list under it. */
  centered?: boolean;
}) {
  const align = centered ? ({ textAlign: 'center' } as const) : null;
  return (
    <View style={{ gap: 2, marginTop: Spacing.three }}>
      <ThemedText
        type="smallBold"
        accessibilityRole="header"
        style={[{ textTransform: 'uppercase', letterSpacing: 1 }, align]}>
        {title}
      </ThemedText>
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary" style={align}>
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, message }: { icon: keyof typeof Ionicons.glyphMap; message: string }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={28} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {message}
      </ThemedText>
    </View>
  );
}

/** The Chicago flag's six-pointed star, used as a small brand accent. */
export function ChicagoStar({ size = 14 }: { size?: number }) {
  const theme = useTheme();
  return <Ionicons name="star" size={size} color={theme.accent} />;
}

/**
 * Centered explainer dialog behind an info icon: details that would clutter
 * the screen as visible text. Closes on the backdrop or the X.
 */
export function InfoModal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Neither Pressable is a screen reader element, so the title, the
          text, and the close button are each reached on their own. */}
      <Pressable style={styles.modalBackdrop} onPress={onClose} accessible={false}>
        <Pressable
          accessible={false}
          style={[
            styles.modalCard,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
          // Swallow taps so touching the card doesn't dismiss it.
          onPress={() => {}}>
          <View style={styles.modalHeader}>
            <ThemedText type="smallBold" accessibilityRole="header" style={{ fontSize: 17, flex: 1 }}>
              {title}
            </ThemedText>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={tr('Close')}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: 420,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  field: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 44,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
});
