import * as WebBrowser from 'expo-web-browser';
import { ActionSheetIOS, Linking, Platform } from 'react-native';

import { tr } from '@/lib/i18n';

/**
 * Open an external link: the in-app browser on phones, a new tab on the web
 * (expo-web-browser's web version opens a small chromeless popup). Import
 * this statically - `await import('expo-web-browser')` resolved to
 * undefined exports at runtime in dev builds, crashing every link tap.
 */
export async function openLink(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  await WebBrowser.openBrowserAsync(url);
}

/**
 * Open a link that only exists after a server round trip (a Didit
 * session). On the web the tab itself goes there: browsers block a new tab
 * opened after an await, so it would silently never appear.
 */
export async function openLinkAfterAwait(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.location.assign(url);
    return;
  }
  await WebBrowser.openBrowserAsync(url);
}

/**
 * Directions to an address in the person's own maps app (2026-09-30).
 * iPhone: Apple Maps, or a choice of Apple Maps, Google Maps, and Waze when
 * either of those is installed (their schemes are listed under
 * LSApplicationQueriesSchemes in app.json, which canOpenURL requires).
 * Android: a geo: link, which the system hands to the default maps app or
 * offers its own app chooser. The web: Google Maps directions in a new tab.
 */
export async function openDirections(address: string): Promise<void> {
  const q = encodeURIComponent(address);
  const google = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  if (Platform.OS === 'web') return openLink(google);
  if (Platform.OS === 'android') {
    try {
      await Linking.openURL(`geo:0,0?q=${q}`);
    } catch {
      await openLink(google);
    }
    return;
  }
  const apps: { label: string; url: string }[] = [{ label: 'Apple Maps', url: `maps://?daddr=${q}` }];
  const [hasGoogle, hasWaze] = await Promise.all([
    Linking.canOpenURL('comgooglemaps://').catch(() => false),
    Linking.canOpenURL('waze://').catch(() => false),
  ]);
  if (hasGoogle) apps.push({ label: 'Google Maps', url: `comgooglemaps://?daddr=${q}` });
  if (hasWaze) apps.push({ label: 'Waze', url: `waze://?q=${q}&navigate=yes` });
  const open = (url: string) => Linking.openURL(url).catch(() => openLink(google));
  if (apps.length === 1) return open(apps[0].url);
  ActionSheetIOS.showActionSheetWithOptions(
    { title: tr('Directions'), options: [...apps.map((a) => a.label), tr('Cancel')], cancelButtonIndex: apps.length },
    (i) => {
      if (i < apps.length) void open(apps[i].url);
    }
  );
}
