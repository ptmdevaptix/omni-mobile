import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme';

// Pill-colored segmented control used above standings tables (Conference / League / Division …).
// `flush` drops the built-in horizontal padding — use it when the parent already pads its content
// (e.g. the game-detail ScrollView), so the control lines up full-width with the cards around it.
export function SegmentedFilter({ options, value, onChange, pill, flush = false }: { options: string[]; value: string; onChange: (v: string) => void; pill: string; flush?: boolean }) {
  const t = useTheme();
  const onText = t.mode === 'dark' ? '#0b0b0b' : '#ffffff';
  return (
    <View style={[styles.wrap, flush && { paddingHorizontal: 0 }]}>
      <View style={[styles.segment, { backgroundColor: t.card, borderColor: t.border }]}>
        {options.map((v) => {
          const on = v === value;
          return (
            <Pressable key={v} onPress={() => onChange(v)} style={[styles.segItem, on && { backgroundColor: pill }]}>
              <Text style={{ color: on ? onText : t.sub, fontSize: 13, fontWeight: on ? '700' : '600', textTransform: 'capitalize' }}>{v}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingBottom: 8 },
  segment: { flexDirection: 'row', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 2, gap: 2 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
});
