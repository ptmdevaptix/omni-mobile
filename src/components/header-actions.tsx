import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { useCompact } from '@/lib/compact';
import { useTheme, useThemeMode } from '@/lib/theme';

// Right-side nav-bar actions (all tabs): open team/player search, toggle compact scores, and toggle light/dark.
export function HeaderActions() {
  const t = useTheme();
  const router = useRouter();
  const { scheme, setPref } = useThemeMode();
  const { compact, setCompact } = useCompact();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingRight: 4 }}>
      <Pressable onPress={() => router.push('/search')} hitSlop={10} accessibilityLabel="Search">
        <SymbolView name="magnifyingglass" tintColor={t.text} size={20} />
      </Pressable>
      <Pressable
        onPress={() => setCompact(!compact)}
        hitSlop={10}
        accessibilityLabel={compact ? 'Switch to full-size scores' : 'Switch to compact scores'}
      >
        <SymbolView name={compact ? 'rectangle.grid.1x2' : 'square.grid.2x2'} tintColor={compact ? t.accent : t.text} size={20} />
      </Pressable>
      <Pressable
        onPress={() => setPref(scheme === 'dark' ? 'light' : 'dark')}
        hitSlop={10}
        accessibilityLabel={scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <SymbolView name={scheme === 'dark' ? 'sun.max.fill' : 'moon.fill'} tintColor={t.text} size={20} />
      </Pressable>
    </View>
  );
}
