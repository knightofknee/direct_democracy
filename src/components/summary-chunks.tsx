import React from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * An AI summary as short chunks at body reading size, never a block of
 * small print. Chunks are separated by blank lines in the data and open
 * with a short "Topic: " lead, set bold so the eye can jump by subject.
 * Used by the mayoral candidates' summaries and the weekly ward newsletter
 * digest.
 */
export function SummaryChunks({ label, text }: { label?: string; text: string }) {
  return (
    <View style={{ gap: Spacing.two }}>
      {label ? (
        <ThemedText
          type="smallBold"
          themeColor="textSecondary"
          style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
          {label}
        </ThemedText>
      ) : null}
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
