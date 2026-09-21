import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

/**
 * Renders a policy body with real typography instead of one flat text run.
 * The platform parser (functions/src/platform.ts blockText) emits a tiny
 * markup language: paragraphs separated by blank lines, "- " bullets kept
 * tight, "## " sub-headings. Here paragraphs get full spacing, bullet items
 * get half spacing with a bullet glyph and hanging indent, and sub-headings
 * render bold - matching how the campaign sites lay their platforms out.
 * Hand-written in-app policies that use "- " lines get the same treatment.
 */

type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'bullets'; items: string[] };

export function parsePolicyBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.split(/\n{2,}/)) {
    let bullets: string[] | null = null;
    for (const rawLine of chunk.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('- ')) {
        if (!bullets) {
          bullets = [];
          blocks.push({ kind: 'bullets', items: bullets });
        }
        bullets.push(line.slice(2).trim());
        continue;
      }
      bullets = null;
      if (line.startsWith('## ')) {
        blocks.push({ kind: 'heading', text: line.slice(3).trim() });
      } else {
        blocks.push({ kind: 'paragraph', text: line });
      }
    }
  }
  return blocks;
}

/** The body as plain preview text: markers dropped, bullets as dots. */
export function policyPreview(body: string): string {
  return body
    .replace(/^## /gm, '')
    .replace(/^- /gm, '• ')
    .replace(/\n+/g, ' ')
    .trim();
}

/** Bodies longer than this open collapsed... */
const COLLAPSE_OVER = 5000;
/** ...showing about this much, cut at a paragraph or bullet boundary. */
const COLLAPSED_LENGTH = 3000;

/**
 * The opening of a long body: whole blocks up to COLLAPSED_LENGTH, splitting
 * a bullet list between items (some plans are one very long list) and never
 * ending on a heading with nothing under it.
 */
function leadingBlocks(blocks: Block[]): Block[] {
  const lead: Block[] = [];
  let used = 0;
  for (const block of blocks) {
    if (block.kind === 'bullets') {
      const items: string[] = [];
      for (const item of block.items) {
        if (used >= COLLAPSED_LENGTH) break;
        items.push(item);
        used += item.length;
      }
      if (items.length) lead.push({ kind: 'bullets', items });
    } else {
      if (used >= COLLAPSED_LENGTH) break;
      lead.push(block);
      used += block.text.length;
    }
    if (used >= COLLAPSED_LENGTH) break;
  }
  while (lead.length > 1 && lead[lead.length - 1].kind === 'heading') lead.pop();
  return lead;
}

export function PolicyBody({ body }: { body: string }) {
  const theme = useTheme();
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const all = parsePolicyBlocks(body);
  const long = body.length > COLLAPSE_OVER;
  const blocks = long && !expanded ? leadingBlocks(all) : all;

  return (
    <View style={styles.container}>
      {blocks.map((block, i) => {
        if (block.kind === 'heading') {
          return (
            <ThemedText key={i} type="smallBold" style={styles.heading}>
              {block.text}
            </ThemedText>
          );
        }
        if (block.kind === 'bullets') {
          return (
            <View key={i} style={styles.list}>
              {block.items.map((item, j) => (
                <View key={j} style={styles.bulletRow}>
                  <ThemedText style={[styles.glyph, { color: theme.primary }]}>{'•'}</ThemedText>
                  <ThemedText style={styles.bulletText}>{item}</ThemedText>
                </View>
              ))}
            </View>
          );
        }
        return <ThemedText key={i}>{block.text}</ThemedText>;
      })}
      {long ? (
        <Button
          title={expanded ? t('Show less') : t('Show more')}
          variant="secondary"
          icon={<Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={theme.text} />}
          onPress={() => setExpanded((v) => !v)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Full spacing between paragraphs, headings, and lists...
    gap: Spacing.three,
  },
  list: {
    // ...half spacing between the bullets inside a list, so items read as a
    // group without collapsing into a wall of text.
    gap: Spacing.two,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingLeft: Spacing.one,
  },
  glyph: {
    lineHeight: 24,
  },
  bulletText: {
    flex: 1,
  },
  heading: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: Spacing.one,
  },
});
