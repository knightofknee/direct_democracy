import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
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
  contentType: 'concern' | 'comment' | 'question' | 'response' | 'policy';
  excerpt: string;
  authorUid: string;
  authorName: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (profile?.uid === authorUid) return null;

  const requireAuth = () => {
    if (!profile) {
      router.push('/sign-in');
      return null;
    }
    return profile;
  };

  const report = async (reason: (typeof REPORT_REASONS)[number]['key']) => {
    const me = requireAuth();
    if (!me) return;
    setBusy(true);
    try {
      await reportContent(me, { contentPath, contentType, reason, excerpt, authorUid });
      setOpen(false);
      notify('Report sent', 'Thank you - the operators will review it.');
    } catch (e) {
      notifyError('Could not send report', e);
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
        `Blocked ${authorName}`,
        'Their content is hidden for you. Manage blocked users from your profile.'
      );
    } catch (e) {
      notifyError('Could not block', e);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} hitSlop={8} style={styles.flagButton}>
        <Ionicons name="flag-outline" size={14} color={theme.textSecondary} />
      </Pressable>
    );
  }

  return (
    <View style={[styles.sheet, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <ThemedText type="smallBold" style={{ fontSize: 12 }}>
        Report this {contentType}
      </ThemedText>
      <View style={styles.reasonRow}>
        {REPORT_REASONS.map((r) => (
          <Pressable
            key={r.key}
            disabled={busy}
            onPress={() => report(r.key)}
            style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" style={{ fontSize: 12 }}>
              {r.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <View style={styles.reasonRow}>
        <Pressable
          disabled={busy}
          onPress={block}
          style={[styles.chip, { borderColor: theme.danger, backgroundColor: theme.dangerSoft }]}>
          <ThemedText type="small" style={{ fontSize: 12, color: theme.danger }}>
            Block {authorName}
          </ThemedText>
        </Pressable>
        <Pressable disabled={busy} onPress={() => setOpen(false)} style={styles.chip} hitSlop={4}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            Cancel
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
  sheet: {
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
