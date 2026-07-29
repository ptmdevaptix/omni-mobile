import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme';

// Brand header (logo mark + wordmark), mirroring the web AppHeader. Shown as the nav-bar title on every
// tab in place of the per-screen name (the bottom tab bar already identifies the screen).
const LIGHT = require('@/assets/images/omni-logo-light.png'); // black/metallic mark — light mode
const DARK = require('@/assets/images/omni-logo-dark.png');   // gold mark — dark mode

export function OmniHeader() {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Image source={t.mode === 'dark' ? DARK : LIGHT} style={styles.logo} contentFit="contain" />
      <Text style={[styles.word, { color: t.text }]}>Omni Hockey</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 28, height: 28 },
  word: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
});
