import React from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';

/**
 * The privacy story, in plain language, matching what the code actually
 * does. Keep this in sync with docs/AUDIT.md when the trust model changes.
 */
export default function PrivacyScreen() {
  const t = useT();
  return (
    <Screen>
      <ThemedText type="subtitle" style={{ fontSize: 24, lineHeight: 30 }}>
        {t('Privacy & data')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('direct democracy is built to know as little about you as possible while still keeping the vote honest.')}
      </ThemedText>

      <Section title={t('What we store')}>
        <Bullet text={t('Your email and password hash (for signing in) - never shown to anyone.')} />
        <Bullet text={t("A display name you choose. It's a pseudonym; your real name is never shown, even after verification.")} />
        <Bullet text={t('Your ballots, comments, questions, and judgments - the content you post.')} />
        <Bullet text={t('If you verify: a yes/no verified flag, your ward, and a unique identifier used to block duplicate accounts. Nothing else, and it is deleted with your account.')} />
        <Bullet text={t('Participation counters (votes cast, concerns raised) that power your milestones.')} />
        <Bullet text={t('If you pay for a verification: which one you bought, when, and the store’s transaction number. Your payment details stay with Apple or Google.')} />
      </Section>

      <Section title={t('What we never see')}>
        <Bullet text={t('Your identity documents. Verification is performed by Didit, a third-party service; documents go to them, and we receive only the verdict.')} />
        <Bullet text={t('Your address. It is used only at the moment you verify, to find your ward, and is never saved.')} />
      </Section>

      <Section title={t('Who can see what')}>
        <Bullet text={t('Your profile is readable only by you. Content you post carries your display name and a verified badge - nothing more.')} />
        <Bullet text={t('Your individual ballots and judgments are readable only by you; everyone else sees only aggregate tallies.')} />
        <Bullet text={t('Reports you file are visible only to the platform operators.')} />
      </Section>

      <Section title={t('Your controls')}>
        <Bullet text={t('Change your display name any time.')} />
        <Bullet text={t('Retract any vote while voting is open, withdraw your concerns and unanswered questions, delete your comments. Once a poll closes its result is a public record and ballots are final.')} />
        <Bullet text={t('Block any user to hide their content from your account.')} />
        <Bullet text={t('Delete your account any time from Settings: your sign-in, profile, verification status, and standing approvals of officials are removed. Anything you posted is re-attributed to [deleted], and votes you cast remain counted in the tallies.')} />
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <SectionHeader title={title} />
      <Card>{children}</Card>
    </>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' }}>
      <ThemedText type="small" themeColor="textSecondary">
        •
      </ThemedText>
      <ThemedText type="small" style={{ flex: 1 }}>
        {text}
      </ThemedText>
    </View>
  );
}
