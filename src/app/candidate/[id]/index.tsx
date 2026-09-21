import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, orderBy, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { OfficialAvatar } from '@/components/avatar';
import { ClaimGate } from '@/components/claim-gate';
import { CopyLinkButton } from '@/components/copy-link';
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
import { useLocale, useLocalized, useT } from '@/lib/i18n';
import { notify, notifyError } from '@/lib/notify';
import { openLink } from '@/lib/open-link';
import type { Candidate, PlatformSummary, Policy, Poll } from '@/lib/types';
import { syncMyPlatform, updateCandidateCard } from '@/services/candidates';


/** A candidate's public page: who they are, and the more perfect platform. */
export default function CandidateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const t = useT();
  const loc = useLocalized();

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
          <EmptyState icon="alert-circle-outline" message={t('Candidate not found.')} />
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
          {/* A portrait earns the space; an initials tile does not. With no
              photo linked the name simply runs larger. */}
          {candidate.photoUrl ? (
            <OfficialAvatar name={candidate.name} photoUrl={candidate.photoUrl} size={64} />
          ) : null}
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText
              type="smallBold"
              style={candidate.photoUrl ? { fontSize: 20, lineHeight: 26 } : { fontSize: 26, lineHeight: 32 }}>
              {candidate.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t(candidate.office)}
            </ThemedText>
          </View>
        </View>
        {candidate.bio ? <ThemedText type="small">{candidate.bio}</ThemedText> : null}
        {candidate.websiteUrl ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <Button
              title={t('Campaign website')}
              variant="secondary"
              icon={<Ionicons name="globe-outline" size={15} />}
              onPress={() => void openLink(candidate.websiteUrl!)}
              style={{ flex: 1 }}
            />
            <CopyLinkButton url={candidate.websiteUrl} label={t('Copy campaign website link')} />
          </View>
        ) : null}
      </Card>

      {isThisCandidate && (
        <>
          <ClaimGate claimed={candidate.claimed} name={candidate.name} />
          <EditCard candidate={candidate} />
          <SyncCard candidate={candidate} />
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Button
              title={t('Add a policy')}
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() =>
                router.push({ pathname: '/edit-policy', params: { nextOrder: String(nextOrder) } })
              }
            />
            <Button
              title={t('New poll')}
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => router.push('/new-poll')}
            />
          </View>
        </>
      )}

      {candidate.platformNote ? (
        <PlatformNote
          note={loc(candidate.platformNote, candidate.platformNoteEs) ?? candidate.platformNote}
          tone={candidate.platformNoteTone}
          onPress={
            candidate.platformNoteTone === 'success' && candidate.sourceUrl
              ? () => void openLink(candidate.sourceUrl!)
              : undefined
          }
        />
      ) : null}
      {candidate.aiSummary ? <AiSummary summary={candidate.aiSummary} /> : null}
      {/* The header sits directly on the list it titles: notes above it,
          provenance and the policies people comment on below. */}
      {candidate.directory ? (
        <SectionHeader
          centered
          title={t('the rest of the field')}
          subtitle={t('Declared candidates who have published no platform to import')}
        />
      ) : (
        <SectionHeader
          centered
          title={t('the more perfect platform')}
          subtitle={t('Every policy, open to your arguments')}
        />
      )}
      {candidate.sourceUrl && visiblePolicies.some((p) => p.source === 'site') ? (
        <ImportedNote sourceUrl={candidate.sourceUrl} />
      ) : null}
      {visiblePolicies.length === 0 ? (
        <EmptyState icon="document-text-outline" message={t('No policies published yet.')} />
      ) : (
        <PlatformList
          candidateUid={candidate.uid}
          policies={visiblePolicies}
          directory={candidate.directory}
        />
      )}

      {openPolls.length > 0 && (
        <>
          <SectionHeader
            title={t('Questions from {name}').replace('{name}', candidate.name.split(' ')[0])}
            subtitle={t('Polls this candidate has put to the city')}
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
 * Operator-written note above the platform. Amber calls out a gap a voter
 * should not scroll past (no platform for the office, an unclaimable
 * account); green is a plain description of what the campaign published and
 * taps through to its own page. Notes describe, they never rate: no praise
 * words, no superlatives (scripts/data/platform-summaries.json holds them).
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
 * The AI reading of the platform, collapsed until asked for: what the listed
 * policies say, then how that compares with the field, each in a few chunks.
 * Same prompt for every candidate; descriptive only, the policies stay the
 * source.
 */
function AiSummary({ summary }: { summary: PlatformSummary }) {
  const theme = useTheme();
  const t = useT();
  const loc = useLocalized();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const written = summary.generatedAt
    ?.toDate()
    .toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return (
    // A solid orange bar, not another quiet card: this is the tap the page
    // most wants, the fast way into a platform nobody has time to read.
    <View style={[styles.summary, { borderColor: theme.highlight, backgroundColor: theme.backgroundElement }]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [
          styles.summaryBar,
          { backgroundColor: theme.highlight, opacity: pressed ? 0.88 : 1 },
        ]}>
        <Ionicons name="sparkles" size={17} color="#FFFFFF" />
        <ThemedText type="smallBold" style={{ flex: 1, fontSize: 16, lineHeight: 22, color: '#FFFFFF' }}>
          {t('AI summary')}
        </ThemedText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#FFFFFF" />
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(180)} style={{ gap: Spacing.three, padding: Spacing.three }}>
          <SummaryChunks label={t('The platform')} text={loc(summary.summary, summary.summaryEs) ?? ''} />
          <SummaryChunks
            label={t('Next to the other candidates')}
            text={loc(summary.comparison, summary.comparisonEs) ?? ''}
          />
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('Written by AI on {date} from the policies listed below, with the same prompt for every candidate. It can miss things. The policies are the source.').replace(
              '{date}',
              written ?? ''
            )}
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * One half of the summary as short chunks at body reading size, never a
 * block of small print. Chunks are separated by blank lines in the data and
 * open with a short "Topic: " lead, set bold so the eye can jump by subject.
 */
function SummaryChunks({ label, text }: { label: string; text: string }) {
  return (
    <View style={{ gap: Spacing.two }}>
      <ThemedText
        type="smallBold"
        themeColor="textSecondary"
        style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </ThemedText>
      {text.split(/\n{2,}/).map((chunk, i) => {
        const lead = /^([^:.\n]{2,32}): /.exec(chunk);
        return (
          <ThemedText key={i}>
            {lead ? <ThemedText style={{ fontWeight: '700' }}>{lead[1]}. </ThemedText> : null}
            {lead ? chunk.slice(lead[0].length) : chunk}
          </ThemedText>
        );
      })}
    </View>
  );
}

/**
 * Provenance label for platforms pulled from the campaign's own website:
 * shown until the candidate takes their policies over by editing them here.
 */
function ImportedNote({ sourceUrl }: { sourceUrl: string }) {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
      <Pressable
        onPress={() => void openLink(sourceUrl)}
        accessibilityRole="link"
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 }}>
        <Ionicons name="globe-outline" size={14} color={theme.primary} />
        <ThemedText type="small" style={{ color: theme.primary, fontSize: 12, flex: 1 }}>
          {t('Imported from {host}').replace('{host}', host(sourceUrl))}
        </ThemedText>
      </Pressable>
      <CopyLinkButton url={sourceUrl} label={t('Copy platform source link')} />
    </View>
  );
}

/** The platform, grouped by its section headers, in site order. */
function PlatformList({
  candidateUid,
  policies,
  directory,
}: {
  candidateUid: string;
  policies: Policy[];
  /** Directory entries are candidate profiles, not debatable policies - no comment counts. */
  directory?: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();

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
            {policy.archived && <Chip label={t('Hidden')} tone="warning" icon="eye-off" />}
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </View>
          {/* Directory entries get a line more: the preview is most of their
              content, and that list is only a handful of cards. */}
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={directory ? 4 : 3}>
            {policyPreview(policy.body)}
          </ThemedText>
          {!directory && (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {plural(policy.commentCount, 'comment')}
            </ThemedText>
          )}
        </Card>
      </Animated.View>
    );
  });
  return <>{rows}</>;
}

/** Candidates manage their own card: bio, portrait link, website link. */
function EditCard({ candidate }: { candidate: Candidate }) {
  const { profile } = useAuth();
  const t = useT();
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
      notifyError(t('Could not save'), e);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return <Button title={t('Edit my card')} variant="secondary" onPress={() => setEditing(true)} />;
  }

  return (
    <Card>
      <Field label={t('Bio')} value={bio} onChangeText={setBio} multiline maxLength={1000} />
      <Field
        label={t('Portrait link (https)')}
        placeholder="https://your-site.org/portrait.jpg"
        value={photoUrl}
        onChangeText={setPhotoUrl}
        autoCapitalize="none"
        keyboardType="url"
      />
      <Field
        label={t('Campaign website (https)')}
        placeholder="https://your-campaign.org"
        value={websiteUrl}
        onChangeText={setWebsiteUrl}
        autoCapitalize="none"
        keyboardType="url"
      />
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {t('Link a photo hosted on your own site or campaign page - direct democracy displays it but never stores the image.')}
      </ThemedText>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <Button title={t('Cancel')} variant="ghost" onPress={() => setEditing(false)} style={{ flex: 1 }} />
        <Button title={t('Save')} onPress={save} loading={saving} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

/**
 * Shown only to candidates whose platform syncs from their campaign site:
 * the site is the source of truth, this button pulls it in on demand.
 */
function SyncCard({ candidate }: { candidate: Candidate }) {
  const t = useT();
  const [syncing, setSyncing] = useState(false);

  if (!candidate.sourceUrl) return null;

  const sync = async () => {
    setSyncing(true);
    try {
      const result = await syncMyPlatform();
      notify(
        t('Platform synced'),
        t('{count} pulled from your site').replace('{count}', plural(result.synced, 'policy', 'policies')) +
          (result.archived > 0 ? t(', {n} no longer on it (hidden).').replace('{n}', String(result.archived)) : '.')
      );
    } catch (e) {
      notifyError(t('Sync failed'), e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {t('Your platform syncs from your campaign site (nightly, or right now with the button).')}
        {candidate.lastSyncedAt ? ` ${t('Last synced')} ${timeAgo(candidate.lastSyncedAt)}.` : ''}
      </ThemedText>
      <Button
        title={t('Sync from my site')}
        variant="secondary"
        icon={<Ionicons name="refresh" size={15} />}
        onPress={sync}
        loading={syncing}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
