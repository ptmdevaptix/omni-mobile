import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme';

// Pill-colored segmented control used above standings tables (Conference / League / Division …).
export function SegmentedFilter({ options, value, onChange, pill }: { options: string[]; value: string; onChange: (v: string) => void; pill: string }) {
  const t = useTheme();
  const onText = t.mode === 'dark' ? '#0b0b0b' : '#ffffff';
  return (
    <View style={styles.wrap}>
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
