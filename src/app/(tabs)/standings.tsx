import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LeaguePicker } from '@/components/league-picker';
import { NhlStandings } from '@/components/nhl-standings';
import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import {
  fetchNcaaStandings, fetchStandings, leagueById, useLeague,
  type NcaaStandingsTeam,
} from '@/lib/leagues';
import { useTheme } from '@/lib/theme';
import type { StandingsTeam } from '@/lib/types';

export default function StandingsScreen() {
  const t = useTheme();
  const { league } = useLeague();
  const kind = leagueById(league).standingsKind;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <LeaguePicker />
      {league === 'nhl' ? <NhlStandings /> : kind === 'ncaa' ? <NcaaStandings /> : <WlotlStandings league={league} />}
    </View>
  );
}

// --- NHL / AHL / CHL: W-L-OTL / PTS ------------------------------------------
function WlotlStandings({ league }: { league: string }) {
  const t = useTheme();
  const q = useQuery({ queryKey: ['standings', league], queryFn: () => fetchStandings(league as any) });
  const teams = useMemo(() => [...(q.data ?? [])].sort((a, b) => b.pts - a.pts || b.w - a.w), [q.data]);

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError) return <StateView kind="error" message="Couldn’t load standings." onRetry={() => q.refetch()} />;

  return (
    <FlatList
      style={{ flex: 1 }}
      data={teams}
      keyExtractor={(x, i) => x.routeId ?? x.abbr ?? String(i)}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={t.accent} />}
      ListEmptyComponent={<StateView kind="empty" title="No standings" message="Not available for this league yet." />}
      ListHeaderComponent={teams.length ? (
        <View style={[styles.row, styles.head, { borderColor: t.border }]}>
          <Text style={[styles.rank, { color: t.sub }]}>#</Text>
          <Text style={{ flex: 1, color: t.sub, fontSize: 12 }}>Team</Text>
          <Text style={[styles.stat, { color: t.sub }]}>GP</Text>
          <Text style={[styles.rec, { color: t.sub }]}>W-L-OTL</Text>
          <Text style={[styles.stat, { color: t.sub, fontWeight: '700' }]}>PTS</Text>
        </View>
      ) : null}
      renderItem={({ item, index }) => <WlotlRow team={item} rank={index + 1} />}
    />
  );
}

function WlotlRow({ team, rank }: { team: StandingsTeam; rank: number }) {
  const t = useTheme();
  return (
    <Link href={{ pathname: '/teams/[teamId]', params: { teamId: team.routeId ?? team.abbr.toLowerCase() } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.row, { borderColor: t.border, backgroundColor: t.card }])}>
        <Text style={[styles.rank, { color: t.sub }]}>{rank}</Text>
        <TeamLogo uri={team.logo} size={22} />
        <Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{team.name}</Text>
        <Text style={[styles.stat, { color: t.sub }]}>{team.gp}</Text>
        <Text style={[styles.rec, { color: t.text, fontVariant: ['tabular-nums'] }]}>{team.w}-{team.l}-{team.otl}</Text>
        <Text style={[styles.stat, { color: t.text, fontWeight: '700', fontVariant: ['tabular-nums'] }]}>{team.pts}</Text>
      </Pressable>
    </Link>
  );
}

// --- NCAA: conference-based, W-L-T (overall + conference) --------------------
function NcaaStandings() {
  const t = useTheme();
  const q = useQuery({ queryKey: ['ncaa-standings'], queryFn: fetchNcaaStandings });
  const [conf, setConf] = useState<string | null>(null);

  const groups = q.data ?? [];
  const active = groups.find((g) => g.conference === conf) ?? groups[0];

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError) return <StateView kind="error" message="Couldn’t load standings." onRetry={() => q.refetch()} />;
  if (!groups.length) return <StateView kind="empty" title="No standings" message="Not available yet." />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.confRow}>
        {groups.map((g) => {
          const on = g.conference === active?.conference;
          return (
            <Pressable key={g.conference} onPress={() => setConf(g.conference)}
              style={[styles.confPill, { borderColor: on ? t.accent : t.border, backgroundColor: on ? t.accent : t.card }]}>
              <Text style={{ color: on ? t.onAccent : t.sub, fontSize: 12, fontWeight: on ? '700' : '600' }}>{g.conference}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <FlatList
        style={{ flex: 1 }}
        data={active?.teams ?? []}
        keyExtractor={(x, i) => x.routeId ?? x.abbr ?? String(i)}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={t.accent} />}
        ListHeaderComponent={
          <View style={[styles.row, styles.head, { borderColor: t.border }]}>
            <Text style={{ flex: 1, color: t.sub, fontSize: 12 }}>Team</Text>
            <Text style={[styles.rec, { color: t.sub }]}>Conf</Text>
            <Text style={[styles.rec, { color: t.sub }]}>Overall</Text>
          </View>
        }
        renderItem={({ item }) => <NcaaRow team={item} />}
      />
    </View>
  );
}

function NcaaRow({ team }: { team: NcaaStandingsTeam }) {
  const t = useTheme();
  return (
    <Link href={{ pathname: '/teams/[teamId]', params: { teamId: team.routeId } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.row, { borderColor: t.border, backgroundColor: t.card }])}>
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
