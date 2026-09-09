import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

/**
 * The standard copy affordance next to an external link: tap copies the URL,
 * the icon flashes to a checkmark. Content leaves the app as links, so this
 * is how people share until an in-app share flow exists.
 */
export function CopyLinkButton({ url, label }: { url: string; label?: string }) {
  const theme = useTheme();
  const t = useT();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (rare); nothing useful to tell the user.
    }
  };

  return (
    <Pressable
      onPress={copy}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label ?? t('Copy link')}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
      <Ionicons
        name={copied ? 'checkmark' : 'copy-outline'}
        size={18}
        color={copied ? theme.verified : theme.textSecondary}
      />
    </Pressable>
  );
}
