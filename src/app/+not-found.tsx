import { Stack, useRouter } from 'expo-router';
import React from 'react';

import { Screen } from '@/components/screen';
import { Button, EmptyState } from '@/components/ui';
import { useT } from '@/lib/i18n';

/**
 * A link to a page that doesn't exist (an old share link, a mistyped web
 * address): say so in the reader's language and offer the way home,
 * instead of expo-router's English developer page.
 */
export default function NotFoundScreen() {
  const router = useRouter();
  const t = useT();
  return (
    <Screen>
      <Stack.Screen options={{ title: t('Not found') }} />
      <EmptyState icon="alert-circle-outline" message={t('This page doesn’t exist, or it was removed.')} />
      <Button title={t('Go to the home tab')} onPress={() => router.replace('/')} />
    </Screen>
  );
}
