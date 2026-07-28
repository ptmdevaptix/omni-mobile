import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import type { StandingsResponse, StandingsTeam } from '@/lib/types';

// NHL for the scaffold; a league switcher is an easy next step (/api/ahl-standings, /api/ncaa-standings…).
export default function StandingsScreen() {
  const t = useTheme();
  const [teams, setTeams] = useState<StandingsTeam[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await api<StandingsResponse>('/nhl-standings');
      setTeams([...(d.teams ?? [])].sort((a, b) => b.pts - a.pts));
    } catch (e) {
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!teams && !error) {
    return <View style={[styles.center, { backgroundColor: t.bg }]}><ActivityIndicator color={t.accent} /></View>;
  }
  if (error) {
    return <View style={[styles.center, { backgroundColor: t.bg }]}><Text style={{ color: t.sub, padding: 24, textAlign: 'center' }}>Couldn’t load standings.{'\n'}{error}</Text></View>;
  }

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      data={teams ?? []}
      keyExtractor={(x) => x.abbr}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={t.accent} />}
      ListHeaderComponent={
        <View style={[styles.row, styles.head, { borderColor: t.border }]}>
          <Text style={[styles.rank, { color: t.sub }]}>#</Text>
          <Text style={{ flex: 1, color: t.sub, fontSize: 12 }}>Team</Text>
          <Text style={[styles.stat, { color: t.sub }]}>GP</Text>
          <Text style={[styles.rec, { color: t.sub }]}>W-L-OTL</Text>
          <Text style={[styles.stat, { color: t.sub, fontWeight: '700' }]}>PTS</Text>
        </View>
      }
      renderItem={({ item, index }) => <Row team={item} rank={index + 1} />}
    />
  );
}

function Row({ team, rank }: { team: StandingsTeam; rank: number }) {
  const t = useTheme();
  return (
    <Link href={{ pathname: '/teams/[teamId]', params: { teamId: team.abbr.toLowerCase() } }} asChild>
      <View style={[styles.row, { borderColor: t.border, backgroundColor: t.bg }]}>
        <Text style={[styles.rank, { color: t.sub }]}>{rank}</Text>
        {team.logo ? <Image source={{ uri: team.logo }} style={styles.logo} resizeMode="contain" /> : <View style={styles.logo} />}
        <Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{team.name}</Text>
        <Text style={[styles.stat, { color: t.sub }]}>{team.gp}</Text>
        <Text style={[styles.rec, { color: t.text, fontVariant: ['tabular-nums'] }]}>{team.w}-{team.l}-{team.otl}</Text>
        <Text style={[styles.stat, { color: t.text, fontWeight: '700', fontVariant: ['tabular-nums'] }]}>{team.pts}</Text>
      </View>
    </Link>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { paddingVertical: 6 },
  rank: { width: 22, fontSize: 13, textAlign: 'center' },
  logo: { width: 22, height: 22 },
  stat: { width: 34, textAlign: 'right', fontSize: 13 },
  rec: { width: 78, textAlign: 'right', fontSize: 13 },
});
