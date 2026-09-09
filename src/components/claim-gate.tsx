import { sendEmailVerification } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useT } from '@/lib/i18n';
import { notify, notifyError } from '@/lib/notify';
import { refreshClaim } from '@/services/notifications';

/**
 * Shown to an official or candidate on their own page while their email is
 * unconfirmed. Security rules refuse every act-as-politician write until the
 * auth token carries email_verified, so this explains the lock and offers
 * the confirmation email. Once verified (or signed in via SSO/magic link,
 * which verify implicitly), it silently reports the claim to the server so
 * the public "on the platform" status flips without waiting for the nightly
 * sweep.
 */
export function ClaimGate({ claimed, name }: { claimed?: boolean; name: string }) {
  const theme = useTheme();
  const t = useT();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // auth.currentUser mutates in place; bump to re-read after a recheck.
  const [, bump] = useState(0);
  const user = auth.currentUser;
  const verified = !!user?.emailVerified;

  useEffect(() => {
    if (verified && claimed !== true) {
      refreshClaim().catch(() => {});
    }
  }, [verified, claimed]);

  if (!user || verified) return null;

  const send = async () => {
    setSending(true);
    try {
      await sendEmailVerification(user);
      setSent(true);
    } catch (e) {
      notifyError(t('Could not send'), e);
    } finally {
      setSending(false);
    }
  };

  const recheck = async () => {
    setSending(true);
    try {
      await user.reload();
      // The rules read email_verified off the token - force a fresh one.
      await user.getIdToken(true);
      if (auth.currentUser?.emailVerified) {
        await refreshClaim().catch(() => {});
      } else {
        notify(t('Not confirmed yet'), t('Open the confirmation email first, then tap this again.'));
      }
      bump((n) => n + 1);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card style={{ borderColor: theme.warning, borderWidth: 1 }}>
      <ThemedText type="smallBold" style={{ fontSize: 14 }}>
        {t('Confirm your email to act as {name}').replace('{name}', name)}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {t('Until the address is confirmed, this account can read but not respond, post, or edit. The confirmation proves the inbox is really yours.')}
      </ThemedText>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <Button
          title={sent ? t('Sent - check your inbox') : t('Send confirmation email')}
          variant="secondary"
          onPress={send}
          loading={sending && !sent}
          disabled={sent}
          style={{ flex: 1 }}
        />
        {sent && (
          <Button title={t('I confirmed it')} onPress={recheck} loading={sending} style={{ flex: 1 }} />
        )}
      </View>
    </Card>
  );
}
