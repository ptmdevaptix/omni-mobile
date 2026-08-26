// The iPad side rail. Lives at the root, beside the whole navigation Stack, so it stays put when a
// team, game, player or Settings screen is pushed — the way an iPadOS sidebar behaves. On a phone
// it never renders; the bottom tab bar is the navigation there.
//
// Because it sits outside the navigators, it drives navigation through the imperative router and
// reads the current pathname for its selected state, rather than tab-bar props.
import { usePathname, useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { leagueColors, useLeague } from '@/lib/leagues';
import { RAIL_WIDTH, RAIL_WIDTH_COLLAPSED, useSidebar } from '@/lib/sidebar';
import { useTheme } from '@/lib/theme';

type Dest = { label: string; icon: SymbolViewProps['name']; href: string };

// The tab destinations, then everything the phone hides behind "More" — the rail has room for all
// of it, so there's no More here. Leaders is deliberately absent: that route is still a stub, and a
// reachable "coming soon" screen is an App Review rejection risk (Guideline 2.1).
// Opened with push(), not navigate() — /search is a modal, and it should stack over whatever the
// content pane is showing rather than replace it.
const SEARCH: Dest = { label: 'Search', icon: 'magnifyingglass', href: '/search' };

const PRIMARY: Dest[] = [
  { label: 'Home', icon: 'house.fill', href: '/' },
  { label: 'Scores', icon: 'sportscourt.fill', href: '/scores' },
  { label: 'Standings', icon: 'list.number', href: '/standings' },
  { label: 'News', icon: 'newspaper.fill', href: '/news' },
];

const SECONDARY: Dest[] = [
  { label: 'Teams', icon: 'shield.lefthalf.filled', href: '/teams' },
  { label: 'Favorites', icon: 'star.fill', href: '/favorites' },
  { label: 'Settings', icon: 'gearshape.fill', href: '/settings' },
  { label: 'About', icon: 'info.circle.fill', href: '/about' },
];

// Which rail row owns the current screen. Prefix-matched so a pushed detail keeps its section lit —
// /teams/col keeps Teams selected. Home is exact, or every path would match it.
function activeHref(pathname: string): string | null {
  if (pathname === '/') return '/';
  const match = [...PRIMARY, ...SECONDARY]
    .filter((d) => d.href !== '/' && (pathname === d.href || pathname.startsWith(`${d.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.href ?? null;
}

export function SideRail() {
  const t = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { collapsed, toggle } = useSidebar();
  const { league } = useLeague();

  const active = activeHref(pathname);
  // Scores and Standings tint their chrome to the selected league; the rail follows the header.
  const tinted = active === '/scores' || active === '/standings';
  const bg = tinted ? leagueColors(league, t.mode === 'dark').bg : t.card;

  return (
    <View
      style={[
        styles.rail,
        {
          width: collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH,
          backgroundColor: bg,
          borderRightColor: t.border,
          paddingTop: insets.top + 6,
          paddingBottom: insets.bottom + 8,
          paddingLeft: insets.left + 8,
        },
      ]}
    >
      <Pressable
        onPress={toggle}
        hitSlop={10}
        accessibilityLabel={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={[styles.row, collapsed && styles.rowCollapsed]}
      >
        <View style={styles.icon}>
          <SymbolView name={collapsed ? 'sidebar.leading' : 'sidebar.left'} tintColor={t.sub} size={22} />
        </View>
      </Pressable>

      {/* Search leads the rail, the way it does in Mail/Notes/Music — on iPad the sidebar is the
          app's index, and searching is an index-level action rather than a per-screen one. It's
          dropped from the nav bar here so the same control isn't offered twice. */}
      <Row
        dest={SEARCH}
        active={active === SEARCH.href}
        collapsed={collapsed}
        onPress={() => router.push(SEARCH.href as never)}
      />
      <View style={styles.gap} />

      {PRIMARY.map((d) => <Row key={d.href} dest={d} active={active === d.href} collapsed={collapsed} onPress={() => router.navigate(d.href as never)} />)}

      <View style={[styles.divider, { backgroundColor: t.border }]} />

      {SECONDARY.map((d) => <Row key={d.href} dest={d} active={active === d.href} collapsed={collapsed} onPress={() => router.navigate(d.href as never)} />)}
    </View>
  );
}

function Row({ dest, active, collapsed, onPress }: { dest: Dest; active: boolean; collapsed: boolean; onPress: () => void }) {
  const t = useTheme();
  const color = active ? t.accent : t.sub;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={dest.label}
      style={({ pressed }) => [
        styles.row,
        collapsed && styles.rowCollapsed,
        active && { backgroundColor: t.accentSoft },
        pressed && !active && { backgroundColor: t.border },
      ]}
    >
      <View style={styles.icon}>
        <SymbolView name={dest.icon} tintColor={color} size={22} type="hierarchical" />
      </View>
      {collapsed ? null : (
        <Text numberOfLines={1} style={{ color: active ? t.accent : t.text, fontSize: 15, fontWeight: active ? '700' : '500' }}>
          {dest.label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { borderRightWidth: StyleSheet.hairlineWidth, paddingRight: 8, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 44, paddingHorizontal: 10, borderRadius: 10 },
  rowCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  icon: { width: 24, alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10, marginHorizontal: 10 },
  gap: { height: 10 },
});
