import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { GameCard } from '@/components/game-card';
import { KeyDateBanner } from '@/components/key-date-banner';
import { MyTeamsBar } from '@/components/my-teams-bar';
import { StateView } from '@/components/state-view';
import { useCompact } from '@/lib/compact';
import { useFavorites } from '@/lib/favorites';
import { centered, gameColumns, toRows, useLayout } from '@/lib/layout';
import { fetchAllScores, gameLeague, homeLeagueOrder } from '@/lib/leagues';
import { usePullRefresh } from '@/lib/pull-refresh';
import { useTheme } from '@/lib/theme';
import type { ScoreGame } from '@/lib/types';

type Section = { title: string; live?: boolean; data: ScoreGame[] };
// Each rendered item is a "row" of games — 1 on a phone, up to 4 on an iPad in compact mode.
type RowSection = { title: string; live?: boolean; data: ScoreGame[][] };

// Home: cross-league scoreboard. My Teams → Live Scores → remaining grouped by league (NHL first).
export default function HomeScreen() {
  const t = useTheme();
  const { favorites } = useFavorites();
  const { compact } = useCompact();
  const layout = useLayout();
  const per = gameColumns(layout, compact);
  const q = useQuery({ queryKey: ['all-scores'], queryFn: fetchAllScores, refetchInterval: 30_000 });

  const { refreshing, onRefresh } = usePullRefresh(q.refetch);
  const teams = q.data?.teamsById ?? {};
  const sections = useMemo(() => buildSections(q.data?.games ?? [], favorites), [q.data, favorites]);
  const rowSections = useMemo<RowSection[]>(() => sections.map((s) => ({ ...s, data: toRows(s.data, per) })), [sections, per]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <MyTeamsBar />
      {q.isLoading ? (
        <StateView kind="loading" />
      ) : q.isError ? (
        <StateView kind="error" message="Couldn’t load scores." onRetry={() => q.refetch()} />
      ) : (
        <SectionList
          key={`${per}`}
          style={{ flex: 1 }}
          contentContainerStyle={{ ...centered(layout), paddingBottom: 24 }}
          sections={rowSections}
          keyExtractor={(row) => row[0].id}
          stickySectionHeadersEnabled={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={11}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
          // Inside the list, not pinned above it: there's no dismiss here like on web, and it would
          // otherwise hold a strip of every Home visit for the weeks it's up.
          ListHeaderComponent={<KeyDateBanner />}
          ListEmptyComponent={<StateView kind="offseason" title="No games today" message="Scores will appear here when games are on." />}
          renderSectionHeader={({ section }) => <SectionHeader title={section.title} live={section.live} />}
          renderItem={({ item, section }) => (
            <View style={per > 1 ? { flexDirection: 'row', gap: 10 } : undefined}>
              {item.map((g) => (
                <GameCard key={g.id} game={g} teams={teams} featured={section.title === 'My Teams'} compact={compact} fill={per > 1} />
              ))}
              {/* Keep a short last row's cards at column width instead of stretching them. */}
              {per > 1 && item.length < per
                ? Array.from({ length: per - item.length }, (_, i) => <View key={`pad${i}`} style={{ flex: 1 }} />)
                : null}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

function SectionHeader({ title, live }: { title: string; live?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      {live ? <View style={[styles.dot, { backgroundColor: t.live }]} /> : null}
      <Text style={{ color: live ? t.live : t.sub, fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' }}>{title}</Text>
    </View>
  );
}

function buildSections(games: ScoreGame[], favorites: string[]): Section[] {
  const fav = new Set(favorites);
  const sections: Section[] = [];

  const myTeams = games.filter((g) => fav.has(g.homeTeamId) || fav.has(g.awayTeamId));
  const shown = new Set(myTeams.map((g) => g.id));
  if (myTeams.length) sections.push({ title: 'My Teams', data: myTeams });

  const live = games.filter((g) => g.status === 'LIVE' && !shown.has(g.id));
  live.forEach((g) => shown.add(g.id));
  if (live.length) sections.push({ title: 'Live Scores', live: true, data: live });

  const remaining = games.filter((g) => !shown.has(g.id));
  for (const lg of homeLeagueOrder()) {
    const grp = remaining.filter((g) => gameLeague(g) === lg);
    if (grp.length) sections.push({ title: lg, data: grp });
  }
  return sections;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
