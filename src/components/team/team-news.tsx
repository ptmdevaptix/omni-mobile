import { useQuery } from '@tanstack/react-query';
import { FlatList } from 'react-native';

import { NewsCard } from '@/components/news-card';
import { StateView } from '@/components/state-view';
import { fetchTeamNews } from '@/lib/news';
import { useTheme } from '@/lib/theme';

// Team page → News tab: recent articles tagged with this team.
export function TeamNews({ teamId }: { teamId: string }) {
  const t = useTheme();
  const q = useQuery({ queryKey: ['team-news', teamId], queryFn: () => fetchTeamNews(teamId), staleTime: 5 * 60_000 });

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError) return <StateView kind="error" message="Couldn’t load news." onRetry={() => q.refetch()} />;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 24 }}
      data={q.data ?? []}
      keyExtractor={(a) => String(a.id)}
      ListEmptyComponent={<StateView kind="empty" title="No recent news" message="Nothing published about this team in the last two weeks." />}
      renderItem={({ item }) => <NewsCard a={item} />}
    />
  );
}
