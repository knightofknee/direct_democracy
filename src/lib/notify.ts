import { getLocale, tr } from '@/lib/i18n';
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

/** A plain line for each kind of server or database error, translated like any string. */
const ERROR_KINDS: Record<string, string> = {
  unauthenticated: 'Sign in first.',
  'permission-denied': 'You don’t have permission to do this.',
  'not-found': 'That wasn’t found.',
  'already-exists': 'That already exists.',
  'resource-exhausted': 'You’ve reached the limit for now. Try again later.',
  'failed-precondition': 'That can’t be done yet.',
  'invalid-argument': 'Something in what you entered isn’t valid.',
  unavailable: 'No connection. Check your connection and try again.',
  'deadline-exceeded': 'That took too long. Try again.',
  internal: 'Something went wrong on the server. Try again.',
};

/**
 * The text to show for an error, in the app's language. Our own messages
 * (services, server callables) are dictionary keys like every other string,
 * so a known message translates fully. Anything else, outside English,
 * gets a translated line for its kind of error with the English detail
 * under it.
 */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (!message) return tr('Something went wrong.');
  if (getLocale() === 'en') return message;
  const translated = tr(message);
  if (translated !== message) return translated;
  // A plain Error with no code is one of our own service checks, already
  // written in the app's language: show it as it is.
  if (!(error as { code?: string }).code) return message;
  const code = String((error as { code?: string }).code ?? '').replace(/^(functions|firestore|auth)\//, '');
  return `${tr(ERROR_KINDS[code] ?? 'Something went wrong.')}\n\n${message}`;
}

export function notifyError(title: string, error: unknown): void {
  notify(title, errorMessage(error));
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
        { text: tr('Cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
