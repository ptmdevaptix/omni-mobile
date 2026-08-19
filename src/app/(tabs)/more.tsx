import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme';

// Phase 3 fills these in. "Teams" is live now (browser reached here per the nav design); the rest are stubs.
// NB: the `Leaders` row is intentionally omitted until src/app/leaders.tsx renders real data — a reachable
// "coming soon" screen is a App Review rejection risk (Guideline 2.1, placeholder content). The route still
// exists; re-add { label: 'Leaders', icon: 'chart.bar.fill', href: '/leaders' } once it's built out.
type Row = { label: string; icon: SymbolViewProps['name']; href?: string };
const ROWS: Row[] = [
  { label: 'Teams', icon: 'shield.lefthalf.filled', href: '/teams' },
  { label: 'Favorites', icon: 'star.fill', href: '/favorites' },
  { label: 'About', icon: 'info.circle.fill', href: '/about' },
];

export default function MoreScreen() {
  const t = useTheme();
  const router = useRouter();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        {ROWS.map((row, i) => (
          <Pressable
            key={row.label}
            onPress={() => row.href && router.push(row.href as any)}
            disabled={!row.href}
            style={[styles.row, i > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth }]}
          >
            <SymbolView name={row.icon} tintColor={t.accent} size={20} type="hierarchical" />
            <Text style={{ flex: 1, color: t.text, fontSize: 16 }}>{row.label}</Text>
            {row.href
              ? <SymbolView name="chevron.right" tintColor={t.subtle} size={14} />
              : <Text style={{ color: t.subtle, fontSize: 13 }}>Soon</Text>}
          </Pressable>
        ))}
      </View>
      <Text style={{ color: t.subtle, fontSize: 12, textAlign: 'center', marginTop: 16 }}>Omni Hockey · data from omnihockey.com</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
});
