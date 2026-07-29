import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { LEAGUES, useLeague } from '@/lib/leagues';
import { useTheme } from '@/lib/theme';

// Global league selector shown above the content tabs (Scores/Standings/Stats/Teams). Reads the shared
// LeagueContext so switching league on one tab carries to the others. Pure JS pills (Expo Go-safe).
export function LeaguePicker() {
  const t = useTheme();
  const { league, setLeague } = useLeague();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ backgroundColor: t.bg, flexGrow: 0 }}
      contentContainerStyle={styles.row}
    >
      {LEAGUES.map((l) => {
        const active = l.id === league;
        return (
          <Pressable
            key={l.id}
            onPress={() => setLeague(l.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.pill,
              { borderColor: t.border },
              active ? { backgroundColor: t.accent, borderColor: t.accent } : { backgroundColor: t.card },
            ]}
          >
            <Text style={{ color: active ? t.onAccent : t.sub, fontSize: 13, fontWeight: active ? '700' : '600' }}>
              {l.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
});
