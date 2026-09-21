import { useWindowDimensions } from 'react-native';

/**
 * How much room text really has. A 375pt phone with large system text is a
 * smaller screen than a 320pt phone at the default size, so the width is
 * divided by the text scale (capped at 1.4, where ThemedText stops growing).
 * Older phones usually have both: a narrow screen AND big text.
 *
 * Rule for every row in the app: words are never cut off or broken
 * mid-word. When room runs out, decoration gives way first (chevrons,
 * portrait size, padding), then text wraps.
 */
export function useScreenRoom(): { effective: number; tight: boolean; roomy: boolean } {
  const { width, fontScale } = useWindowDimensions();
  const effective = width / Math.min(Math.max(fontScale, 1), 1.4);
  return { effective, tight: effective < 360, roomy: effective >= 420 };
}
