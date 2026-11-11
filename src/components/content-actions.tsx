import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ChoiceRow, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useKeyboardOverlap, useRevealFocusedField } from '@/hooks/use-keyboard-overlap';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { notify, notifyError } from '@/lib/notify';
import {
  blockUser,
  REPORT_REASONS,
  reportContent,
  type ReportContentType,
  type ReportReason,
} from '@/services/moderation';

/**
 * The moderation affordance on user-generated content: a small flag that
 * opens the report dialog (2026-10-22, Brian: a report is the only thing
 * the person is doing, so it gets a modal, not a row of chips that sent on
 * the first tap). Pick every reason that applies, add a note, then Send.
 * Blocking the author lives in the same dialog. Reporting files a
 * write-only report for the operator; blocking hides the author's content
 * on this account.
 */
export function ContentActions({
  contentPath,
  contentType,
  excerpt,
  authorUid,
  authorName,
}: {
  contentPath: string;
  contentType: ReportContentType;
  excerpt: string;
  authorUid: string;
  authorName: string;
}) {
  const theme = useTheme();
  // Android draws edge to edge, so the keyboard covers the dialog instead of
  // shrinking it: the dialog pads itself above the keyboard and scrolls the
  // note into view with Send under it (src/hooks/use-keyboard-overlap.ts).
  const dialogRef = useRef<View>(null);
  const keyboard = useKeyboardOverlap(dialogRef);
  const dialogScrollRef = useRef<ScrollView>(null);
  const dialogContentRef = useRef<View>(null);
  useRevealFocusedField(dialogScrollRef, dialogContentRef);
  const router = useRouter();
  const t = useT();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Kept while the dialog is closed, so someone sent to sign in first comes
  // back to the reasons they picked.
  const [picked, setPicked] = useState<ReportReason[]>([]);
  const [note, setNote] = useState('');

  if (profile?.uid === authorUid) return null;

  // "Something else" says what's wrong before it sends: a report that doesn't
  // say what the problem is gives the review nothing to go on.
  const needsNote = picked.includes('other') && note.trim().length < 5;
  const toggle = (r: ReportReason) =>
    setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));

  const close = () => {
    if (!busy) setOpen(false);
  };

  const signInFirst = () => {
    setOpen(false);
    router.push('/sign-in');
  };

  const send = async () => {
    if (!profile) return signInFirst();
    setBusy(true);
    try {
      await reportContent(profile, {
        contentPath,
        contentType,
        reasons: picked,
        excerpt,
        authorUid,
        note,
      });
      setOpen(false);
      setPicked([]);
      setNote('');
      notify(t('Report sent'), t('Thank you - the operators will review it.'));
    } catch (e) {
      notifyError(t('Could not send report'), e);
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    if (!profile) return signInFirst();
    setBusy(true);
    try {
      await blockUser(profile, authorUid, authorName);
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

  const title = t('Report this {type}').replace(
    '{type}',
    t(contentType === 'electionQuestion' ? 'question' : contentType)
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={15}
        accessibilityRole="button"
        accessibilityLabel={t('Report or block')}
        style={styles.flagButton}>
        <Ionicons name="flag-outline" size={14} color={theme.textSecondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        {/* Scrolls when large text or the keyboard leaves too little room.
            The backdrop that closes it sits behind the card, not around
            it: on the web, a pressable wrapped around the scroll view
            swallowed the taps on the reasons. */}
        <View ref={dialogRef} style={[styles.backdrop, { paddingBottom: keyboard }]}>
          <ScrollView
            ref={dialogScrollRef}
            // React Native's type for this prop leaves out the null every ref starts as.
            innerViewRef={dialogContentRef as React.RefObject<View>}
            style={{ flex: 1 }}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets>
            <Pressable style={StyleSheet.absoluteFill} onPress={close} accessible={false} />
            <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={styles.header}>
                <ThemedText type="smallBold" accessibilityRole="header" style={{ fontSize: 17, flex: 1 }}>
                  {title}
                </ThemedText>
                <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('Close')}>
                  <Ionicons name="close" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>

              <ThemedText type="small" themeColor="textSecondary">
                {t('Pick every reason that applies.')}
              </ThemedText>
              <View style={{ gap: Spacing.one }}>
                {REPORT_REASONS.map((r) => (
                  <ChoiceRow
                    key={r.key}
                    kind="checkbox"
                    label={t(r.label)}
                    checked={picked.includes(r.key)}
                    onPress={() => toggle(r.key)}
                    disabled={busy}
                  />
                ))}
              </View>

              <Field
                value={note}
                onChangeText={setNote}
                placeholder={
                  picked.includes('other') ? t('What’s wrong with it?') : t('Add a note (optional)')
                }
                multiline
                maxLength={500}
                style={{ minHeight: 72, textAlignVertical: 'top' }}
              />

              <Button
                title={profile ? t('Send report') : t('Sign in to send')}
                onPress={() => void send()}
                disabled={picked.length === 0 || needsNote}
                loading={busy}
              />

              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Button
                title={t('Block {name}').replace('{name}', authorName)}
                variant="secondary"
                disabled={busy}
                onPress={() => void block()}
              />
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {t('Blocking hides everything they post, for you only. They are not told.')}
              </ThemedText>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flagButton: {
    padding: 2,
    alignSelf: 'flex-start',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
