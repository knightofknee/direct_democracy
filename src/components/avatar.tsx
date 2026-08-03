import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/**
 * Official portrait. Renders an externally hosted photo when one is linked
 * (we never store the image), falling back to an initials tile - including
 * when the remote image fails to load.
 */
export function OfficialAvatar({
  name,
  photoUrl,
  size = 44,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const radius = size / 2;

  if (photoUrl && !failed) {
    return (
      <Image
        source={{ uri: photoUrl }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: theme.backgroundSelected }}
        contentFit="cover"
        transition={150}
        accessibilityLabel={`Portrait of ${name}`}
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius, backgroundColor: theme.primarySoft },
      ]}>
      <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: size * 0.36 }}>
        {initials || '?'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
