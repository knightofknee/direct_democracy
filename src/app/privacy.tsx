import React from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';

/**
 * The privacy story, in plain language, matching what the code actually
 * does. Keep this in sync with docs/AUDIT.md when the trust model changes.
 */
export default function PrivacyScreen() {
  return (
    <Screen>
      <ThemedText type="subtitle" style={{ fontSize: 24, lineHeight: 30 }}>
        Privacy & data
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        direct democracy is built to know as little about you as possible while still keeping the
        vote honest.
      </ThemedText>

      <Section title="What we store">
        <Bullet text="Your email and password hash (for signing in) - never shown to anyone." />
        <Bullet text="A display name you choose. It's a pseudonym; your real name is never shown, even after verification." />
        <Bullet text="Your ballots, comments, questions, and judgments - the content you post." />
        <Bullet text="If you verify: a yes/no verified flag and your ward. Nothing else." />
        <Bullet text="Participation counters (votes cast, concerns raised) that power your milestones." />
      </Section>

      <Section title="What we never see">
        <Bullet text="Your identity documents. Verification is performed by Persona, a third-party service; documents go to them, and we receive only the verdict." />
        <Bullet text="Your address. Persona derives your ward from it and tells us just the ward number." />
      </Section>

      <Section title="Who can see what">
        <Bullet text="Your profile is readable only by you. Content you post carries your display name and a verified badge - nothing more." />
        <Bullet text="Your individual ballots and judgments are readable only by you; everyone else sees only aggregate tallies." />
        <Bullet text="Reports you file are visible only to the platform operators." />
      </Section>

      <Section title="Your controls">
        <Bullet text="Change your display name any time." />
        <Bullet text="Retract any vote while voting is open, withdraw your concerns and unanswered questions, delete your comments. Once a poll closes its result is a public record and ballots are final." />
        <Bullet text="Block any user to hide their content from your account." />
        <Bullet text="Delete your account any time from Settings: your sign-in, profile, verification status, and standing approvals of officials are removed. Anything you posted is re-attributed to [deleted], and votes you cast remain counted in the tallies." />
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
