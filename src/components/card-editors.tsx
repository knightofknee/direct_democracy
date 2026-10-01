import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { plural, timeAgo } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { notify, notifyError } from '@/lib/notify';
import type { Candidate, Official } from '@/lib/types';
import { syncMyPlatform, updateCandidateCard } from '@/services/candidates';
import { DEFAULT_UPVOTE_ALERT_THRESHOLD, updateOfficialCard } from '@/services/officials';

/**
 * The politician's own card tools, used only in the command center: the
 * public official and candidate pages read the same for everyone.
 */

/** Officials manage their own card: bio + externally hosted portrait link. */
export function OfficialCardEditor({ official }: { official: Official }) {
  const { profile } = useAuth();
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(official.bio ?? '');
  const [photoUrl, setPhotoUrl] = useState(official.photoUrl ?? '');
  const [threshold, setThreshold] = useState(
    String(official.upvoteAlertThreshold ?? DEFAULT_UPVOTE_ALERT_THRESHOLD)
  );
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const save = async () => {
    const parsed = Number(threshold.trim());
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10000) {
      notify(t('Almost there'), t('The question alert threshold must be a whole number from 1 to 10,000.'));
      return;
    }
    setSaving(true);
    try {
      await updateOfficialCard(profile, { bio, photoUrl, upvoteAlertThreshold: parsed });
      setEditing(false);
    } catch (e) {
      notifyError(t('Could not save'), e);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Button title={t('Edit my card')} variant="secondary" onPress={() => setEditing(true)} />
    );
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
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {t('Link a photo hosted on your own site or campaign page - direct democracy displays it but never stores the image.')}
      </ThemedText>
      <Field
        label={t('Question alert threshold')}
        value={threshold}
        onChangeText={setThreshold}
        keyboardType="number-pad"
        maxLength={5}
      />
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {t("You'll get a notification when a question in your AMA reaches this many upvotes.")}
      </ThemedText>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <Button title={t('Cancel')} variant="ghost" onPress={() => setEditing(false)} style={{ flex: 1 }} />
        <Button title={t('Save')} onPress={save} loading={saving} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

/** Candidates manage their own card: bio, portrait link, website link. */
export function CandidateCardEditor({ candidate }: { candidate: Candidate }) {
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
export function SyncCard({ candidate }: { candidate: Candidate }) {
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
