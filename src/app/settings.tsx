import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { setDeletingAccount, useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useLocale, useT } from '@/lib/i18n';
import { confirmDestructive, notify, notifyError } from '@/lib/notify';
import { deleteAccount } from '@/services/users';

/** The rarely-needed account plumbing, kept out of the profile's way. */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { locale, setLocale } = useLocale();
  const t = useT();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Language is the one setting that must work signed out too.
  const language = (
    <Card>
      <ThemedText type="smallBold" style={{ fontSize: 13 }}>
        Language · Idioma
      </ThemedText>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <Button
          title="English"
          variant={locale === 'en' ? 'primary' : 'secondary'}
          onPress={() => setLocale('en')}
          style={{ flex: 1 }}
        />
        <Button
          title="Español"
          variant={locale === 'es' ? 'primary' : 'secondary'}
          onPress={() => setLocale('es')}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );

  if (!profile) {
    return (
      <Screen>
        {language}
        <Button title="Sign in first" onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {language}
      <Button title={t('Privacy & data')} variant="secondary" onPress={() => router.push('/privacy')} />

      {profile.role === 'citizen' && (
        <Card>
          <ThemedText type="smallBold" style={{ fontSize: 13, color: theme.danger }}>
            Delete account
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            Permanently removes your sign-in, profile, verification status, and standing approvals
            of officials. Anything you posted stays on the record but is re-attributed to
            [deleted], and votes you cast remain counted. This cannot be undone.
          </ThemedText>
          {confirmDelete ? (
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Button
                title="Yes, delete forever"
                variant="danger"
                loading={deleting}
                style={{ flex: 1 }}
                onPress={async () => {
                  // Third gate: the most destructive action in the app gets a
                  // system alert on top of the inline two-step.
                  const sure = await confirmDestructive(
                    'Delete your account?',
                    'This permanently removes your sign-in, profile, verification, and standing approvals. Posts stay on the record as [deleted] and cast ballots remain counted. It cannot be undone.',
                    'Delete forever'
                  );
                  if (!sure) return;
                  setDeleting(true);
                  // Stop the profile listener from re-creating the doc the
                  // server is busy deleting (it would resurrect the account).
                  setDeletingAccount(true);
                  try {
                    await deleteAccount();
                    await signOut();
                    notify('Account deleted', 'Your account and identity data are gone.');
                  } catch (e) {
                    notifyError('Could not delete account', e);
                    setDeleting(false);
                  } finally {
                    setDeletingAccount(false);
                  }
                }}
              />
              <Button
                title="Keep my account"
                variant="ghost"
                style={{ flex: 1 }}
                onPress={() => setConfirmDelete(false)}
              />
            </View>
          ) : (
            <Button
              title="Delete my account…"
              variant="ghost"
              onPress={() => setConfirmDelete(true)}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}
