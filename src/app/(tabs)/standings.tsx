import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LeaguePicker } from '@/components/league-picker';
import { NhlStandings } from '@/components/nhl-standings';
import { SegmentedFilter } from '@/components/segmented-filter';
import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { WlotlStandings } from '@/components/wlotl-standings';
import {
  fetchNcaaStandings, leagueById, leagueColors, useLeague,
  type NcaaStandingsTeam,
} from '@/lib/leagues';
import { usePullRefresh } from '@/lib/pull-refresh';
import { useTheme } from '@/lib/theme';

export default function StandingsScreen() {
  const t = useTheme();
  const { league } = useLeague();
  const kind = leagueById(league).standingsKind;
  const c = leagueColors(league, t.mode === 'dark');

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LeaguePicker />
      {league === 'nhl' ? <NhlStandings card={c.card} /> : kind === 'ncaa' ? <NcaaStandings card={c.card} /> : <WlotlStandings key={league} league={league} card={c.card} />}
    </View>
  );
}

// --- NCAA: grouped by conference (default) or a flat league-wide table -------
type NcaaView = 'conference' | 'league';
const ncaaWinPct = (x: NcaaStandingsTeam) => { const g = x.oW + x.oL + x.oT; return g ? (x.oW + x.oT * 0.5) / g : 0; };

function NcaaStandings({ card }: { card: string }) {
  const t = useTheme();
  const [view, setView] = useState<NcaaView>('conference');
  const pill = leagueColors('ncaa', t.mode === 'dark').pill;
  const q = useQuery({ queryKey: ['ncaa-standings'], queryFn: fetchNcaaStandings });
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError) return <StateView kind="error" message="Couldn’t load standings." onRetry={() => q.refetch()} />;
  const groups = q.data ?? [];
  if (!groups.length) return <StateView kind="empty" title="No standings" message="Not available yet." />;

  const sections = view === 'conference'
    ? groups.map((g) => ({ label: g.conference, teams: g.teams }))
    : [{ label: '', teams: [...groups.flatMap((g) => g.teams)].sort((a, b) => ncaaWinPct(b) - ncaaWinPct(a)) }];
  const superTint = t.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)';

  return (
    <View style={{ flex: 1 }}>
      <SegmentedFilter options={['conference', 'league']} value={view} onChange={(v) => setView(v as NcaaView)} pill={pill} />
      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}>
        {sections.map((sec, si) => (
          <View key={si}>
            <View style={[styles.row, { backgroundColor: superTint, borderColor: t.border }]}>
              <Text style={{ flex: 1, color: t.sub, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }} numberOfLines={1}>{sec.label || 'Team'}</Text>
              <Text style={[styles.rec, { color: t.sub }]}>Conf</Text>
              <Text style={[styles.rec, { color: t.sub }]}>Overall</Text>
            </View>
            {sec.teams.map((team, i) => <NcaaRow key={team.routeId ?? i} team={team} card={card} />)}
          </View>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

function NcaaRow({ team, card }: { team: NcaaStandingsTeam; card: string }) {
  const t = useTheme();
  return (
    <Link href={{ pathname: '/teams/[teamId]', params: { teamId: team.routeId } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.row, { borderColor: t.border, backgroundColor: card }])}>
        <TeamLogo uri={team.logo} size={22} />
        <Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: '600', marginLeft: 8 }} numberOfLines={1}>{team.name}</Text>
        <Text style={[styles.rec, { color: t.text, fontVariant: ['tabular-nums'] }]}>{team.cW}-{team.cL}-{team.cT}</Text>
        <Text style={[styles.rec, { color: t.sub, fontVariant: ['tabular-nums'] }]}>{team.oW}-{team.oL}-{team.oT}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { paddingVertical: 6 },
  rank: { width: 22, fontSize: 13, textAlign: 'center' },
  stat: { width: 34, textAlign: 'right', fontSize: 13 },
  rec: { width: 78, textAlign: 'right', fontSize: 13 },
  confRow: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  confPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
});
