import * as WebBrowser from 'expo-web-browser';

/**
 * Open an external link in the in-app browser. Import this statically -
 * `await import('expo-web-browser')` resolved to undefined exports at
 * runtime in dev builds, crashing every link tap.
 */
export async function openLink(url: string): Promise<void> {
  await WebBrowser.openBrowserAsync(url);
}
