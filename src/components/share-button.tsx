import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { Platform, Pressable, Share } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { notify } from '@/lib/notify';

/**
 * Links people share open the web version on waldgrave.com, so anyone can
 * read them without the app; with the app installed, the same link opens it
 * (see +native-intent.ts).
 */
export const WEB_APP_URL = 'https://www.waldgrave.com/directdemocracy/app';

/** The public web link for a screen of the app, e.g. shareUrl('/concern/abc'). */
export function shareUrl(path: string): string {
  return `${WEB_APP_URL}${path}`;
}

/**
 * The share icon on a page people pass along: the phone's own share sheet
 * in the app; on the web, the browser's share sheet where there is one,
 * else the link copied.
 */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const theme = useTheme();
  const t = useT();
  const url = shareUrl(path);

  const share = async () => {
    try {
      if (Platform.OS === 'web') {
        const nav = globalThis.navigator as Navigator | undefined;
        if (nav?.share) {
          await nav.share({ title, url });
          return;
        }
        await Clipboard.setStringAsync(url);
        notify(t('Link copied'), url);
        return;
      }
      // iOS shares the url on its own; Android only takes the message.
      await Share.share(Platform.OS === 'ios' ? { message: title, url } : { message: `${title}\n${url}` });
    } catch {
      // Dismissed or unavailable; nothing to tell anyone.
    }
  };

  return (
    <Pressable
      onPress={() => void share()}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('Share')}>
      <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={18} color={theme.primary} />
    </Pressable>
  );
}
