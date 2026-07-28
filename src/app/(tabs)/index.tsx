import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import type { ScoreGame, ScoresResponse, ScoreTeam } from '@/lib/types';

export default function ScoresScreen() {
  const t = useTheme();
  const [data, setData] = useState<ScoresResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await api<ScoresResponse>('/scores'));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: t.bg }]}><ActivityIndicator color={t.accent} /></View>;
  }
  if (error) {
    return <View style={[styles.center, { backgroundColor: t.bg }]}><Text style={{ color: t.sub, padding: 24, textAlign: 'center' }}>Couldn’t load scores.{'\n'}{error}</Text></View>;
  }

  const games = data?.games ?? [];
  const teams = data?.teamsById ?? {};

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 12, gap: 10 }}
      data={games}
      keyExtractor={(g) => g.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={t.accent} />}
      ListEmptyComponent={<Text style={{ color: t.sub, textAlign: 'center', marginTop: 40 }}>No games today.</Text>}
      renderItem={({ item }) => <GameRow game={item} teams={teams} />}
    />
  );
}

function GameRow({ game, teams }: { game: ScoreGame; teams: Record<string, ScoreTeam> }) {
  const t = useTheme();
  const away = teams[game.awayTeamId] ?? {};
  const home = teams[game.homeTeamId] ?? {};
  const done = game.status === 'FINAL' || game.status === 'LIVE';
  const live = game.status === 'LIVE';
  return (
    <Link href={{ pathname: '/teams/[teamId]', params: { teamId: game.homeTeamId } }} asChild>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={styles.leagueRow}>
          <Text style={[styles.badge, { color: t.sub, borderColor: t.border }]}>{game.top}</Text>
          <Text style={{ color: live ? t.live : t.sub, fontSize: 12, fontWeight: live ? '700' : '400' }}>{game.statusLabel}</Text>
        </View>
        <TeamLine team={away} id={game.awayTeamId} score={game.awayScore} showScore={done} />
        <TeamLine team={home} id={game.homeTeamId} score={game.homeScore} showScore={done} />
        {game.network ? <Text style={{ color: t.sub, fontSize: 11, marginTop: 4 }}>📺 {game.network}</Text> : null}
      </View>
    </Link>
  );
}

function TeamLine({ team, id, score, showScore }: { team: ScoreTeam; id: string; score?: number; showScore: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.teamLine}>
      {team.logo ? <Image source={{ uri: team.logo }} style={styles.logo} resizeMode="contain" /> : <View style={styles.logo} />}
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '600', flex: 1 }} numberOfLines={1}>{team.name ?? team.abbr ?? id}</Text>
      {showScore ? <Text style={{ color: t.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{score ?? 0}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 6 },
  leagueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  badge: { fontSize: 10, fontWeight: '700', borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 24, height: 24 },
});
