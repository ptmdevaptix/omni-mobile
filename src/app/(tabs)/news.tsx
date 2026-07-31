import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { SegmentedFilter } from '@/components/segmented-filter';
import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { useFavorites } from '@/lib/favorites';
import { fetchAllTeams, type TeamDirectoryEntry } from '@/lib/leagues';
import { fetchNews, timeAgo, type NewsItem } from '@/lib/news';
import { usePullRefresh } from '@/lib/pull-refresh';
import { useTheme } from '@/lib/theme';

export default function NewsScreen() {
  const t = useTheme();
  const [view, setView] = useState('My Teams');
  const q = useQuery({ queryKey: ['news'], queryFn: () => fetchNews(50), refetchInterval: 5 * 60_000 });
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={styles.filter}>
        <SegmentedFilter options={['My Teams', 'Latest']} value={view} onChange={setView} pill={t.accent} />
      </View>
      {q.isLoading ? (
        <StateView kind="loading" />
      ) : q.isError ? (
        <StateView kind="error" message="Couldn’t load news." onRetry={() => q.refetch()} />
      ) : view === 'Latest' ? (
        <Latest items={q.data ?? []} refreshing={refreshing} onRefresh={onRefresh} />
      ) : (
        <MyTeams items={q.data ?? []} refreshing={refreshing} onRefresh={onRefresh} />
      )}
    </View>
  );
}

function Latest({ items, refreshing, onRefresh }: { items: NewsItem[]; refreshing: boolean; onRefresh: () => void }) {
  const t = useTheme();
  return (
    <FlatList
      contentContainerStyle={{ padding: 12, gap: 10 }}
      data={items}
      keyExtractor={(a) => String(a.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      ListEmptyComponent={<StateView kind="empty" title="No news" message="Nothing to show right now." />}
      renderItem={({ item }) => <NewsCard a={item} />}
    />
  );
}

function MyTeams({ items, refreshing, onRefresh }: { items: NewsItem[]; refreshing: boolean; onRefresh: () => void }) {
  const t = useTheme();
  const { favorites } = useFavorites();
  const teamsQ = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });

  const sections = useMemo(() => {
    const byId = new Map<string, TeamDirectoryEntry>((teamsQ.data ?? []).map((tm) => [tm.id, tm]));
    return favorites.map((id) => {
      const tm = byId.get(id);
      const tagged = items.filter((a) => (a.teamTags ?? []).some((tag) => tag.id === id)).slice(0, 4);
      const fromTag = items.flatMap((a) => a.teamTags ?? []).find((tag) => tag.id === id);
      return { id, name: tm?.name ?? fromTag?.name ?? id, logo: tm?.logo ?? fromTag?.logo, data: tagged };
    });
  }, [favorites, teamsQ.data, items]);

  if (!favorites.length) {
    return <StateView kind="empty" title="No teams starred" message="Tap the ★ on any team to see its news here." />;
  }

  return (
    <SectionList
      contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
      sections={sections}
      keyExtractor={(a) => String(a.id)}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      renderSectionHeader={({ section }) => (
        <Link href={{ pathname: '/teams/[teamId]', params: { teamId: section.id } }} asChild>
          <Pressable style={StyleSheet.flatten([styles.teamBar, { backgroundColor: t.card, borderColor: t.border }])}>
            <TeamLogo uri={section.logo} size={22} />
            <Text style={{ color: t.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{section.name}</Text>
          </Pressable>
        </Link>
      )}
      renderSectionFooter={({ section }) => (section.data.length === 0 ? <Text style={{ color: t.subtle, fontSize: 13, paddingHorizontal: 4, paddingVertical: 8 }}>No recent news.</Text> : null)}
      renderItem={({ item }) => <NewsRow a={item} />}
    />
  );
}

function NewsCard({ a }: { a: NewsItem }) {
  const t = useTheme();
  const tags = (a.teamTags ?? []).slice(0, 4);
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(a.url)}
      style={({ pressed }) => [styles.card, { backgroundColor: t.card, borderColor: t.border }, pressed && { opacity: 0.7 }]}
    >
      {a.imageUrl ? <Image source={{ uri: a.imageUrl }} style={styles.image} contentFit="cover" /> : null}
      <View style={{ padding: 12, gap: 5 }}>
        <Text style={{ color: t.sub, fontSize: 12, fontWeight: '600' }}>{[a.source, timeAgo(a.publishedAt)].filter(Boolean).join(' · ')}</Text>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '700', lineHeight: 21 }} numberOfLines={3}>{a.title}</Text>
        {a.excerpt ? <Text style={{ color: t.sub, fontSize: 13, lineHeight: 19 }} numberOfLines={3}>{a.excerpt}</Text> : null}
        {tags.length ? (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <View key={tag.id} style={styles.tag}>
                <TeamLogo uri={tag.logo} size={16} />
                <Text style={{ color: t.sub, fontSize: 11, fontWeight: '700' }}>{tag.abbr}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// Compact row for the grouped My Teams view (no image).
function NewsRow({ a }: { a: NewsItem }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => WebBrowser.openBrowserAsync(a.url)} style={({ pressed }) => [styles.row, { borderColor: t.border }, pressed && { opacity: 0.6 }]}>
      <Text style={{ color: t.sub, fontSize: 11, fontWeight: '600' }}>{[a.source, timeAgo(a.publishedAt)].filter(Boolean).join(' · ')}</Text>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '600', lineHeight: 19, marginTop: 2 }} numberOfLines={2}>{a.title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filter: { paddingTop: 8 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  image: { width: '100%', height: 160 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginTop: 14, marginBottom: 6 },
  row: { paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
});
