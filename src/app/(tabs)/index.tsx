import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { GameCard } from '@/components/game-card';
import { KeyDateBanner } from '@/components/key-date-banner';
import { MyTeamsBar } from '@/components/my-teams-bar';
import { StateView } from '@/components/state-view';
import { useCompact } from '@/lib/compact';
import { useFavorites } from '@/lib/favorites';
import { fetchAllScores, gameLeague, hasLiveGame, homeLeagueOrder, interleagueTitle, isInterleague, leagueFamily, LIVE_MAX_AGE_MS } from '@/lib/leagues';
import { usePullRefresh } from '@/lib/pull-refresh';
import { useTheme } from '@/lib/theme';
import type { ScoreGame } from '@/lib/types';

type Section = { title: string; live?: boolean; data: ScoreGame[] };
// Each rendered item is a "row" of 1 game (full) or up to 2 games (compact grid).
type RowSection = { title: string; live?: boolean; data: ScoreGame[][] };

function toRows(games: ScoreGame[], per: number): ScoreGame[][] {
  const rows: ScoreGame[][] = [];
  for (let i = 0; i < games.length; i += per) rows.push(games.slice(i, i + per));
  return rows;
}

// Home: cross-league scoreboard. My Teams → Live Scores → remaining grouped by league (NHL first).
export default function HomeScreen() {
  const t = useTheme();
  const { favorites } = useFavorites();
  const { compact } = useCompact();
  const q = useQuery({
    queryKey: ['all-scores'],
    queryFn: fetchAllScores,
    // Poll faster while something is actually being played. A fixed 30s meant a live clock could sit
    // half a minute behind, which reads as wrong rather than merely delayed.
    refetchInterval: (query) => (hasLiveGame(query.state.data?.games) ? 10_000 : 30_000),
    // The global default is refetchOnWindowFocus: false, to stop a flapping focus state from storming
    // every query. Scores are the one case where returning to the app must re-check immediately.
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  // A cached payload holding a live game goes stale in seconds — see LIVE_MAX_AGE_MS in lib/leagues.
  // Suppress it rather than re-render the clock this screen had when you left it.
  const stale = Date.now() - q.dataUpdatedAt > LIVE_MAX_AGE_MS && hasLiveGame(q.data?.games);
  const data = stale ? undefined : q.data;

  const teams = data?.teamsById ?? {};
  const sections = useMemo(() => buildSections(data?.games ?? [], favorites), [data, favorites]);
  const rowSections = useMemo<RowSection[]>(() => sections.map((s) => ({ ...s, data: toRows(s.data, compact ? 2 : 1) })), [sections, compact]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <MyTeamsBar />
      {/* `stale` matters here as much as isLoading: isLoading is false whenever a cached payload
          exists, so without it a suppressed payload would fall through to an empty list and render
          the "No games today" empty state — worse than the stale clock it replaced. */}
      {q.isLoading || stale ? (
        <StateView kind="loading" />
      ) : q.isError ? (
        <StateView kind="error" message="Couldn’t load scores." onRetry={() => q.refetch()} />
      ) : (
        <SectionList
          key={compact ? 'grid' : 'list'}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
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
            <View style={compact ? { flexDirection: 'row', gap: 10 } : undefined}>
              {item.map((g) => <GameCard key={g.id} game={g} teams={teams} featured={section.title === 'My Teams'} compact={compact} />)}
              {compact && item.length === 1 ? <View style={{ flex: 1 }} /> : null}
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

  // Interleague fixtures get their own section rather than being filed under whichever league happened
  // to host. Putting an OHL-vs-QMJHL game under "QMJHL" is arbitrary and misleading — it reads as a
  // QMJHL game — and the single card is the point: the API already collapsed the two feed copies.
  //
  // Grouped BY FAMILY, not into one bucket: "Interleague (CHL)" and a future "Interleague (NCAA)" are
  // unrelated events and must not share a section.
  const crossByParent = new Map<string, ScoreGame[]>();
  for (const g of remaining) {
    if (!isInterleague(g)) continue;
    const parent = g.interleagueParent ?? '';
    if (!crossByParent.has(parent)) crossByParent.set(parent, []);
    crossByParent.get(parent)!.push(g);
    shown.add(g.id);
  }

  // Each interleague section sits with ITS OWN family — "Interleague (CHL)" directly after the last of
  // OHL/WHL/QMJHL — so it travels with them as the regional ordering moves NCAA about, rather than
  // being pinned to the top and overriding an order that was set deliberately.
  const order = homeLeagueOrder();
  const lastOfFamily = new Map<string, string>();
  for (const lg of order) lastOfFamily.set(leagueFamily(lg), lg);

  for (const lg of order) {
    const grp = remaining.filter((g) => !shown.has(g.id) && gameLeague(g) === lg);
    if (grp.length) sections.push({ title: lg, data: grp });

    // Emit the family's interleague section once the family's final league has been laid down —
    // whether or not that league itself had games today.
    const family = leagueFamily(lg);
    if (lastOfFamily.get(family) === lg) {
      const cross = crossByParent.get(family);
      if (cross?.length) {
        sections.push({ title: interleagueTitle(cross[0]), data: cross });
        crossByParent.delete(family);
      }
    }
  }

  // Anything whose family is not in the ordering at all — including the parentless cross-family case
  // (an NCAA side playing U Sports) — goes last rather than being dropped.
  for (const cross of crossByParent.values()) {
    if (cross.length) sections.push({ title: interleagueTitle(cross[0]), data: cross });
  }
  return sections;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
