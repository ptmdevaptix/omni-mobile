import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme';
import { useProspectFollowActions } from '@/lib/use-follows';

/**
 * The per-NHL-team "Follow prospects" switch (docs/design/prospect-follows.md on the web).
 *
 * On: the org's affiliates become favorites (tagged, so the switch can take them back) and every
 * prospect's club rides with the favorites, labeled. Off: the follow and its tagged affiliates go.
 */
export function ProspectFollowToggle({ team, variant = 'pill' }: { team: string; variant?: 'pill' | 'row' }) {
  const t = useTheme();
  const { isOn, enable, disable } = useProspectFollowActions();
  const on = isOn(team);
  const toggle = () => (on ? disable(team) : enable(team));

  if (variant === 'row') {
    return (
      <View style={styles.rowWrap}>
        <Text style={{ color: t.sub, fontSize: 12 }}>Follow prospects</Text>
        <Switch value={on} onValueChange={toggle} trackColor={{ true: t.accent }} style={styles.switch} accessibilityLabel={`Follow ${team.toUpperCase()} prospects`} />
      </View>
    );
  }
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={on ? "Following this team's prospects — their clubs' games show with your favorites" : "Follow this team's prospects: their clubs' games show with your favorites, and the affiliates join your teams"}
      style={[styles.pill, on ? { backgroundColor: t.accent, borderColor: t.accent } : { borderColor: t.border }]}
    >
      <SymbolView name="person.2.fill" tintColor={on ? t.onAccent : t.sub} size={12} />
      <Text style={{ color: on ? t.onAccent : t.sub, fontSize: 12, fontWeight: '600' }}>{on ? 'Following prospects' : 'Follow prospects'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  rowWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switch: { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] },
});
