import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc } from 'firebase/firestore';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc } from '@/hooks/use-firestore';
import { db } from '@/lib/firebase';
import { notify, notifyError } from '@/lib/notify';
import type { Policy, PolicyLink, UserProfile } from '@/lib/types';
import { createPolicy, updatePolicy } from '@/services/candidates';

/**
 * Write or edit one plank of the platform. Creating: pass nextOrder so the
 * policy lands at the end. Editing: pass candidateId + policyId. Editing a
 * synced policy takes it over - it becomes an in-app policy and the campaign
 * site stops updating it.
 */
export default function EditPolicyScreen() {
  const { candidateId, policyId, nextOrder } = useLocalSearchParams<{
    candidateId?: string;
    policyId?: string;
    nextOrder?: string;
  }>();
  const { profile } = useAuth();
  const editing = Boolean(candidateId && policyId);

  const { data: existing, loading } = useLiveDoc<Policy>(
    () =>
      candidateId && policyId ? doc(db, 'candidates', candidateId, 'policies', policyId) : null,
    [candidateId, policyId]
  );

  if (profile?.role !== 'candidate') {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" message="Only candidates can edit a platform." />
      </Screen>
    );
  }

  if (editing && !existing) {
    return (
      <Screen>
        {loading ? (
          <SkeletonCards count={2} />
        ) : (
          <EmptyState icon="alert-circle-outline" message="Policy not found." />
        )}
      </Screen>
    );
  }

  return (
    <PolicyForm
      // Remount if the target policy changes so the form re-seeds.
      key={existing?.id ?? 'new'}
      profile={profile}
      existing={existing}
      nextOrder={Number(nextOrder ?? '0') || 0}
    />
  );
}

function PolicyForm({
  profile,
  existing,
  nextOrder,
}: {
  profile: UserProfile;
  existing: Policy | null;
  nextOrder: number;
}) {
  const router = useRouter();
  const [section, setSection] = useState(existing?.section ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [linksText, setLinksText] = useState(
    existing ? existing.links.map((l) => l.url).join('\n') : ''
  );
  const [saving, setSaving] = useState(false);

  const parseLinks = (): PolicyLink[] =>
    linksText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((url) => {
        let label = url;
        try {
          label = new URL(url).hostname.replace(/^www\./, '');
        } catch {
          // keep the raw text as the label; validation below rejects non-https
        }
        return { label, url };
      });

  const submit = async () => {
    if (title.trim().length < 3) {
      notify('Almost there', 'Give the policy a title of at least 3 characters.');
      return;
    }
    if (!body.trim()) {
      notify('Almost there', 'Write out the policy - this is the space to make the case.');
      return;
    }
    const links = parseLinks();
    if (links.some((l) => !l.url.startsWith('https://'))) {
      notify('Almost there', 'Source links must be https:// URLs, one per line.');
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await updatePolicy(profile, existing, { section, title, body, links });
      } else {
        await createPolicy(profile, { section, title, body, links, order: nextOrder });
      }
      if (router.canGoBack()) router.back();
      else router.replace(`/candidate/${profile.uid}`);
    } catch (e) {
      notifyError('Could not save policy', e);
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        One plank of your platform: a clear title, and all the space you need to make the case.
        Voters weigh in with support or opposition and argue it out in the comments.
      </ThemedText>

      <Field
        label="Title"
        placeholder="No more Lead Pipes"
        value={title}
        onChangeText={setTitle}
        maxLength={140}
      />
      <Field
        label="Section (optional)"
        placeholder="Health & Home"
        value={section}
        onChangeText={setSection}
        maxLength={60}
      />
      <Field
        label="The policy"
        placeholder="What you'll do, why it works, and what it costs…"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={8000}
        style={{ minHeight: 200 }}
      />
      <Field
        label="Receipts - source links (optional, one per line)"
        placeholder={'https://example.org/study\nhttps://example.org/budget'}
        value={linksText}
        onChangeText={setLinksText}
        multiline
        autoCapitalize="none"
        style={{ minHeight: 80 }}
      />

      <View style={{ gap: Spacing.two }}>
        {existing?.source === 'site' && (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            This policy was imported from your campaign site. Saving takes it over: it becomes
            yours to manage here, its votes and comments stay, and the site no longer updates it.
          </ThemedText>
        )}
        <Button
          title={existing ? 'Save changes' : 'Publish policy'}
          onPress={submit}
          loading={saving}
        />
      </View>
    </Screen>
  );
}
