import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

export function PolicyBody({ body }: { body: string }) {
  const theme = useTheme();
  const blocks = parsePolicyBlocks(body);

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
