import { StyleSheet, Text, View } from 'react-native';

import { daysOut, daysOutLabel, MAX_WEEK_SQUARES } from '@/lib/days-out';
import { dayKey, localDayKey } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/**
 * The squares in a future game card's corner: one muted square per day up to a week, and beyond
 * that an accent square per whole week followed by muted squares for the days left over. Past eight
 * weeks the weeks become a number ("12w") and the days keep their squares. Nothing for today — the
 * card already shows the time. Mirrors components/days-out.tsx on the web.
 */
export function DaysOutSquares({ utc, day }: { utc?: string; day?: string }) {
  const t = useTheme();
  const gameDay = utc ? localDayKey(utc) : day;
  if (!gameDay) return null;
  const d = daysOut(dayKey(), gameDay);
  if (!d) return null;
  const muted = t.mode === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.25)';
  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel={daysOutLabel(d)}>
      {d.weeks > MAX_WEEK_SQUARES
        ? <Text style={{ color: t.accent, fontSize: 9, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{d.weeks}w</Text>
        : Array.from({ length: d.weeks }, (_, i) => <View key={`w${i}`} style={[styles.square, { backgroundColor: t.accent }]} />)}
      {Array.from({ length: d.rem }, (_, i) => <View key={`d${i}`} style={[styles.square, { backgroundColor: muted }]} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  square: { width: 5, height: 5, borderRadius: 1 },
});
