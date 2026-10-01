import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { reopenAfterRedraw } from '@/lib/locale-remount';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, Switch, View } from 'react-native';

import { DeclaredWardNote, HomeWardChoice } from '@/components/home-ward-choice';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { setDeletingAccount, useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { dateLocale, LANGUAGES, useLocale, useT } from '@/lib/i18n';
import { usePageSummary } from '@/lib/page-help';
import { confirmDestructive, notify, notifyError } from '@/lib/notify';
import { PUSH_SWITCHES, phoneAllowsPush, pushSupported, setPushPref, type PushPref } from '@/lib/push';
import { reverifyOpensAt } from '@/lib/verification';
import { getVerificationQuote } from '@/services/payments';
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

  usePageSummary('settings', [
    t('Language: {name}.').replace('{name}', LANGUAGES.find((l) => l.code === locale)?.name ?? locale),
    !profile
      ? t('You are signed out.')
      : profile.verified
        ? t('Verified as a resident of the {ward}.').replace('{ward}', wardLabel(profile.wardId))
        : profile.wardId != null
          ? t('Your home ward: the {ward}, set without an ID.').replace('{ward}', wardLabel(profile.wardId))
          : t('You have no home ward yet.'),
  ]);

  // Language is the one setting that must work signed out too.
  const language = (
    <Card>
      <ThemedText type="smallBold" style={{ fontSize: 13 }}>
        Language · Idioma · 语言 · Język · Wika · 언어 · भाषा
      </ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
        {LANGUAGES.map((l) => (
          <Button
            key={l.code}
            title={l.name}
            variant={locale === l.code ? 'primary' : 'secondary'}
            onPress={() => {
              if (l.code === locale) return;
              reopenAfterRedraw('/settings');
              setLocale(l.code);
            }}
            style={{ flexGrow: 1, flexBasis: '45%' }}
          />
        ))}
      </View>
    </Card>
  );

  if (!profile) {
    return (
      <Screen>
        {language}
        <Button title={t('Privacy & data')} variant="secondary" onPress={() => router.push('/privacy')} />
        <RulesLink />
      </Screen>
    );
  }

  return (
    <Screen>
      {language}
      <NotificationsCard />
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
            {t('Permanently removes your sign-in, profile, verification status, and every vote you cast (the tallies drop them). Anything you posted stays on the record but is re-attributed to [deleted]. This cannot be undone.')}
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
                    t('This permanently removes your sign-in, profile, verification, and every vote you cast. Posts stay on the record as [deleted]. It cannot be undone.'),
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
                    // Back to the home tab, where signing out lands too.
                    router.replace('/');
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
      <RulesLink />
    </Screen>
  );
}

/**
 * Verification status, and for someone verified, moving: verify a new
 * address with the ID alone, or with a bill or statement when the ID still
 * shows the old one. Once every 3 months either way (the server enforces
 * the window; the buttons mirror it).
 */
/**
 * Phone notifications, one switch per kind. They live only here: nothing
 * else in the app asks, and the phone's permission prompt appears the first
 * time a switch is turned on. Kinds without a switch (verdicts,
 * verification results, posting-limit notices) stay in the notifications
 * tab, where people see them anyway.
 */
function NotificationsCard() {
  const theme = useTheme();
  const t = useT();
  const { profile } = useAuth();
  const { locale } = useLocale();
  // Optimistic: a switch moves at the tap; a refusal flips it back.
  const [overlay, setOverlay] = useState<Partial<Record<PushPref, boolean>>>({});
  const [phoneOff, setPhoneOff] = useState(false);
  const anyOn = Object.values(profile?.pushPrefs ?? {}).some(Boolean);
  useEffect(() => {
    if (!anyOn) return;
    phoneAllowsPush().then((allowed) => setPhoneOff(!allowed), () => {});
  }, [anyOn]);
  if (!profile) return null;

  const flip = async (key: PushPref, on: boolean) => {
    setOverlay((o) => ({ ...o, [key]: on }));
    try {
      const result = await setPushPref(profile, key, on, locale);
      if (result === 'denied') {
        setOverlay((o) => ({ ...o, [key]: false }));
        setPhoneOff(true);
      } else if (result === 'unsupported') {
        setOverlay((o) => ({ ...o, [key]: false }));
        notify(t('Phone notifications need a real phone'), t('They work in the iPhone and Android apps on a phone, not in a simulator or on the web.'));
      } else {
        setPhoneOff(false);
      }
    } catch (e) {
      setOverlay((o) => ({ ...o, [key]: !on }));
      notifyError(t('Could not save'), e);
    }
  };

  const switches = PUSH_SWITCHES.filter((s) => !s.roles || s.roles.includes(profile.role));
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <Ionicons name="notifications-outline" size={16} color={theme.primary} />
        <ThemedText type="smallBold" style={{ fontSize: 13 }}>
          {t('Phone notifications')}
        </ThemedText>
      </View>
      {!pushSupported ? (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('Phone notifications work in the iPhone and Android apps.')}
        </ThemedText>
      ) : (
        <>
          {switches.map((s) => {
            const value = overlay[s.key] ?? profile.pushPrefs?.[s.key] === true;
            return (
              <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <ThemedText type="small" style={{ flex: 1, fontSize: 14 }}>
                  {t(s.label)}
                </ThemedText>
                <Switch
                  value={value}
                  onValueChange={(on) => void flip(s.key, on)}
                  accessibilityLabel={t(s.label)}
                  trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
                />
              </View>
            );
          })}
          {phoneOff && (
            <View style={{ gap: Spacing.one }}>
              <ThemedText type="small" style={{ fontSize: 12, color: theme.warning }}>
                {t('Your phone has notifications turned off for this app. Turn them on in your phone’s settings.')}
              </ThemedText>
              <Button title={t('Open phone settings')} variant="secondary" onPress={() => void Linking.openSettings()} />
            </View>
          )}
        </>
      )}
    </Card>
  );
}

function VerificationCard() {
  const router = useRouter();
  const { profile } = useAuth();
  const { locale } = useLocale();
  const t = useT();
  // A move that already started (window stamped, link still open) can be
  // picked up again: the server hands back the same link.
  const windowClosed = !!profile?.verified && reverifyOpensAt(profile) != null;
  const [resume, setResume] = useState<'id' | 'address' | null>(null);
  useEffect(() => {
    if (!windowClosed) return;
    let live = true;
    Promise.all([getVerificationQuote('id'), getVerificationQuote('address')]).then(
      ([byId, byBill]) => {
        if (live) setResume(byId.resume ? 'id' : byBill.resume ? 'address' : null);
      },
      () => {}
    );
    return () => {
      live = false;
    };
  }, [windowClosed, profile?.uid]);
  if (!profile) return null;

  if (!profile.verified) {
    return (
      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 13 }}>
          {t('Verification')}
        </ThemedText>
        {profile.wardId == null ? (
          <HomeWardChoice />
        ) : (
          <DeclaredWardNote profile={profile} />
        )}
      </Card>
    );
  }

  const opensAt = reverifyOpensAt(profile);
  const opensOn = opensAt?.toLocaleDateString(dateLocale(locale), {
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
      {resume && windowClosed && (
        <Button
          title={t('Continue your verification')}
          onPress={() => router.push(resume === 'address' ? '/verify?move=1&with=address' : '/verify?move=1')}
        />
      )}
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

/** The community rules, kept out of the way at the very bottom. */
function RulesLink() {
  const router = useRouter();
  const t = useT();
  return (
    <Pressable
      onPress={() => router.push('/rules')}
      hitSlop={8}
      accessibilityRole="link"
      style={{ alignSelf: 'center', paddingVertical: Spacing.two }}>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {t('Community rules')}
      </ThemedText>
    </Pressable>
  );
}
