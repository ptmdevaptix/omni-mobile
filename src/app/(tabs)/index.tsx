import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { FollowingPanel } from '@/components/following-panel';
import { GameCard } from '@/components/game-card';
import { KeyDateBanner } from '@/components/key-date-banner';
import { MyTeamsBar } from '@/components/my-teams-bar';
import { StateView } from '@/components/state-view';
import { SubHeading } from '@/components/sub-heading';
import { useCompact } from '@/lib/compact';
import { useFavorites } from '@/lib/favorites';
import { useFollowedLeagues } from '@/lib/followed-leagues';
import { dayKey, dayLabel } from '@/lib/format';
import {
  favMatchIds, favoriteIn, fetchLookahead, fetchNextGames, gameIsFollowed, isFavGame, nextGameAsCard,
  type LookaheadSlate,
} from '@/lib/home';
import { fetchAllScores, fetchAllTeams, gameLeague, groupNcaaByConference, hasLiveGame, homeLeagueOrder, interleagueTitle, isInterleague, leagueFamily, LIVE_MAX_AGE_MS } from '@/lib/leagues';
import { usePullRefresh } from '@/lib/pull-refresh';
import { useTheme } from '@/lib/theme';
import type { ScoreGame, ScoreTeam } from '@/lib/types';

// `groups` (NCAA only): the section is sub-headed by conference, in display order.
type Section = { title: string; subtitle?: string; live?: boolean; featured?: boolean; data: ScoreGame[]; groups?: [string, ScoreGame[]][] };
// Each rendered item is a "row" of 1 game (full) or up to 2 games (compact grid) — or a sub-heading.
type Row = ScoreGame[] | { heading: string };
type RowSection = Omit<Section, 'data' | 'groups'> & { data: Row[]; first?: boolean };

function toRows(games: ScoreGame[], per: number): ScoreGame[][] {
  const rows: ScoreGame[][] = [];
  for (let i = 0; i < games.length; i += per) rows.push(games.slice(i, i + per));
  return rows;
}

function sectionRows(s: Section, per: number): Row[] {
  if (!s.groups) return toRows(s.data, per);
  return s.groups.flatMap(([heading, games]) => [{ heading }, ...toRows(games, per)]);
}

const isHeading = (r: Row): r is { heading: string } => !Array.isArray(r);

const STATUS_RANK: Record<string, number> = { LIVE: 0, FINAL: 1, UPCOMING: 2 };
const byStatus = (a: ScoreGame, b: ScoreGame) =>
  (STATUS_RANK[a.status] ?? 3) - (STATUS_RANK[b.status] ?? 3) || (a.startTimeUTC ?? '').localeCompare(b.startTimeUTC ?? '');

// Home = what YOU follow, today — and what's next when today is dark. Favorites (your teams' games, any
// league; a team not playing today shows its next game) → Live Games from the leagues you follow → one
// section per followed league, showing today's slate or, when there isn't one, the next day with games.
// A first-time user follows the NHL until they say otherwise; the Following panel at the bottom is
// where they say otherwise. Same rules as the web Home (app/home-view.tsx).
export default function HomeScreen() {
  const t = useTheme();
  const { favorites } = useFavorites();
  const { followed, loaded: followedLoaded, customized } = useFollowedLeagues();
  const { compact } = useCompact();
  const today = dayKey();
  const listRef = useRef<SectionList<Row, RowSection>>(null);
  // The Following panel is the list footer; both nudges scroll there.
  const goToFollowing = () => listRef.current?.getScrollResponder()?.scrollToEnd({ animated: true });

  const q = useQuery({
    queryKey: ['all-scores', today],
    queryFn: () => fetchAllScores(today),
    // Poll faster while something is actually being played. A fixed 30s meant a live clock could sit
    // half a minute behind, which reads as wrong rather than merely delayed.
    refetchInterval: (query) => (hasLiveGame(query.state.data?.games) ? 10_000 : 30_000),
    // The global default is refetchOnWindowFocus: false, to stop a flapping focus state from storming
    // every query. Scores are the one case where returning to the app must re-check immediately.
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
  const teamsDir = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });

  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  // A cached payload holding a live game goes stale in seconds — see LIVE_MAX_AGE_MS in lib/leagues.
  // Suppress it rather than re-render the clock this screen had when you left it.
  const stale = Date.now() - q.dataUpdatedAt > LIVE_MAX_AGE_MS && hasLiveGame(q.data?.games);
  const data = stale ? undefined : q.data;

  const favIds = useMemo(() => favMatchIds(favorites), [favorites]);
  const followedSet = useMemo(() => new Set<string>(followed), [followed]);

  // Today's games Home cares about: followed leagues plus anything involving a favorite.
  const todayGames = useMemo(
    () => (data?.games ?? []).filter((g) => gameIsFollowed(g, followedSet) || isFavGame(g, favIds)),
    [data, followedSet, favIds],
  );

  // Favorites without a game today → their next game, one request for all of them. Cheap and cached;
  // in season most favorites play most days and this returns little.
  const idle = useMemo(
    () => favorites.filter((id) => !todayGames.some((g) => favoriteIn(g, [id]))),
    [favorites, todayGames],
  );
  const nextQ = useQuery({
    queryKey: ['next-games', idle.join(','), today],
    queryFn: () => fetchNextGames(idle, today),
    enabled: !!data && idle.length > 0,
    staleTime: 30 * 60_000,
  });

  // Followed leagues with nothing today get their next slate, fetched after today's has painted.
  const dark = useMemo(() => {
    if (!data) return [] as string[];
    const lit = new Set(todayGames.map(gameLeague));
    return followed.filter((lg) => !lit.has(lg));
  }, [data, todayGames, followed]);
  const lookQ = useQuery({
    queryKey: ['lookahead', dark.join(','), today],
    queryFn: async () => (await Promise.all(dark.map((lg) => fetchLookahead(lg, today).catch(() => null)))).filter((s): s is LookaheadSlate => !!s),
    enabled: !!data && dark.length > 0,
    staleTime: 30 * 60_000,
  });

  const { sections, teams } = useMemo(() => {
    const teams: Record<string, ScoreTeam> = { ...(data?.teamsById ?? {}) };
    for (const s of lookQ.data ?? []) Object.assign(teams, s.teamsById);
    const nextCards: ScoreGame[] = [];
    const byId = new Map((teamsDir.data ?? []).map((tm) => [tm.id, tm]));
    for (const id of idle) {
      const info = nextQ.data?.[id];
      if (!info) continue;
      const { game, teams: extra } = nextGameAsCard(info, id, byId.get(id));
      Object.assign(teams, extra);
      nextCards.push(game);
    }
    return { sections: buildSections(todayGames, favIds, followed, nextCards, lookQ.data ?? [], today), teams };
  }, [data, todayGames, favIds, followed, idle, nextQ.data, lookQ.data, teamsDir.data, today]);

  const rowSections = useMemo<RowSection[]>(
    () => sections.map((s, i) => ({ ...s, first: i === 0, data: sectionRows(s, compact ? 2 : 1) })),
    [sections, compact],
  );
  const nothingFollowed = followedLoaded && followed.length === 0 && favorites.length === 0;
  // Brand new: nothing favorited and the league list never touched (NHL default in effect). The panel
  // is at the bottom, so without a nudge up top a first-time user never learns Home is theirs to shape.
  const brandNew = followedLoaded && !customized && favorites.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <MyTeamsBar />
      {/* `stale` matters here as much as isLoading: isLoading is false whenever a cached payload
          exists, so without it a suppressed payload would fall through to an empty list and render
          the "No games today" empty state — worse than the stale clock it replaced. */}
      {q.isLoading || stale || !followedLoaded ? (
        <StateView kind="loading" />
      ) : q.isError ? (
        <StateView kind="error" message="Couldn’t load scores." onRetry={() => q.refetch()} />
      ) : (
        <SectionList
          ref={listRef}
          key={compact ? 'grid' : 'list'}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
          sections={rowSections}
          keyExtractor={(row) => (isHeading(row) ? `h:${row.heading}` : row[0].id)}
          stickySectionHeadersEnabled={false}
          // Following a league inserts its section ABOVE the Following panel (after the lookahead
          // answers), and the first change also removes the brand-new callout up top. Without this the
          // scroll offset stays put while the content shifts, so the panel the user was tapping in slides
          // away and they land on whatever moved into its place. Anchor the visible items instead.
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={11}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
          // Inside the list, not pinned above it: there's no dismiss here like on web, and it would
          // otherwise hold a strip of every Home visit for the weeks it's up.
          ListHeaderComponent={
            <>
              <KeyDateBanner />
              {brandNew ? (
                <View style={[styles.callout, { backgroundColor: t.card, borderColor: t.accent }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>Make Home yours</Text>
                    <Text style={{ color: t.sub, fontSize: 13, marginTop: 2 }}>
                      You’re seeing the NHL by default. Follow the leagues you care about and add your teams.
                    </Text>
                  </View>
                  <Pressable onPress={goToFollowing} accessibilityRole="button" style={[styles.calloutBtn, { backgroundColor: t.accent }]}>
                    <Text style={{ color: t.onAccent, fontSize: 13, fontWeight: '800' }}>Customize</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            nothingFollowed
              ? <StateView kind="empty" title="Nothing on your Home yet" message="Follow a league or add a favorite team below to fill it." />
              : lookQ.isLoading || nextQ.isLoading
                ? <StateView kind="loading" />
                : <StateView kind="offseason" title="Nothing on today" message="Your leagues and teams have no games today." />
          }
          ListFooterComponent={<FollowingPanel />}
          renderSectionHeader={({ section }) => (
            <SectionHeader
              title={section.title}
              subtitle={section.subtitle}
              live={section.live}
              // The small, always-there route to the Following panel, on whichever section is on top —
              // Favorites when there are any, otherwise the first league — so it's reachable without
              // scrolling no matter what Home holds.
              action={section.first ? { label: 'Customize', onPress: goToFollowing } : undefined}
            />
          )}
          renderItem={({ item }) =>
            isHeading(item) ? (
              <SubHeading title={item.heading} />
            ) : (
              <View style={compact ? { flexDirection: 'row', gap: 10 } : undefined}>
                {/* No metallic frame here: Favorites is already its own section, so the frame said nothing
                    the header didn't. It lives on the Scores tab, where a favorite sits among its league. */}
                {item.map((g) => <GameCard key={g.id} game={g} teams={teams} compact={compact} />)}
                {compact && item.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            )
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

function SectionHeader({ title, subtitle, live, action }: {
  title: string; subtitle?: string; live?: boolean; action?: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      {live ? <View style={[styles.dot, { backgroundColor: t.live }]} /> : null}
      <Text style={{ color: live ? t.live : t.sub, fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' }}>{title}</Text>
      {subtitle ? <Text style={{ color: t.subtle, fontSize: 12, fontWeight: '600', marginLeft: 4, flexShrink: 1 }} numberOfLines={1}>{subtitle}</Text> : null}
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" style={{ marginLeft: 'auto', paddingVertical: 2, paddingLeft: 8 }}>
          <Text style={{ color: t.sub, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' }}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function buildSections(
  games: ScoreGame[],
  favIds: ReadonlySet<string>,
  followed: readonly string[],
  nextCards: ScoreGame[],
  slates: LookaheadSlate[],
  today: string,
): Section[] {
  const sections: Section[] = [];
  const followedSet = new Set(followed);

  // Favorites: their games today (live first), then the next game for each favorite not playing.
  const mine = games.filter((g) => isFavGame(g, favIds)).sort(byStatus);
  const shown = new Set(mine.map((g) => g.id));
  const favData = [...mine, ...nextCards.sort((a, b) => (a.gameDate ?? '').localeCompare(b.gameDate ?? ''))];
  if (favData.length) sections.push({ title: 'Favorites', featured: true, data: favData });

  // Live games from followed leagues, not already shown above.
  const live = games.filter((g) => g.status === 'LIVE' && !shown.has(g.id) && gameIsFollowed(g, followedSet));
  live.forEach((g) => shown.add(g.id));
  if (live.length) sections.push({ title: 'Live Games', live: true, data: live });

  const remaining = games.filter((g) => !shown.has(g.id) && gameIsFollowed(g, followedSet));

  // Interleague fixtures get their own section rather than being filed under whichever league happened
  // to host — grouped BY FAMILY so "Interleague (CHL)" and a future "Interleague (NCAA)" don't share one.
  const crossByParent = new Map<string, ScoreGame[]>();
  for (const g of remaining) {
    if (!isInterleague(g)) continue;
    const parent = g.interleagueParent ?? '';
    if (!crossByParent.has(parent)) crossByParent.set(parent, []);
    crossByParent.get(parent)!.push(g);
    shown.add(g.id);
  }

  // One section per followed league in the regional order. Today's games when there are any; otherwise
  // the looked-ahead slate with its date in the header; otherwise a header saying nothing is scheduled.
  // Each family's interleague section follows the family's last league so it travels with them.
  const order = homeLeagueOrder();
  const lastOfFamily = new Map<string, string>();
  for (const lg of order) if (followedSet.has(lg)) lastOfFamily.set(leagueFamily(lg), lg);
  const slateByLeague = new Map(slates.map((s) => [s.league, s]));

  // The NCAA section is sub-headed by conference (Non-Conference last) — one header, runs inside it.
  const pushLeague = (lg: string, data: ScoreGame[], subtitle?: string) => {
    const groups = lg === 'NCAA' && data.some((g) => g.conference)
      ? groupNcaaByConference(data).map(([c, grp]) => [c, grp.sort(byStatus)] as [string, ScoreGame[]])
      : undefined;
    sections.push({ title: lg, subtitle, data, groups });
  };

  for (const lg of order) {
    if (!followedSet.has(lg)) continue;
    const grp = remaining.filter((g) => !shown.has(g.id) && gameLeague(g) === lg).sort(byStatus);
    if (grp.length) {
      pushLeague(lg, grp);
    } else {
      const slate = slateByLeague.get(lg);
      if (slate?.date) {
        pushLeague(lg, [...slate.games].sort(byStatus), `· Next games ${dayLabel(slate.date, today)}`);
      } else if (slate) {
        sections.push({ title: lg, subtitle: '· Nothing scheduled ahead', data: [] });
      }
      // Unknown (lookahead pending or failed): no section rather than a wrong "nothing ahead".
    }

    const family = leagueFamily(lg);
    if (lastOfFamily.get(family) === lg) {
      const cross = crossByParent.get(family);
      if (cross?.length) {
        sections.push({ title: interleagueTitle(cross[0]), data: cross });
        crossByParent.delete(family);
      }
    }
  }

  // Cross-family interleague (an NCAA side playing U Sports) goes last rather than being dropped.
  for (const cross of crossByParent.values()) {
    if (cross.length) sections.push({ title: interleagueTitle(cross[0]), data: cross });
  }
  return sections;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  callout: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, borderRadius: 14, borderWidth: 1, padding: 12 },
  calloutBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
});
