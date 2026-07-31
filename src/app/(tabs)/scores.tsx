import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { GameCard } from '@/components/game-card';
import { LeaguePicker } from '@/components/league-picker';
import { StateView } from '@/components/state-view';
import { useCompact } from '@/lib/compact';
import { fetchScores, leagueColors, useLeague } from '@/lib/leagues';
import { usePullRefresh } from '@/lib/pull-refresh';
import { useTheme } from '@/lib/theme';
import type { ScoreGame } from '@/lib/types';

// Group games into rows of `per` so a lone last card stays half-width (matching the Home grid)
// instead of stretching full-width like FlatList numColumns would.
function toRows(games: ScoreGame[], per: number): ScoreGame[][] {
  const rows: ScoreGame[][] = [];
  for (let i = 0; i < games.length; i += per) rows.push(games.slice(i, i + per));
  return rows;
}

// Per-league scores (league picker at top). The Home tab shows the cross-league aggregate.
export default function ScoresScreen() {
  const t = useTheme();
  const { league } = useLeague();
  const { compact } = useCompact();
  const c = leagueColors(league, t.mode === 'dark');
  const q = useQuery({ queryKey: ['scores', league], queryFn: () => fetchScores(league), refetchInterval: 30_000 });
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  const games = q.data?.games ?? [];
  const teams = q.data?.teamsById ?? {};
  const rows = useMemo(() => toRows(games, compact ? 2 : 1), [games, compact]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LeaguePicker />
      {q.isLoading ? (
        <StateView kind="loading" />
      ) : q.isError ? (
        <StateView kind="error" message="Couldn’t load scores." onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          key={compact ? 'grid' : 'list'}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          data={rows}
          keyExtractor={(row) => row[0].id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
          ListEmptyComponent={<StateView kind="empty" title="No games" message="Nothing scheduled for this league right now." />}
          renderItem={({ item }) => (
            <View style={compact ? { flexDirection: 'row', gap: 10 } : undefined}>
              {item.map((g) => <GameCard key={g.id} game={g} teams={teams} cardColor={c.card} compact={compact} />)}
              {compact && item.length === 1 ? <View style={{ flex: 1 }} /> : null}
            </View>
          )}
        />
      )}
    </View>
  );
}
