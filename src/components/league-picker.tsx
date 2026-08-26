import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useLayout } from '@/lib/layout';
import { leagueColors, orderedLeagues, useLeague } from '@/lib/leagues';
import { useTheme } from '@/lib/theme';

// Global league selector shown above the content tabs (Scores/Standings/Stats/Teams). Reads the shared
// LeagueContext so switching league on one tab carries to the others. The selected pill takes on that
// league's own (more saturated) color.
export function LeaguePicker() {
  const t = useTheme();
  const dark = t.mode === 'dark';
  const { league, setLeague } = useLeague();
  const layout = useLayout();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Centered on iPad: the content below (a centered grid, or a table capped to its columns)
      // sits on the screen's center line, and a left-hugging pill row would float away from it.
      style={{ backgroundColor: 'transparent', flexGrow: 0, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' }}
      contentContainerStyle={[
        styles.row,
        { paddingHorizontal: layout.gutter },
        layout.regular && { flexGrow: 1, justifyContent: 'center' },
      ]}
    >
      {orderedLeagues().map((l) => {
        const active = l.id === league;
        const pill = leagueColors(l.id, dark).pill;
        return (
          <Pressable
            key={l.id}
            onPress={() => setLeague(l.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.pill,
              { borderColor: t.border },
              active ? { backgroundColor: pill, borderColor: pill } : { backgroundColor: t.card },
            ]}
          >
            <Text style={{ color: active ? (dark ? '#0b0b0b' : '#ffffff') : t.sub, fontSize: 13, fontWeight: active ? '800' : '600' }}>
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
