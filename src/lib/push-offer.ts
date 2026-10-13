import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Alert } from 'react-native';

import { getLocale, tr } from '@/lib/i18n';
import { notify } from '@/lib/notify';
import { pushSupported, setPushPref, type PushPref } from '@/lib/push';
import type { UserProfile } from '@/lib/types';

/**
 * Asking for phone notifications at the moment they mean something
 * (2026-10-09, Brian's call; until then only Settings asked, and no one
 * turned them on): right after someone asks a politician a question, raises
 * a concern, or comments, one question about exactly that kind of notice.
 * Each kind is offered once per phone and never again after an answer
 * either way; Settings stays the place to change it later. Phones only,
 * and never when that kind is already on.
 */
const OFFERS: Record<'answers' | 'comments' | 'replies', { title: string; body: string }> = {
  answers: {
    title: 'Get a notification when they answer?',
    body: 'Your phone will tell you when your question gets an answer. You can change this any time in Settings.',
  },
  comments: {
    title: 'Get a notification when someone comments?',
    body: 'Your phone will tell you when someone comments on your concern. You can change this any time in Settings.',
  },
  replies: {
    title: 'Get a notification when someone replies?',
    body: 'Your phone will tell you when someone replies to your comment. You can change this any time in Settings.',
  },
};

const ASKED = (kind: string) => `pushOffer.${kind}`;

export async function offerPush(profile: UserProfile | null, kind: keyof typeof OFFERS): Promise<void> {
  if (!profile || !pushSupported || !Device.isDevice) return;
  if (profile.pushPrefs?.[kind as PushPref]) return;
  try {
    if (await AsyncStorage.getItem(ASKED(kind))) return;
    await AsyncStorage.setItem(ASKED(kind), new Date().toISOString());
  } catch {
    return;
  }
  // After the screen settles (a cleared ask box, a new concern opening).
  await new Promise((r) => setTimeout(r, 700));
  const offer = OFFERS[kind];
  Alert.alert(tr(offer.title), tr(offer.body), [
    { text: tr('Not now'), style: 'cancel' },
    {
      text: tr('Turn on'),
      onPress: () => {
        setPushPref(profile, kind as PushPref, true, getLocale())
          .then((result) => {
            if (result === 'denied') {
              notify(
                tr('Notifications are off for this app'),
                tr('Your phone has notifications turned off for this app. Turn them on in your phone’s settings.')
              );
            }
          })
          .catch(() => notify(tr('Could not turn on notifications')));
      },
    },
  ]);
}
