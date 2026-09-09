import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { openLink } from '@/lib/open-link';
import { MAX_REFERENCES } from '@/services/concerns';

/**
 * Reference links on a concern. Authors list sources below their text and can
 * cite one inline by typing *1 (*2, *3...) in the body; readers tap either
 * the inline [1] marker or the row at the bottom to open the link. Uncited
 * references still render at the bottom.
 *
 * Rules can't type-check list elements, so every renderer here re-filters to
 * https:// strings before showing or opening anything.
 */
function safeReferences(references: unknown): string[] {
  if (!Array.isArray(references)) return [];
  return references.map((r) => (typeof r === 'string' && r.startsWith('https://') ? r : ''));
}

/** Body text with *N citations rendered as tappable [N] markers. */
export function ReferencedBody({
  body,
  references,
  type,
}: {
  body: string;
  references?: string[];
  /** ThemedText variant of the surrounding copy (comments use 'small'). */
  type?: 'default' | 'small';
}) {
  const theme = useTheme();
  const refs = safeReferences(references);
  const parts = body.split(/(\*\d+)/g);
  return (
    <ThemedText type={type}>
      {parts.map((part, i) => {
        const marker = /^\*(\d+)$/.exec(part);
        const url = marker ? refs[Number(marker[1]) - 1] : undefined;
        if (!marker || !url) return part;
        return (
          <ThemedText
            key={i}
            onPress={() => void openLink(url)}
            accessibilityRole="link"
            style={{ color: theme.primary, fontWeight: '700' }}>
            [{marker[1]}]
          </ThemedText>
        );
      })}
    </ThemedText>
  );
}

/** The numbered source list at the bottom of the content. */
export function ReferenceList({ references }: { references?: string[] }) {
  const theme = useTheme();
  const t = useT();
  const refs = safeReferences(references);
  if (!refs.some(Boolean)) return null;
  return (
    <View style={[styles.list, { borderTopColor: theme.border }]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {t('References')}
      </ThemedText>
      {refs.map((url, i) =>
        url ? (
          <Pressable
            key={i}
            onPress={() => void openLink(url)}
            accessibilityRole="link"
            style={styles.row}>
            <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 12, width: 20 }}>
              {i + 1}
            </ThemedText>
            <ThemedText
              type="small"
              numberOfLines={1}
              style={{ color: theme.primary, fontSize: 13, flex: 1 }}>
              {url.replace(/^https:\/\//, '')}
            </ThemedText>
            <Ionicons name="open-outline" size={13} color={theme.textSecondary} />
          </Pressable>
        ) : null
      )}
    </View>
  );
}

/**
 * The composer's reference list: one https link per row, added with a plus
 * button that hides while a row is still blank (no stacking empty rows) or
 * the list is full.
 */
export function ReferenceEditor({
  references,
  onChange,
  title = 'References',
  addFirstLabel = 'Add a reference link',
  addAnotherLabel = 'Add another reference',
  hint = 'Type *1 in your text to cite reference 1 - readers tap it to open the link. Uncited references still show under your concern.',
}: {
  references: string[];
  onChange: (references: string[]) => void;
  title?: string;
  addFirstLabel?: string;
  addAnotherLabel?: string;
  /** Explainer under the rows; null hides it (e.g. comment sources). */
  hint?: string | null;
}) {
  const theme = useTheme();
  const t = useT();
  const hasBlank = references.some((r) => !r.trim());
  const canAdd = !hasBlank && references.length < MAX_REFERENCES;
  return (
    <View style={{ gap: Spacing.two }}>
      {references.length > 0 && (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t(title)}
        </ThemedText>
      )}
      {references.map((url, i) => (
        <View key={i} style={styles.editRow}>
          <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13, width: 20 }}>
            {i + 1}
          </ThemedText>
          <View style={{ flex: 1 }}>
            <Field
              placeholder="https://…"
              value={url}
              onChangeText={(t) => onChange(references.map((r, j) => (j === i ? t : r)))}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
          <Pressable
            onPress={() => onChange(references.filter((_, j) => j !== i))}
            hitSlop={8}
            accessibilityLabel={t('Remove reference {n}').replace('{n}', String(i + 1))}>
            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      ))}
      {references.length > 0 && hint != null && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t(hint)}
        </ThemedText>
      )}
      {canAdd && (
        <Button
          title={t(references.length === 0 ? addFirstLabel : addAnotherLabel)}
          variant="ghost"
          onPress={() => onChange([...references, ''])}
        />
      )}
    </View>
  );
}

/**
 * The quiet "source"/"sources" affordance on a comment: invisible when the
 * comment has none, otherwise a small label that opens a modal listing the
 * links. Tapping a row opens it in the in-app browser.
 */
export function SourcesButton({ references }: { references?: string[] }) {
  const theme = useTheme();
  const t = useT();
  const [open, setOpen] = useState(false);
  const refs = safeReferences(references).filter(Boolean);
  if (refs.length === 0) return null;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={4} style={styles.sourcesButton}>
        <Ionicons name="link-outline" size={14} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, fontWeight: '600' }}>
          {refs.length === 1 ? t('source') : t('sources')}
        </ThemedText>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={(e) => e.stopPropagation()}>
            <ThemedText type="smallBold">
              {refs.length === 1 ? t('Source') : t('Sources')}
            </ThemedText>
            {refs.map((url, i) => (
              <Pressable
                key={i}
                onPress={() => void openLink(url)}
                accessibilityRole="link"
                style={styles.row}>
                <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 12, width: 20 }}>
                  {i + 1}
                </ThemedText>
                <ThemedText
                  type="small"
                  numberOfLines={1}
                  style={{ color: theme.primary, fontSize: 13, flex: 1 }}>
                  {url.replace(/^https:\/\//, '')}
                </ThemedText>
                <Ionicons name="open-outline" size={13} color={theme.textSecondary} />
              </Pressable>
            ))}
            <Button title={t('Close')} variant="ghost" onPress={() => setOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sourcesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheet: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
