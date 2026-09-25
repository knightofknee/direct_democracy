import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { setDeletingAccount, useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useLocale, useT } from '@/lib/i18n';
import { confirmDestructive, notify, notifyError } from '@/lib/notify';
import { reverifyOpensAt } from '@/lib/verification';
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
        <Button title={t('Sign in first')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {language}
      <Button title={t('Privacy & data')} variant="secondary" onPress={() => router.push('/privacy')} />

      {/* Officials and candidates keep the ward their account was set up
          with, so moving is a citizen setting. */}
      {profile.role === 'citizen' && <VerificationCard />}

      {profile.role === 'citizen' && (
        <Card>
          <ThemedText type="smallBold" style={{ fontSize: 13, color: theme.danger }}>
            {t('Delete account')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('Permanently removes your sign-in, profile, verification status, and standing approvals of officials. Anything you posted stays on the record but is re-attributed to [deleted], and votes you cast remain counted. This cannot be undone.')}
          </ThemedText>
          {confirmDelete ? (
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Button
                title={t('Yes, delete forever')}
                variant="danger"
                loading={deleting}
                style={{ flex: 1 }}
                onPress={async () => {
                  // Third gate: the most destructive action in the app gets a
                  // system alert on top of the inline two-step.
                  const sure = await confirmDestructive(
                    t('Delete your account?'),
                    t('This permanently removes your sign-in, profile, verification, and standing approvals. Posts stay on the record as [deleted] and cast ballots remain counted. It cannot be undone.'),
                    t('Delete forever')
                  );
                  if (!sure) return;
                  setDeleting(true);
                  // Stop the profile listener from re-creating the doc the
                  // server is busy deleting (it would resurrect the account).
                  setDeletingAccount(true);
                  try {
                    await deleteAccount();
                    await signOut();
                    notify(t('Account deleted'), t('Your account and identity data are gone.'));
                  } catch (e) {
                    notifyError(t('Could not delete account'), e);
                    setDeleting(false);
                  } finally {
                    setDeletingAccount(false);
                  }
                }}
              />
              <Button
                title={t('Keep my account')}
                variant="ghost"
                style={{ flex: 1 }}
                onPress={() => setConfirmDelete(false)}
              />
            </View>
          ) : (
            <Button
              title={t('Delete my account…')}
              variant="ghost"
              onPress={() => setConfirmDelete(true)}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}

/**
 * Verification status, and for someone verified, moving: verify a new
 * address with the ID alone, or with a bill or statement when the ID still
 * shows the old one. Once every 3 months either way (the server enforces
 * the window; the buttons mirror it).
 */
function VerificationCard() {
  const router = useRouter();
  const { profile } = useAuth();
  const { locale } = useLocale();
  const t = useT();
  if (!profile) return null;

  if (!profile.verified) {
    return (
      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 13 }}>
          {t('Verification')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('Verify to participate in your ward’s board and polls.')}
        </ThemedText>
        <Button title={t('Verify my identity')} onPress={() => router.push('/verify')} />
      </Card>
    );
  }

  const opensAt = reverifyOpensAt(profile);
  const opensOn = opensAt?.toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return (
    <Card>
      <ThemedText type="smallBold" style={{ fontSize: 13 }}>
        {t('Verification')}
      </ThemedText>
      {profile.wardId != null && (
        <ThemedText type="small">
          {t('Resident of the {ward}.').replace('{ward}', wardLabel(profile.wardId))}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {opensOn
          ? t('You can verify a new address again on {date}.').replace('{date}', opensOn)
          : t('Moved within Chicago? Verify your new address and your ward moves with you. If your ID shows the new address, your ID is enough. If it doesn’t, add a utility bill or bank statement from the last 3 months. You can do this once every 3 months.')}
      </ThemedText>
      <Button
        title={t('Verify with my ID')}
        variant="secondary"
        disabled={opensAt != null}
        onPress={() => router.push('/verify?move=1')}
      />
      <Button
        title={t('Verify with a bill or statement')}
        variant="secondary"
        disabled={opensAt != null}
        onPress={() => router.push('/verify?move=1&with=address')}
      />
    </Card>
  );
}
