import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LeaguePicker } from '@/components/league-picker';
import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { compareTeamGroups, fetchAllTeams, isBlock, leagueById, leagueColors, leaguesIn, type PickerId, type TeamDirectoryEntry } from '@/lib/leagues';
import { useFollowedLeagues } from '@/lib/followed-leagues';
import { useTheme } from '@/lib/theme';

// Team browser (reached from More → Teams). Local league picker (it's outside the tabs' shared league
// context), then teams grouped by division/conference in a 2-column grid — mirroring the web team grids.
export default function TeamsBrowserScreen() {
  const t = useTheme();
  const dark = t.mode === 'dark';
  const [league, setLeague] = useState<PickerId>('nhl');
  const { followed } = useFollowedLeagues();
  const c = leagueColors(league, dark);
  const q = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });

  const members = useMemo(() => leaguesIn(league, followed), [league, followed]);

  const groups = useMemo(() => {
    // A block holds several leagues, and their divisions mean nothing to each other — an "East" in
    // the OHL is not an "East" in the WHL. So a block groups by LEAGUE, and a single league keeps
    // grouping by division the way it always has.
    if (isBlock(league)) {
      return members
        .map((id) => {
          const label = leagueById(id).label;
          return {
            name: label,
            teams: (q.data ?? []).filter((tm) => tm.league === label).sort((a, b) => a.name.localeCompare(b.name)),
          };
        })
        .filter((g) => g.teams.length);
    }

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
      // Per-league order: NHL divisions in conference sequence, NCAA with Independents last.
      .sort((a, b) => compareTeamGroups(league, a.name, b.name));
  }, [q.data, league, members]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Local selection: this screen sits outside the tabs, so it owns its own league rather than
          moving the one the tabs share. */}
      <LeaguePicker value={league} onChange={setLeague} />

      {q.isLoading ? (
        <StateView kind="loading" />
      ) : q.isError ? (
        <StateView kind="error" message="Couldn’t load teams." onRetry={() => q.refetch()} />
      ) : !groups.length ? (
        <StateView kind="empty" title="No teams" message="Nothing to show for this league." />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 28 }}>
          {groups.map((g) => (
            <View key={g.name} style={{ marginBottom: 6 }}>
              <Text style={[styles.groupHeader, { color: t.sub }]}>{g.name.toUpperCase()}</Text>
              <View style={styles.grid}>
                {g.teams.map((team) => <TeamCard key={team.id} team={team} card={c.card} />)}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function TeamCard({ team, card }: { team: TeamDirectoryEntry; card: string }) {
  const t = useTheme();
  return (
    <Link href={{ pathname: '/teams/[teamId]', params: { teamId: team.id } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.card, { backgroundColor: card, borderColor: t.border }])}>
        <TeamLogo uri={team.logo} darkUri={team.darkLogo} size={34} />
        <Text style={{ flex: 1, color: t.text, fontSize: 13, fontWeight: '600' }} numberOfLines={2}>{team.name}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  groupHeader: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginTop: 12, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  card: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
});
