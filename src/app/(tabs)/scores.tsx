import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl, View } from 'react-native';

import { GameCard } from '@/components/game-card';
import { LeaguePicker } from '@/components/league-picker';
import { StateView } from '@/components/state-view';
import { fetchScores, leagueColors, useLeague } from '@/lib/leagues';
import { usePullRefresh } from '@/lib/pull-refresh';
import { useTheme } from '@/lib/theme';

// Per-league scores (league picker at top). The Home tab shows the cross-league aggregate.
export default function ScoresScreen() {
  const t = useTheme();
  const { league } = useLeague();
  const c = leagueColors(league, t.mode === 'dark');
  const q = useQuery({ queryKey: ['scores', league], queryFn: () => fetchScores(league), refetchInterval: 30_000 });
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  const games = q.data?.games ?? [];
  const teams = q.data?.teamsById ?? {};

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LeaguePicker />
      {q.isLoading ? (
        <StateView kind="loading" />
      ) : q.isError ? (
        <StateView kind="error" message="Couldn’t load scores." onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          data={games}
          keyExtractor={(g) => g.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
          ListEmptyComponent={<StateView kind="empty" title="No games" message="Nothing scheduled for this league right now." />}
          renderItem={({ item }) => <GameCard game={item} teams={teams} cardColor={c.card} />}
        />
      )}
    </View>
  );
}
