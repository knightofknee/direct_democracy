import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert. React Native's Alert is a silent no-op on web, which
 * swallows real errors — this routes to window.alert there instead.
 */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function notifyError(title: string, error: unknown): void {
  notify(title, error instanceof Error ? error.message : 'Something went wrong.');
}
