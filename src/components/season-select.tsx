import { Pressable, StyleSheet, Text, View } from 'react-native';

import { shortSeasonName, type StandingsSeason } from '@/lib/standings-cards';
import { useTheme } from '@/lib/theme';

/**
 * The season switch on a standings table: one button per season the route offers, newest first.
 * Renders nothing with fewer than two — a switch with one position is noise.
 */
export function SeasonSelect({ seasons, value, onChange }: { seasons: StandingsSeason[]; value: string | null; onChange: (id: string) => void }) {
  const t = useTheme();
  if (seasons.length < 2) return null;
  return (
    <View style={[styles.group, { borderColor: t.border }]} accessibilityRole="radiogroup" accessibilityLabel="Season">
      {seasons.map((s) => {
        const on = value === s.id;
        return (
          <Pressable key={s.id} onPress={() => onChange(s.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={[styles.item, on && { backgroundColor: t.text }]}>
            <Text style={{ color: on ? t.bg : t.sub, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{shortSeasonName(s.name)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  item: { paddingHorizontal: 8, paddingVertical: 4 },
});
