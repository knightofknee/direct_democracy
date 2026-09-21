import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useScreenRoom } from '@/hooks/use-screen-room';
import { useTheme } from '@/hooks/use-theme';
import type { PhotoFrame } from '@/lib/types';

/**
 * Where a framed photo sits inside a size x size box: scaled to cover the box
 * times the frame's zoom, with the frame's focal point moved to the center,
 * then clamped so the image still covers every edge. Only the source's aspect
 * ratio matters, so pixel vs point dimensions from onLoad are both fine.
 */
function framedLayout(width: number, height: number, size: number, frame: PhotoFrame) {
  const scale = Math.max(size / width, size / height) * Math.max(1, frame.zoom);
  const w = width * scale;
  const h = height * scale;
  const clamp = (v: number, min: number) => Math.min(0, Math.max(min, v));
  return {
    width: w,
    height: h,
    left: clamp(size / 2 - frame.x * w, size - w),
    top: clamp(size / 2 - frame.y * h, size - h),
  };
}

/**
 * Official portrait. Renders an externally hosted photo when one is linked
 * (we never store the image), falling back to an initials tile - including
 * when the remote image fails to load. A `frame` crops a photo whose subject
 * isn't a centered headshot (a banner, a group shot) down to the face.
 */
export function OfficialAvatar({
  name,
  photoUrl,
  frame,
  size = 44,
}: {
  name: string;
  photoUrl?: string | null;
  frame?: PhotoFrame | null;
  size?: number;
}) {
  const theme = useTheme();
  // On a tight screen the portrait yields width to the name beside it.
  const { tight } = useScreenRoom();
  if (tight) size = Math.min(size, 40);
  const [failed, setFailed] = useState(false);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const radius = size / 2;

  if (photoUrl && !failed && frame) {
    // The layout needs the image's aspect ratio, known once it loads; until
    // then the box shows its background rather than an unframed flash.
    const layout = natural ? framedLayout(natural.width, natural.height, size, frame) : null;
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: theme.backgroundSelected,
        }}>
        <Image
          source={{ uri: photoUrl }}
          onLoad={(e) => setNatural({ width: e.source.width, height: e.source.height })}
          onError={() => setFailed(true)}
          style={
            layout
              ? { position: 'absolute', ...layout }
              : { width: size, height: size, opacity: 0 }
          }
          contentFit="fill"
          transition={150}
          accessibilityLabel={`Portrait of ${name}`}
        />
      </View>
    );
  }

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
      <ThemedText
        type="smallBold"
        // lineHeight must scale with the font: smallBold's fixed 20pt line
        // clips the glyphs on any avatar larger than ~55pt (fontSize outgrows
        // the line box and iOS crops it).
        style={{
          color: theme.primary,
          fontSize: size * 0.36,
          lineHeight: Math.round(size * 0.5),
        }}>
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
