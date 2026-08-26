import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { NewsCard } from '@/components/news-card';
import { SegmentedFilter } from '@/components/segmented-filter';
import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { useFavorites } from '@/lib/favorites';
import { centered, toRows, useLayout } from '@/lib/layout';
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
      <View style={[styles.filter, { width: '100%', maxWidth: 520, alignSelf: 'center' }]}>
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
  const layout = useLayout();
  // Article cards carry a 160pt image, so they read better two-up than stretched across an iPad.
  const per = layout.regular ? 2 : 1;
  const rows = useMemo(() => toRows(items, per), [items, per]);
  return (
    <FlatList
      key={`${per}`}
      contentContainerStyle={{ ...centered(layout), paddingVertical: 12, gap: 10 }}
      data={rows}
      keyExtractor={(row) => String(row[0].id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      ListEmptyComponent={<StateView kind="empty" title="No news" message="Nothing to show right now." />}
      renderItem={({ item }) => (
        <View style={per > 1 ? { flexDirection: 'row', gap: 10, alignItems: 'flex-start' } : undefined}>
          {item.map((a) => (
            <View key={String(a.id)} style={per > 1 ? { flex: 1 } : undefined}><NewsCard a={a} /></View>
          ))}
          {per > 1 && item.length < per ? <View style={{ flex: 1 }} /> : null}
        </View>
      )}
    />
  );
}

// "My Teams" league grouping order; USHL/other fall to the end.
function leagueOfId(id: string): string {
  if (id.startsWith('ahl-')) return 'AHL';
  if (id.startsWith('chl-ohl-')) return 'OHL';
  if (id.startsWith('chl-whl-')) return 'WHL';
  if (id.startsWith('chl-qmjhl-')) return 'QMJHL';
  if (id.startsWith('ncaa-')) return 'NCAA';
  if (id.startsWith('ushl-')) return 'USHL';
  return 'NHL';
}

function MyTeams({ items, refreshing, onRefresh }: { items: NewsItem[]; refreshing: boolean; onRefresh: () => void }) {
  const t = useTheme();
  const { favorites } = useFavorites();
  const layout = useLayout();
  const teamsQ = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });

  const sections = useMemo(() => {
    const byId = new Map<string, TeamDirectoryEntry>((teamsQ.data ?? []).map((tm) => [tm.id, tm]));
    const built = favorites.map((id) => {
      const tm = byId.get(id);
      const tagged = items.filter((a) => (a.teamTags ?? []).some((tag) => tag.id === id)).slice(0, 4);
      const fromTag = items.flatMap((a) => a.teamTags ?? []).find((tag) => tag.id === id);
      return { id, name: tm?.name ?? fromTag?.name ?? id, logo: tm?.logo ?? fromTag?.logo, darkLogo: tm?.darkLogo ?? fromTag?.darkLogo, league: leagueOfId(id), data: tagged };
    });
    // Favorite order within two groups: teams with news first, then teams without. Partitioned rather
    // than sorted so the ordering set in Settings is preserved exactly inside each group — the old
    // comparator also ranked by league and name, which discarded it entirely.
    return [...built.filter((s) => s.data.length), ...built.filter((s) => !s.data.length)];
  }, [favorites, teamsQ.data, items]);

  if (!favorites.length) {
    return <StateView kind="empty" title="No teams starred" message="Tap the ★ on any team to see its news here." />;
  }

  return (
    <SectionList
      contentContainerStyle={{ ...centered(layout, { padding: layout.regular ? layout.gutter : 12 }), paddingBottom: 24 }}
      sections={sections}
      keyExtractor={(a) => String(a.id)}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      renderSectionHeader={({ section }) => (
        <Link href={{ pathname: '/teams/[teamId]', params: { teamId: section.id } }} asChild>
          <Pressable style={StyleSheet.flatten([styles.teamBar, { backgroundColor: t.card, borderColor: t.border }])}>
            <TeamLogo uri={section.logo} darkUri={section.darkLogo} size={22} />
            <Text style={{ color: t.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{section.name}</Text>
          </Pressable>
        </Link>
      )}
      renderSectionFooter={({ section }) => (section.data.length === 0 ? <Text style={{ color: t.subtle, fontSize: 13, paddingHorizontal: 4, paddingVertical: 8 }}>No recent news.</Text> : null)}
      renderItem={({ item }) => <NewsRow a={item} />}
    />
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
  teamBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginTop: 14, marginBottom: 6 },
  row: { paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
});
