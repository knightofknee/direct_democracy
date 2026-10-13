import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { Platform, Share } from 'react-native';

import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { notify } from '@/lib/notify';

/** The app's own page on waldgrave.com, with the App Store and Google Play buttons. */
const APP_PAGE = 'https://www.waldgrave.com/directdemocracy';

/**
 * "Share the app" (2026-10-09, from tester feedback): the phone's share
 * sheet with a short message the person can edit before sending. No
 * referral codes or tracking: the link is the same for everyone.
 */
export function ShareAppButton() {
  const t = useT();
  const share = async () => {
    const message = `${t('I use direct democracy to follow Chicago: rate your alderman, ask them anything, plan your ballot, and read the city\'s news in one place.')} ${APP_PAGE}`;
    try {
      if (Platform.OS === 'web') {
        const nav = globalThis.navigator as Navigator | undefined;
        if (nav?.share) {
          await nav.share({ text: message });
          return;
        }
        await Clipboard.setStringAsync(message);
        notify(t('Copied'), t('Paste it anywhere to share the app.'));
        return;
      }
      await Share.share(Platform.OS === 'ios' ? { message: message.replace(` ${APP_PAGE}`, ''), url: APP_PAGE } : { message });
    } catch {
      // The person closed the share sheet.
    }
  };
  return <Button title={t('Share the app')} variant="secondary" onPress={() => void share()} />;
}
