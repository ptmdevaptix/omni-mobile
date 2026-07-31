import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { TAB_LABEL, type TeamTab } from '@/lib/team';
import { useTheme } from '@/lib/theme';

// Horizontal pill sub-nav for the team hub (Home / Schedule / Roster / Stats / Prospects).
export function TeamTabsBar({ tabs, value, onChange }: { tabs: TeamTab[]; value: TeamTab; onChange: (t: TeamTab) => void }) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: t.bg }} contentContainerStyle={styles.row}>
      {tabs.map((tab) => {
        const on = tab === value;
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            style={[styles.pill, { borderColor: on ? t.accent : t.border, backgroundColor: on ? t.accent : t.card }]}
          >
            <Text style={{ color: on ? t.onAccent : t.sub, fontSize: 13, fontWeight: on ? '700' : '600' }}>{TAB_LABEL[tab]}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
});
