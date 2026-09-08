import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic accents on meaningful actions only - casting a ballot or judgment,
 * and milestone celebrations. Never on plain navigation. All of them are
 * fire-and-forget no-ops on web.
 */

/** Light tap for casting or changing a vote/judgment/approval. */
export function tapHaptic(): void {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Success notification for milestone celebrations. */
export function successHaptic(): void {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
