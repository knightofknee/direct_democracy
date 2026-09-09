import { tr } from '@/lib/i18n';
import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert. React Native's Alert is a silent no-op on web, which
 * swallows real errors - this routes to window.alert there instead.
 */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function notifyError(title: string, error: unknown): void {
  notify(title, error instanceof Error ? error.message : tr('Something went wrong.'));
}

/**
 * Cross-platform destructive confirmation - the system-level second gate for
 * actions that must be hard to do by accident. Resolves true only on an
 * explicit confirm: the native alert's destructive button, or window.confirm
 * on web (where RN's Alert never fires).
 */
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
