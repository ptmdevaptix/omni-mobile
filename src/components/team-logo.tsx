import { Image } from 'expo-image';
import { View } from 'react-native';

import { resolveLogo } from '@/lib/api';

// One place for team-logo quirks:
//  - resolve site-relative override paths (/team-logos/…) against the omnihockey.com origin, and
//  - scale NHL logos up: their SVGs carry internal viewBox padding, so they render ~1.5× smaller than
//    other leagues' logos in the same box (the web app applies the same correction).
export function TeamLogo({ uri, size }: { uri?: string; size: number }) {
  const resolved = resolveLogo(uri);
  if (!resolved) return <View style={{ width: size, height: size }} />;
  const isNhl = resolved.includes('assets.nhle.com');
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Image
        source={{ uri: resolved }}
        style={{ width: size, height: size, transform: isNhl ? [{ scale: 1.5 }] : undefined }}
        contentFit="contain"
      />
    </View>
  );
}
