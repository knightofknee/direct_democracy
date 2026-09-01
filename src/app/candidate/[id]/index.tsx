import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, orderBy, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { OfficialAvatar } from '@/components/avatar';
import { ClaimGate } from '@/components/claim-gate';
import { policyPreview } from '@/components/policy-body';
import { PollCard } from '@/components/poll-card';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, Field, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { host, plural, timeAgo } from '@/lib/format';
import { notify, notifyError } from '@/lib/notify';
import { openLink } from '@/lib/open-link';
import type { Candidate, Policy, Poll } from '@/lib/types';
import { syncMyPlatform, updateCandidateCard } from '@/services/candidates';


/** A candidate's public page: who they are, and the more perfect platform. */
export default function CandidateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const { data: candidate, loading } = useLiveDoc<Candidate>(
    () => (id ? doc(db, 'candidates', id) : null),
    [id]
  );
  const { data: policies } = useLiveQuery<Policy>(
    () => (id ? query(collection(db, 'candidates', id, 'policies'), orderBy('order')) : null),
    [id]
  );
  const { data: polls } = useLiveQuery<Poll>(
    () =>
      id
        ? query(collection(db, 'polls'), where('authorUid', '==', id), orderBy('createdAt', 'desc'))
        : null,
    [id]
  );

  if (!candidate) {
    return (
      <Screen>
        {loading ? (
          <SkeletonCards count={2} />
        ) : (
          <EmptyState icon="alert-circle-outline" message="Candidate not found." />
        )}
      </Screen>
    );
  }

  const isThisCandidate = profile?.uid === candidate.uid;
  const visiblePolicies = policies.filter((p) => !p.archived || isThisCandidate);
  const nextOrder = policies.reduce((max, p) => Math.max(max, p.order + 1), 0);
  const openPolls = polls.filter((p) => p.open);

  return (
    <Screen>
      <Card>
        <View style={styles.headerRow}>
          <OfficialAvatar name={candidate.name} photoUrl={candidate.photoUrl} size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText type="smallBold" style={{ fontSize: 19, lineHeight: 25 }}>
              {candidate.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {candidate.office}
            </ThemedText>
          </View>
        </View>
        {candidate.bio ? <ThemedText type="small">{candidate.bio}</ThemedText> : null}
        {candidate.websiteUrl ? (
          <Button
            title="Campaign website"
            variant="secondary"
            icon={<Ionicons name="globe-outline" size={15} />}
            onPress={() => void openLink(candidate.websiteUrl!)}
          />
        ) : null}
      </Card>

      {isThisCandidate && (
        <>
          <ClaimGate claimed={candidate.claimed} name={candidate.name} />
          <EditCard candidate={candidate} />
          <SyncCard candidate={candidate} />
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Button
              title="Add a policy"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() =>
                router.push({ pathname: '/edit-policy', params: { nextOrder: String(nextOrder) } })
              }
            />
            <Button
              title="New poll"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => router.push('/new-poll')}
            />
          </View>
        </>
      )}

      <SectionHeader
        title="the more perfect platform"
        subtitle="Every policy, open to your arguments"
      />
      {candidate.platformNote ? (
        <PlatformNote
          note={candidate.platformNote}
          tone={candidate.platformNoteTone}
          onPress={
            candidate.platformNoteTone === 'success' && candidate.sourceUrl
              ? () => void openLink(candidate.sourceUrl!)
              : undefined
          }
        />
      ) : null}
      {candidate.sourceUrl && visiblePolicies.some((p) => p.source === 'site') ? (
        <ImportedNote sourceUrl={candidate.sourceUrl} />
      ) : null}
      {visiblePolicies.length === 0 ? (
        <EmptyState icon="document-text-outline" message="No policies published yet." />
      ) : (
        <PlatformList candidateUid={candidate.uid} policies={visiblePolicies} />
      )}

      {openPolls.length > 0 && (
        <>
          <SectionHeader
            title={`Questions from ${candidate.name.split(' ')[0]}`}
            subtitle="Polls this candidate has put to the city"
          />
          {openPolls.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </>
      )}
    </Screen>
  );
}

/**
 * Operator-written editorial callout above the platform - loud on purpose,
 * for what a voter should not scroll past: amber calls out a gap (a
 * candidate with no real platform for the office), green credits good work
 * and taps through to the campaign's own page.
 */
function PlatformNote({
  note,
  tone = 'warning',
  onPress,
}: {
  note: string;
  tone?: 'warning' | 'success' | null;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const colors =
    tone === 'success'
      ? { border: theme.verified, bg: theme.verifiedSoft, icon: theme.verified }
      : { border: theme.warning, bg: theme.warningSoft, icon: theme.warning };
  return (
    <Card
      onPress={onPress}
      style={{ borderColor: colors.border, borderWidth: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' }}>
        <Ionicons
          name={tone === 'success' ? 'checkmark-circle' : 'alert-circle'}
          size={18}
          color={colors.icon}
        />
        <ThemedText type="smallBold" style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
          {note}
        </ThemedText>
        {onPress ? <Ionicons name="open-outline" size={16} color={colors.icon} /> : null}
      </View>
    </Card>
  );
}

/**
 * Provenance label for platforms pulled from the campaign's own website:
 * shown until the candidate takes their policies over by editing them here.
 */
function ImportedNote({ sourceUrl }: { sourceUrl: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => void openLink(sourceUrl)}
      accessibilityRole="link"
      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
      <Ionicons name="globe-outline" size={14} color={theme.primary} />
      <ThemedText type="small" style={{ color: theme.primary, fontSize: 12, flex: 1 }}>
        Imported from {host(sourceUrl)}
      </ThemedText>
    </Pressable>
  );
}

/** The platform, grouped by its section headers, in site order. */
function PlatformList({ candidateUid, policies }: { candidateUid: string; policies: Policy[] }) {
  const router = useRouter();
  const theme = useTheme();

  let lastSection: string | null = null;
  const rows: React.ReactNode[] = [];
  policies.forEach((policy, i) => {
    if (policy.section && policy.section !== lastSection) {
      lastSection = policy.section;
      rows.push(
        <ThemedText
          key={`section-${policy.section}-${i}`}
          type="smallBold"
          themeColor="textSecondary"
          style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.two }}>
          {policy.section}
        </ThemedText>
      );
    }
    rows.push(
      <Animated.View key={policy.id} entering={FadeInDown.duration(240).delay(Math.min(i, 10) * 25)}>
        <Card onPress={() => router.push(`/candidate/${candidateUid}/${policy.id}`)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <ThemedText type="smallBold" style={{ fontSize: 15, flex: 1 }}>
              {policy.title}
            </ThemedText>
            {policy.archived && <Chip label="Hidden" tone="warning" icon="eye-off" />}
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </View>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {policyPreview(policy.body)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {plural(policy.commentCount, 'comment')}
          </ThemedText>
        </Card>
      </Animated.View>
    );
  });
  return <>{rows}</>;
}

/** Candidates manage their own card: bio, portrait link, website link. */
function EditCard({ candidate }: { candidate: Candidate }) {
  const { profile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(candidate.bio ?? '');
  const [photoUrl, setPhotoUrl] = useState(candidate.photoUrl ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(candidate.websiteUrl ?? '');
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const save = async () => {
    setSaving(true);
    try {
      await updateCandidateCard(profile, { bio, photoUrl, websiteUrl });
      setEditing(false);
    } catch (e) {
      notifyError('Could not save', e);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return <Button title="Edit my card" variant="secondary" onPress={() => setEditing(true)} />;
  }

  return (
    <Card>
      <Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={1000} />
      <Field
        label="Portrait link (https)"
        placeholder="https://your-site.org/portrait.jpg"
        value={photoUrl}
        onChangeText={setPhotoUrl}
        autoCapitalize="none"
        keyboardType="url"
      />
      <Field
        label="Campaign website (https)"
        placeholder="https://your-campaign.org"
        value={websiteUrl}
        onChangeText={setWebsiteUrl}
        autoCapitalize="none"
        keyboardType="url"
      />
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        Link a photo hosted on your own site or campaign page - direct democracy displays it but
        never stores the image.
      </ThemedText>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} style={{ flex: 1 }} />
        <Button title="Save" onPress={save} loading={saving} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

/**
 * Shown only to candidates whose platform syncs from their campaign site:
 * the site is the source of truth, this button pulls it in on demand.
 */
function SyncCard({ candidate }: { candidate: Candidate }) {
  const [syncing, setSyncing] = useState(false);

  if (!candidate.sourceUrl) return null;

  const sync = async () => {
    setSyncing(true);
    try {
      const result = await syncMyPlatform();
      notify(
        'Platform synced',
        `${plural(result.synced, 'policy', 'policies')} pulled from your site` +
          (result.archived > 0 ? `, ${result.archived} no longer on it (hidden).` : '.')
      );
    } catch (e) {
      notifyError('Sync failed', e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        Your platform syncs from your campaign site (nightly, or right now with the button).
        {candidate.lastSyncedAt ? ` Last synced ${timeAgo(candidate.lastSyncedAt)}.` : ''}
      </ThemedText>
      <Button
        title="Sync from my site"
        variant="secondary"
        icon={<Ionicons name="refresh" size={15} />}
        onPress={sync}
        loading={syncing}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
