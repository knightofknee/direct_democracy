import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, ChoiceRow, Field } from '@/components/ui';
import { DailyLimitNote } from '@/components/ward-post-note';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useT } from '@/lib/i18n';
import { notify, notifyError } from '@/lib/notify';
import { usePageSummary } from '@/lib/page-help';
import { useRateWindow } from '@/lib/rate-limits';
import { FEEDBACK_TOPICS, sendFeedback, type FeedbackTopic } from '@/services/feedback';

/**
 * Send feedback or report a problem (2026-10-22), from Settings: one form
 * that reaches the operators without leaving the app, signed in or not.
 * Posts and comments are reported with the flag on each one; this is for
 * everything else, child safety first.
 */
export default function FeedbackScreen() {
  const router = useRouter();
  const t = useT();
  const { user, profile } = useAuth();
  const [topic, setTopic] = useState<FeedbackTopic | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const opensAt = useRateWindow('feedback');

  usePageSummary('feedback', [
    profile
      ? user?.email
        ? t('Answers go to {email}.').replace('{email}', user.email)
        : t('You are signed in.')
      : t('You are signed out. Add an email if you want an answer.'),
  ]);

  const send = async () => {
    if (!topic) return;
    setSending(true);
    try {
      await sendFeedback({ topic, message, email: profile ? undefined : email });
      notify(t('Message sent'), t('Thank you. The operators read every message.'));
      router.back();
    } catch (e) {
      notifyError(t('Could not send your message'), e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        {t('To report a post or comment, tap the flag on it. For anything else, write to the operators here.')}
      </ThemedText>

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="smallBold" accessibilityRole="header">
          {t('What is this about?')}
        </ThemedText>
        {FEEDBACK_TOPICS.map((x) => (
          <ChoiceRow
            key={x.key}
            kind="radio"
            label={t(x.label)}
            checked={topic === x.key}
            onPress={() => setTopic(x.key)}
            disabled={sending}
          />
        ))}
      </View>

      {topic === 'childSafety' && (
        <ThemedText type="small" themeColor="textSecondary">
          {t('Child safety messages reach the operator right away. If a child is in danger now, call 911.')}
        </ThemedText>
      )}

      <Field
        label={t('Your message')}
        value={message}
        onChangeText={setMessage}
        placeholder={t('What happened, and where in the app?')}
        multiline
        maxLength={2000}
        style={{ minHeight: 120, textAlignVertical: 'top' }}
      />

      {!profile && (
        <Field
          label={t('Your email (optional)')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('Only if you want an answer')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          maxLength={200}
        />
      )}

      <DailyLimitNote bucket="feedback" nextAt={opensAt} />
      <Button
        title={t('Send')}
        onPress={() => void send()}
        loading={sending}
        disabled={!topic || message.trim().length < 10 || opensAt != null}
      />
      {message.length > 0 && message.trim().length < 10 && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('10 character minimum')}
        </ThemedText>
      )}
    </Screen>
  );
}
