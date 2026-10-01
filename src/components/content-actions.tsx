import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { notify, notifyError } from '@/lib/notify';
import { blockUser, REPORT_REASONS, reportContent } from '@/services/moderation';

/**
 * The moderation affordance on user-generated content: a small flag that
 * expands into report reasons and (for others' content) a block action.
 * Blocking hides the author's content on this account; reporting files a
 * write-only report for the operator.
 */
export function ContentActions({
  contentPath,
  contentType,
  excerpt,
  authorUid,
  authorName,
}: {
  contentPath: string;
  contentType: 'concern' | 'comment' | 'question' | 'response' | 'policy' | 'electionQuestion';
  excerpt: string;
  authorUid: string;
  authorName: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const t = useT();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // "Other" asks what's wrong before it sends: a report that doesn't say
  // what the problem is gives the review nothing to go on.
  const [otherNote, setOtherNote] = useState<string | null>(null);

  if (profile?.uid === authorUid) return null;

  const requireAuth = () => {
    if (!profile) {
      router.push('/sign-in');
      return null;
    }
    return profile;
  };

  const report = async (reason: (typeof REPORT_REASONS)[number]['key'], note?: string) => {
    const me = requireAuth();
    if (!me) return;
    if (reason === 'other' && note == null) {
      setOtherNote('');
      return;
    }
    setBusy(true);
    try {
      await reportContent(me, { contentPath, contentType, reason, excerpt, authorUid, note });
      setOpen(false);
      setOtherNote(null);
      notify(t('Report sent'), t('Thank you - the operators will review it.'));
    } catch (e) {
      notifyError(t('Could not send report'), e);
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    const me = requireAuth();
    if (!me) return;
    setBusy(true);
    try {
      await blockUser(me, authorUid, authorName);
      setOpen(false);
      notify(
        t('Blocked {name}').replace('{name}', authorName),
        t('Their content is hidden for you. Manage blocked users from your profile.')
      );
    } catch (e) {
      notifyError(t('Could not block'), e);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('Report or block')}
        style={styles.flagButton}>
        <Ionicons name="flag-outline" size={14} color={theme.textSecondary} />
      </Pressable>
    );
  }

  return (
    <View style={[styles.sheet, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <ThemedText type="smallBold" style={{ fontSize: 12 }}>
        {t('Report this {type}').replace('{type}', t(contentType === 'electionQuestion' ? 'question' : contentType))}
      </ThemedText>
      {otherNote != null ? (
        <View style={{ gap: Spacing.two }}>
          <Field
            value={otherNote}
            onChangeText={setOtherNote}
            placeholder={t('What’s wrong with it?')}
            accessibilityLabel={t('What’s wrong with it?')}
            multiline
            maxLength={500}
            autoFocus
          />
          <View style={styles.reasonRow}>
            <Button
              title={t('Send report')}
              onPress={() => void report('other', otherNote)}
              disabled={otherNote.trim().length < 5}
              loading={busy}
            />
            <Button title={t('Back')} variant="ghost" onPress={() => setOtherNote(null)} />
          </View>
        </View>
      ) : (
      <View style={styles.reasonRow}>
        {REPORT_REASONS.map((r) => (
          <Pressable
            key={r.key}
            disabled={busy}
            accessibilityRole="button"
            onPress={() => report(r.key)}
            style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" style={{ fontSize: 12 }}>
              {t(r.label)}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      )}
      <View style={styles.reasonRow}>
        <Pressable
          disabled={busy}
          accessibilityRole="button"
          onPress={block}
          style={[styles.chip, { borderColor: theme.danger, backgroundColor: theme.dangerSoft }]}>
          <ThemedText type="small" style={{ fontSize: 12, color: theme.danger }}>
            {t('Block {name}').replace('{name}', authorName)}
          </ThemedText>
        </Pressable>
        <Pressable
          disabled={busy}
          accessibilityRole="button"
          onPress={() => {
            setOpen(false);
            setOtherNote(null);
          }}
          style={styles.chip}
          hitSlop={4}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('Cancel')}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flagButton: {
    padding: 2,
    alignSelf: 'flex-start',
  },
  // Open, the sheet takes its own full-width line in the meta row it sits in
  // (those rows wrap) instead of shrinking to its contents.
  sheet: {
    width: '100%',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
});
