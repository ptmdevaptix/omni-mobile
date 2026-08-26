import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { useLayout } from '@/lib/layout';
import { fetchAllTeams, LEAGUES, leagueById, leagueColors, type LeagueId, type TeamDirectoryEntry } from '@/lib/leagues';
import { useTheme } from '@/lib/theme';

const GRID_GAP = 10;

// Team browser (reached from More → Teams). Local league picker (it's outside the tabs' shared league
// context), then teams grouped by division/conference in a 2-column grid — mirroring the web team grids.
export default function TeamsBrowserScreen() {
  const t = useTheme();
  const dark = t.mode === 'dark';
  const [league, setLeague] = useState<LeagueId>('nhl');
  const layout = useLayout();
  // 2 across on a phone, 3–4 on an iPad. Widths are computed rather than percentage-based so a short
  // last row keeps its column width instead of stretching across the grid.
  const cols = layout.wide ? 4 : layout.regular ? 3 : 2;
  const contentWidth = Math.min(layout.width, layout.maxWidth) - layout.gutter * 2;
  const cardWidth = (contentWidth - (cols - 1) * GRID_GAP) / cols;
  const c = leagueColors(league, dark);
  const q = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });

  const groups = useMemo(() => {
    const label = leagueById(league).label;
    const teams = (q.data ?? []).filter((tm) => tm.league === label);
    const byGroup = new Map<string, TeamDirectoryEntry[]>();
    for (const tm of teams) {
      const g = tm.group || 'Other';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(tm);
    }
    return [...byGroup.entries()]
      .map(([name, list]) => ({ name, teams: list.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [q.data, league]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' }}
        contentContainerStyle={[styles.pills, { paddingHorizontal: layout.gutter }]}
      >
        {LEAGUES.map((l) => {
          const on = l.id === league;
          const pill = leagueColors(l.id, dark).pill;
          return (
            <Pressable key={l.id} onPress={() => setLeague(l.id)}
              style={[styles.pill, { borderColor: on ? pill : t.border, backgroundColor: on ? pill : t.card }]}>
              <Text style={{ color: on ? (dark ? '#0b0b0b' : '#fff') : t.sub, fontSize: 13, fontWeight: on ? '800' : '600' }}>{l.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {q.isLoading ? (
        <StateView kind="loading" />
      ) : q.isError ? (
        <StateView kind="error" message="Couldn’t load teams." onRetry={() => q.refetch()} />
      ) : !groups.length ? (
        <StateView kind="empty" title="No teams" message="Nothing to show for this league." />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: layout.gutter, paddingVertical: 12, paddingBottom: 28 }}
        >
          {groups.map((g) => (
            <View key={g.name} style={{ marginBottom: 6 }}>
              <Text style={[styles.groupHeader, { color: t.sub }]}>{g.name.toUpperCase()}</Text>
              <View style={styles.grid}>
                {g.teams.map((team) => <TeamCard key={team.id} team={team} card={c.card} width={cardWidth} />)}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function TeamCard({ team, card, width }: { team: TeamDirectoryEntry; card: string; width: number }) {
  const t = useTheme();
  return (
    <Link href={{ pathname: '/teams/[teamId]', params: { teamId: team.id } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.card, { width, backgroundColor: card, borderColor: t.border }])}>
        <TeamLogo uri={team.logo} darkUri={team.darkLogo} size={34} />
        <Text style={{ flex: 1, color: t.text, fontSize: 13, fontWeight: '600' }} numberOfLines={2}>{team.name}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  pills: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  groupHeader: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginTop: 12, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GRID_GAP, rowGap: GRID_GAP },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
});
