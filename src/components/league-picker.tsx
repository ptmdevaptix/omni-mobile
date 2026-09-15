import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFollowedLeagues } from '@/lib/followed-leagues';
import { blockOf, leagueColors, pickerRows, useLeague, type BlockKey, type PickerId } from '@/lib/leagues';
import { useTheme } from '@/lib/theme';

/**
 * The league selector above Scores / Standings / Stats / Teams.
 *
 * ONE scrolling row, mirroring the web. Grouped leagues collapse behind a single pill — CHL rather
 * than OHL, WHL and QMJHL — so the default row is six pills instead of fourteen, and stays six as
 * more leagues arrive. Selecting a block appends its members to the same row after a divider:
 *
 *     [NHL] [AHL] [ECHL] [NCAA] [CHL] [USHL] │ OHL  WHL  QMJHL
 *
 * The block stays selected while a member row is showing, because the block IS a selection — "all
 * the CHL" — not a disclosure state. Tapping a member narrows to it; tapping the member you are on
 * widens back to all of them.
 *
 * Tapping the block pill while already on the block puts the member row away without changing what
 * you are watching: on a narrow screen those three extra pills are most of the row, and someone who
 * wants the whole CHL has no use for them until they want to narrow again.
 *
 * The chevron on a block pill is the only hint that anything is behind it. Without it the pill looks
 * identical to NHL, and the three leagues inside are undiscoverable unless you happen to tap.
 */
export function LeaguePicker({ value, onChange }: { value?: PickerId; onChange?: (id: PickerId) => void } = {}) {
  const t = useTheme();
  const dark = t.mode === 'dark';
  const ctx = useLeague();
  const { followed } = useFollowedLeagues();
  const league = value ?? ctx.league;
  const setLeague = onChange ?? ctx.setLeague;
  const { top, members: open } = pickerRows(followed, league);

  // Which block the reader has put away. Held per block, and only honoured while that block is the
  // one showing, so arriving at a different league never leaves a stale drawer shut.
  const [collapsed, setCollapsed] = useState<BlockKey | null>(null);
  const shut = !!collapsed && blockOf(league)?.key === collapsed;
  const members = shut ? [] : open;

  // Opening a block puts its members at the END of a row that is already wider than the screen, so
  // without this the only feedback for tapping CHL is a chevron flipping direction. Scroll them into
  // view on the transition only — re-scrolling on every render would fight the reader's own swipe.
  const scroller = useRef<ScrollView>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const open = members.length > 0;
    if (open && !wasOpen.current) scroller.current?.scrollToEnd({ animated: true });
    wasOpen.current = open;
  }, [members.length]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ backgroundColor: 'transparent', flexGrow: 0 }}
      contentContainerStyle={styles.row}
    >
      {top.map((entry) => {
        const id: PickerId = entry.kind === 'block' ? entry.key : entry.id;
        // A block reads as selected while any of its members is, so the row never looks unselected
        // just because the reader has narrowed to one league inside it.
        const active = entry.kind === 'block'
          ? league === entry.key || entry.members.some((m) => m.id === league)
          : entry.id === league;
        const pill = leagueColors(id, dark).pill;
        return (
          <Pressable
            key={id}
            onPress={() => {
              // Already on this block: the pill is a drawer handle. Otherwise it is what selects the
              // block — including from one of its own members, where it means "all of them".
              if (entry.kind === 'block' && league === entry.key) { setCollapsed(shut ? null : entry.key); return; }
              setCollapsed(null);
              setLeague(id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active, expanded: entry.kind === 'block' ? (active && !shut) : undefined }}
            accessibilityLabel={entry.kind === 'block' ? `${entry.label}, ${entry.members.length} leagues` : entry.label}
            style={[
              styles.pill,
              { borderColor: t.border },
              active ? { backgroundColor: pill, borderColor: pill } : { backgroundColor: t.card },
            ]}
          >
            <Text style={{ color: active ? (dark ? '#0b0b0b' : '#ffffff') : t.sub, fontSize: 13, fontWeight: active ? '800' : '600' }}>
              {entry.label}
              {entry.kind === 'block' ? <Text style={{ fontSize: 9 }}>{active && !shut ? '  ▾' : '  ▸'}</Text> : null}
            </Text>
          </Pressable>
        );
      })}

      {members.length > 0 && (
        <>
          <View style={[styles.divider, { backgroundColor: t.border }]} />
          {members.map((m) => {
            const on = m.id === league;
            const block = blockOf(m.id)!;
            return (
              <Pressable
                key={m.id}
                // Tapping the member you are already on widens back to the whole block, matching the
                // web — it is the only way back to "all of it" without hunting for the block pill.
                onPress={() => { setCollapsed(null); setLeague(on ? block.key : m.id); }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={styles.member}
              >
                <Text style={{ color: on ? t.text : t.sub, fontSize: 13, fontWeight: on ? '800' : '600' }}>{m.label}</Text>
              </Pressable>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: 'center' },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  member: { paddingHorizontal: 8, paddingVertical: 7 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 6, marginHorizontal: 2 },
});
