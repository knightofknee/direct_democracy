import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { deleteField, doc, FieldPath, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { db } from '@/lib/firebase';
import type { Locale } from '@/lib/i18n';
import { notificationLink } from '@/lib/notification-links';
import type { Role, UserProfile } from '@/lib/types';

/**
 * Phone notifications (2026-09-29). Nothing asks for permission until the
 * person turns a switch on in Settings; each switch lets one kind of
 * notification reach the phone (users/{uid}.pushPrefs), and this phone's
 * Expo push token is stored with its language (users/{uid}.pushTokens) so
 * the server (sendPush in functions) can send in the right one. Kinds not
 * listed here stay in the notifications tab only: verdicts, verification
 * results, and posting-limit notices. Mirror of PUSH_PREF_FOR_TYPE in
 * functions/src/index.ts.
 */
export const PUSH_SWITCHES: { key: PushPref; label: string; roles?: Role[] }[] = [
  { key: 'deadline', label: 'Election reminders' },
  { key: 'answers', label: 'A politician answered your question' },
  { key: 'comments', label: 'Comments on your posts' },
  { key: 'replies', label: 'Replies to your comments' },
  { key: 'credits', label: 'Writing credits on your comments' },
  { key: 'questions', label: 'New questions for you', roles: ['official'] },
];

export type PushPref = 'deadline' | 'answers' | 'comments' | 'replies' | 'credits' | 'questions';

/** Phone notifications exist in the iPhone and Android apps only. */
export const pushSupported = Platform.OS !== 'web';

const TOKEN_KEY = 'dd:pushToken';

if (pushSupported) {
  // A notification that arrives while the app is open still shows.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ask for permission (the first time only) and register this phone. Null
 * when refused or unavailable (a simulator, the web).
 */
/**
 * Android 13+ needs the channel before the prompt or the token, and older
 * Android drops a push that names a channel the phone doesn't have.
 */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'direct democracy',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

async function registerThisPhone(): Promise<string | null> {
  if (!pushSupported || !Device.isDevice) return null;
  await ensureChannel();
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

async function storeToken(uid: string, token: string, locale: Locale): Promise<void> {
  await updateDoc(
    doc(db, 'users', uid),
    new FieldPath('pushTokens', token),
    { locale, platform: Platform.OS, updatedAt: serverTimestamp() }
  );
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/**
 * Flip one switch. Turning one on registers this phone first; the result
 * says whether the phone allowed notifications at all.
 */
export async function setPushPref(
  profile: UserProfile,
  key: PushPref,
  on: boolean,
  locale: Locale
): Promise<'ok' | 'denied' | 'unsupported'> {
  if (on) {
    if (!pushSupported || !Device.isDevice) return 'unsupported';
    const token = await registerThisPhone();
    if (!token) return 'denied';
    await storeToken(profile.uid, token, locale);
  }
  await updateDoc(doc(db, 'users', profile.uid), new FieldPath('pushPrefs', key), on);
  return 'ok';
}

/** Whether the phone itself still allows notifications from the app. */
export async function phoneAllowsPush(): Promise<boolean> {
  if (!pushSupported) return false;
  return (await Notifications.getPermissionsAsync()).status === 'granted';
}

/**
 * Forget this phone's token on sign-out, so the next account's notices don't
 * land here. Never holds sign-out up: offline, a Firestore write doesn't
 * settle, so after 3 seconds sign-out goes ahead (the server hands the token
 * to whichever account registers it next, see onPushTokensChanged).
 */
export async function forgetThisPhone(uid: string): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
  await Promise.race([
    updateDoc(doc(db, 'users', uid), new FieldPath('pushTokens', token), deleteField()).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}

/**
 * Keep this phone's token current: refresh it with the app's language
 * (notifications arrive in it), and re-register if the OS rotated it.
 * Only for a phone that turned a switch on here, under this account: never
 * prompts, and a phone that only ever signed in doesn't start receiving.
 */
export function usePushTokenSync(profile: UserProfile | null, locale: Locale): void {
  const uid = profile?.uid;
  const tokens = profile?.pushTokens;
  useEffect(() => {
    if (!pushSupported || !uid) return;
    let live = true;
    (async () => {
      const mine = await AsyncStorage.getItem(TOKEN_KEY);
      if (!mine || !tokens || !(mine in tokens)) return;
      if ((await Notifications.getPermissionsAsync()).status !== 'granted') return;
      await ensureChannel();
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      if (!live) return;
      if (data !== mine) {
        // The OS rotated it: the old one goes, the new one takes its place.
        await updateDoc(doc(db, 'users', uid), new FieldPath('pushTokens', mine), deleteField()).catch(() => {});
      }
      await storeToken(uid, data, locale);
    })().catch(() => {});
    return () => {
      live = false;
    };
    // tokens is read once per account/language change, not on every write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, locale]);
}

/**
 * Tapping a phone notification opens the item it's about (cold start
 * included). Waits for sign-in to load, so an official's AMA notice opens
 * their command center, not their public page.
 */
export function useNotificationTaps(uid: string | null | undefined, ready: boolean): void {
  useEffect(() => {
    if (!pushSupported || !ready) return;
    const open = (n: Notifications.Notification) => {
      const link = n.request.content.data?.link;
      if (typeof link === 'string' && link.startsWith('/')) {
        router.push(notificationLink(link, uid) as Href);
      }
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last.notification);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    return () => sub.remove();
  }, [uid, ready]);
}
