import { Platform } from 'react-native';

/**
 * An entrance animation on phones only. On the web, Reanimated hides an
 * element until its entering animation starts, and one mounted while its
 * tab is in the background never starts: the board's cards came back from
 * another tab invisible (2026-09-30). The web gets them without the fade.
 */
export function enter<T>(animation: T): T | undefined {
  return Platform.OS === 'web' ? undefined : animation;
}
