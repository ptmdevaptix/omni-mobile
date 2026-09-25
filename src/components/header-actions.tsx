import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { SyncButton } from '@/components/sync-sheet';
import { useCompact } from '@/lib/compact';
import { useNoticesPref } from '@/lib/notices-pref';
import { useTheme, useThemeMode } from '@/lib/theme';

// Right-side nav-bar actions (all tabs): open team/player search, toggle compact scores, and toggle light/dark.
export function HeaderActions() {
  const t = useTheme();
  const router = useRouter();
  const { scheme, setPref } = useThemeMode();
  const { compact, setCompact } = useCompact();
  const notices = useNoticesPref();
  return (
    // gap 16 rather than 18: the Sync button made five, and the title needs the room.
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingRight: 4 }}>
      {/* Sync across devices — first, and in colour, so pairing with the web can be found at all. */}
      <SyncButton />
      <Pressable onPress={() => router.push('/search')} hitSlop={10} accessibilityLabel="Search">
        <SymbolView name="magnifyingglass" tintColor={t.text} size={20} />
      </Pressable>
      {/* Announcements on / off — the notice strip on Home. A megaphone: announcements, not sound;
          dimmed when off, so the way back on is always in view (mirrors the web's header toggle). */}
      <Pressable
        onPress={() => notices.setOn(!notices.on)}
        hitSlop={10}
        accessibilityRole="switch"
        accessibilityState={{ checked: notices.on }}
        accessibilityLabel={notices.on ? 'Announcements are on — tap to hide the notice bar' : 'Announcements are off — tap to show the notice bar'}
      >
        <SymbolView name={notices.on ? 'megaphone.fill' : 'megaphone'} tintColor={notices.on ? t.text : t.subtle} size={20} />
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
