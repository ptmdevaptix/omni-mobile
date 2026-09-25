import { useQueries, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { GameCard, type FollowReason } from '@/components/game-card';
import { MyTeamsBar } from '@/components/my-teams-bar';
import { NoticeStrip } from '@/components/notice-strip';
import { StateView } from '@/components/state-view';
import { SubHeading } from '@/components/sub-heading';
import { useCompact } from '@/lib/compact';
import { useFavorites } from '@/lib/favorites';
import { useFollowedLeagues } from '@/lib/followed-leagues';
import { buildAffiliateIndex, buildDerivedIndex, dressedStatus, followReasonItems, type DerivedIndex } from '@/lib/follows';
import { dayKey, dayLabel } from '@/lib/format';
import { fetchGameDetail } from '@/lib/game';
import {
  favMatchIds, favoriteIn, fetchLookahead, fetchNextGames, gameIsFollowed, isFavGame, nextGameAsCard,
  type LookaheadSlate, type NextGameInfo,
} from '@/lib/home';
import { fetchAllScores, fetchAllTeams, gameLeague, groupNcaaByConference, hasLiveGame, homeLeagueOrder, interleagueTitle, isInterleague, leagueFamily, LIVE_MAX_AGE_MS } from '@/lib/leagues';
import { usePullRefresh } from '@/lib/pull-refresh';
import { useTheme } from '@/lib/theme';
import type { GameDetail } from '@/lib/game-detail-types';
import type { ScoreGame, ScoreTeam } from '@/lib/types';
import { useDerivedClubs } from '@/lib/use-follows';

// `groups` (NCAA only): the section is sub-headed by conference, in display order.
// `hidden` (Favorites only): how many of the days-ahead cards are folded behind "Show more"; `folded`
// says whether the fold applies at all, so "Show fewer" can be offered once it is open.
type Section = { title: string; subtitle?: string; live?: boolean; featured?: boolean; data: ScoreGame[]; groups?: [string, ScoreGame[]][]; hidden?: number; folded?: boolean };
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
/** The Favorites block is never bare: the nearest future cards fill in up to this floor — in rows of
 *  one card, or of two in compact mode, so compact shows twice the cards in the same height. */
const FAV_MIN_ROWS = 2;
/** How many ROWS of today's cards the folded Favorites block shows before "Show more": six cards in
 *  the full layout, as on the web, twelve in compact — the point of compact is to fit more. */
const FAV_TODAY_ROWS = 6;
const byStatus = (a: ScoreGame, b: ScoreGame) =>
  (STATUS_RANK[a.status] ?? 3) - (STATUS_RANK[b.status] ?? 3) || (a.startTimeUTC ?? '').localeCompare(b.startTimeUTC ?? '');

// Home = what YOU follow, today — and what's next when today is dark. Favorites (your teams' games, any
// league; a team not playing today shows its next game) → Live Games from the leagues you follow → one
// section per followed league, showing today's slate or, when there isn't one, the next day with games.
// A first-time user follows the NHL until they say otherwise; the Following panel at the bottom is
// where they say otherwise. Same rules as the web Home (app/home-view.tsx).
export default function HomeScreen() {
  const t = useTheme();
  const { favorites, favoriteTeams, pinnedGames, togglePin } = useFavorites();
  const pinnedIds = useMemo(() => new Set(pinnedGames.map((p) => p.id)), [pinnedGames]);
  const { followed, loaded: followedLoaded, customized } = useFollowedLeagues();
  // Derived favorites: the clubs the user's followed players play for (lib/use-follows).
  const { clubs: derivedClubs } = useDerivedClubs();
  const derived = useMemo(() => buildDerivedIndex(derivedClubs), [derivedClubs]);
  const affiliateOf = useMemo(() => buildAffiliateIndex(favoriteTeams), [favoriteTeams]);
  const reasonItemsFor = (g: ScoreGame) => followReasonItems(g, derived, affiliateOf);
  const { compact } = useCompact();
  const today = dayKey();
  const listRef = useRef<SectionList<Row, RowSection>>(null);
  // Whether the rest of the Favorites is unfolded. Folded on every visit, as on the web: with enough
  // favorites, followed prospects and next games the block ran to forty cards every morning.
  const [moreOpen, setMoreOpen] = useState(false);
  // League sections the reader has put away. Not remembered: the web does not either, and a section
  // shut on Tuesday is not what a reader wants shut on Saturday.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggleCollapsed = (title: string) => setCollapsed((prev) => { const next = new Set(prev); if (next.has(title)) next.delete(title); else next.add(title); return next; });
  // The Following controls are their own screen now — see src/app/following.tsx. They used to be this
  // list's footer and this scrolled to them, which stopped being reasonable once the panel grew to
  // fourteen leagues across six groups.
  const goToFollowing = () => router.push('/following' as never);

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

  // Today's games Home cares about: followed leagues, anything involving a favorite, anything a
  // followed player is on, and any game pinned for today — whatever its league.
  const todayGames = useMemo(
    () => (data?.games ?? []).filter((g) => gameIsFollowed(g, followedSet) || isFavGame(g, favIds) || pinnedIds.has(g.id) || followReasonItems(g, derived, affiliateOf).length > 0),
    [data, followedSet, favIds, pinnedIds, derived, affiliateOf],
  );
  // Only today's slate can be pinned — the look-ahead and next-game cards are other days.
  const todayIds = useMemo(() => new Set((data?.games ?? []).map((g) => g.id)), [data]);

  // Favorites without a game today → their next game, one request for all of them. Cheap and cached;
  // in season most favorites play most days and this returns little. A followed player's club gets
  // one too, after the favorites; a club that is also a favorite is left to the favorite.
  const idle = useMemo(() => {
    const favSet = new Set(favorites);
    const teams = [...favorites, ...derivedClubs.map((c) => c.teamId).filter((id) => !favSet.has(id))];
    return teams.filter((id) => !todayGames.some((g) => favoriteIn(g, [id])));
  }, [favorites, derivedClubs, todayGames]);
  // A team the route could not answer for this time (a schedule fetch that failed or timed out)
  // keeps the answer it had, rather than its card vanishing until the next reload.
  const lastNext = useRef<Record<string, NextGameInfo>>({});
  const nextQ = useQuery({
    queryKey: ['next-games', idle.join(','), today],
    queryFn: async () => {
      const next = await fetchNextGames(idle, today);
      lastNext.current = { ...lastNext.current, ...next };
      const merged: Record<string, NextGameInfo> = {};
      for (const id of idle) { const v = next[id] ?? lastNext.current[id]; if (v) merged[id] = v; }
      return merged;
    },
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

  const { sections, teams, nextCards } = useMemo(() => {
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
    return { sections: buildSections(todayGames, favIds, pinnedIds, followed, nextCards, lookQ.data ?? [], today, moreOpen, compact ? 2 : 1, derived, affiliateOf), teams, nextCards };
  }, [data, todayGames, favIds, pinnedIds, followed, idle, nextQ.data, lookQ.data, teamsDir.data, today, moreOpen, compact, derived, affiliateOf]);

  // Game detail for the handful of followed games in play, so a card can gray a followed player who
  // sat. Only games with a followed PLAYER on them are asked; an affiliate-only card has nobody to
  // check. Re-asked every couple of minutes while live (lineups post around puck drop).
  const withPlayers = useMemo(
    () => todayGames.filter((g) => g.status !== 'UPCOMING' && reasonItemsFor(g).some((i) => i.player)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayGames, derived, affiliateOf],
  );
  const lineupQs = useQueries({
    queries: withPlayers.map((g) => ({
      queryKey: ['game', g.id],
      queryFn: () => fetchGameDetail(g.id),
      staleTime: g.status === 'LIVE' ? 120_000 : Infinity,
      refetchInterval: g.status === 'LIVE' ? 120_000 : false,
    })),
  });
  const lineupKey = lineupQs.map((q) => q.dataUpdatedAt).join(',');
  const lineups = useMemo(() => {
    const m = new Map<string, GameDetail>();
    withPlayers.forEach((g, i) => { const d = lineupQs[i]?.data; if (d) m.set(g.id, d); });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withPlayers, lineupKey]);
  // Why each game is here, for its foot line — with a followed player grayed when the lineup says he sat.
  const reasonById = useMemo(() => {
    const m = new Map<string, FollowReason>();
    for (const g of [...todayGames, ...nextCards]) {
      const raw = reasonItemsFor(g);
      if (!raw.length) continue;
      const detail = lineups.get(g.id);
      m.set(g.id, { items: raw.map((i) => ({ label: i.label, muted: !!(detail && i.player && i.side && dressedStatus(detail, i.side, i.player) === 'scratched') })) });
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayGames, nextCards, lineups, derived, affiliateOf]);

  const rowSections = useMemo<RowSection[]>(
    () => sections.map((s, i) => ({ ...s, first: i === 0, data: collapsed.has(s.title) ? [] : sectionRows(s, compact ? 2 : 1) })),
    [sections, compact, collapsed],
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
              <NoticeStrip />
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
          renderSectionHeader={({ section }) => (
            <SectionHeader
              title={section.title}
              subtitle={section.subtitle}
              live={section.live}
              // The small, always-there route to the Following panel, on whichever section is on top —
              // Favorites when there are any, otherwise the first league — so it's reachable without
              // scrolling no matter what Home holds.
              action={section.first ? { label: 'Customize', onPress: goToFollowing } : undefined}
              // League sections fold behind their header, as on the web; Favorites and Live never do.
              collapsible={!section.featured && !section.live}
              collapsed={collapsed.has(section.title)}
              count={sections.find((s) => s.title === section.title)?.data.length ?? 0}
              onToggle={() => toggleCollapsed(section.title)}
            />
          )}
          renderSectionFooter={({ section }) => {
            // Today's games always; the days ahead fold behind "Show more" — with enough favorites the
            // block ran to forty cards, most of them weeks out.
            if (!section.featured) return null;
            const hidden = section.hidden ?? 0;
            if (!(hidden > 0 || (moreOpen && section.folded))) return null;
            return (
              <Pressable onPress={() => setMoreOpen(!moreOpen)} accessibilityRole="button" style={{ paddingVertical: 8 }}>
                <Text style={{ color: t.accent, fontSize: 12, fontWeight: '600' }}>{moreOpen ? 'Show fewer games' : `Show ${hidden} more game${hidden === 1 ? '' : 's'}`}</Text>
              </Pressable>
            );
          }}
          renderItem={({ item }) =>
            isHeading(item) ? (
              <SubHeading title={item.heading} />
            ) : (
              <View style={compact ? { flexDirection: 'row', gap: 10 } : undefined}>
                {/* No metallic frame here: Favorites is already its own section, so the frame said nothing
                    the header didn't. It lives on the Scores tab, where a favorite sits among its league. */}
                {/* A gold star marks a STARRED team's game, in Favorites and anywhere else it lands. */}
                {item.map((g) => {
                  const starred = isFavGame(g, favIds);
                  return (
                    <GameCard
                      key={g.id} game={g} teams={teams} compact={compact} starred={starred} reason={reasonById.get(g.id)}
                      followed={!starred && reasonItemsFor(g).some((i) => i.player)}
                      pinned={pinnedIds.has(g.id)}
                      onTogglePin={!starred && todayIds.has(g.id) ? () => togglePin(g.id, today) : undefined}
                    />
                  );
                })}
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

function SectionHeader({ title, subtitle, live, action, collapsible, collapsed, count, onToggle }: {
  title: string; subtitle?: string; live?: boolean; action?: { label: string; onPress: () => void };
  collapsible?: boolean; collapsed?: boolean; count?: number; onToggle?: () => void;
}) {
  const t = useTheme();
  const body = (
    <>
      {live ? <View style={[styles.dot, { backgroundColor: t.live }]} /> : null}
      <Text style={{ color: live ? t.live : t.sub, fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' }}>{title}</Text>
      {subtitle ? <Text style={{ color: t.subtle, fontSize: 12, fontWeight: '600', marginLeft: 4, flexShrink: 1 }} numberOfLines={1}>{subtitle}</Text> : null}
      {collapsible && collapsed ? <Text style={{ color: t.subtle, fontSize: 12, marginLeft: 4 }}>({count} {count === 1 ? 'game' : 'games'})</Text> : null}
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" style={{ marginLeft: 'auto', paddingVertical: 2, paddingLeft: 8 }}>
          <Text style={{ color: t.sub, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' }}>{action.label}</Text>
        </Pressable>
      ) : null}
      {/* The chevron is the only hint the section folds; without it the header looks like a label. */}
      {collapsible ? <Text style={{ color: t.subtle, fontSize: 12, marginLeft: action ? 8 : 'auto' }}>{collapsed ? '▸' : '▾'}</Text> : null}
    </>
  );
  if (!collapsible) return <View style={styles.header}>{body}</View>;
  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: !collapsed }} style={styles.header}>
      {body}
    </Pressable>
  );
}

function buildSections(
  games: ScoreGame[],
  favIds: ReadonlySet<string>,
  pinnedIds: ReadonlySet<string>,
  followed: readonly string[],
  nextCards: ScoreGame[],
  slates: LookaheadSlate[],
  today: string,
  moreOpen: boolean,
  perRow: number,
  derived: DerivedIndex,
  affiliateOf: ReadonlyMap<string, string>,
): Section[] {
  const sections: Section[] = [];
  const followedSet = new Set(followed);

  // Favorites, in tiers, as on the web (omni-hockey lib/favorite-order.ts): every live game — a
  // starred team's, then a pinned one, then a followed player's; then today's starred-team games,
  // today's pinned games, today's followed-player games (each finals first, then by start time); then
  // the days ahead. A game both starred and pinned is starred; one pinned and also a followed
  // player's is pinned — pinning it is asking for it higher.
  const isStar = (g: ScoreGame) => isFavGame(g, favIds);
  const tier = (g: ScoreGame) => (isStar(g) ? 0 : pinnedIds.has(g.id) ? 1 : 2);
  const mine = games.filter((g) => isStar(g) || pinnedIds.has(g.id) || followReasonItems(g, derived, affiliateOf).length > 0);
  const shown = new Set(mine.map((g) => g.id));
  // Date-aware: a game that knows only its day sorts at that day's end, not before today.
  const whenKey = (g: ScoreGame) => g.startTimeUTC ?? (g.gameDate ? `${g.gameDate}T99` : '9999');
  const byWhen = (a: ScoreGame, b: ScoreGame) => whenKey(a).localeCompare(whenKey(b));
  const finalsFirst = (a: ScoreGame, b: ScoreGame) => (a.status === 'FINAL' ? 0 : 1) - (b.status === 'FINAL' ? 0 : 1) || byWhen(a, b);
  // A next-game card dated today is a game the slate did not carry (a seeded schedule with no scores
  // feed): it joins its own tier. Later ones are the days ahead.
  const todayNext = nextCards.filter((g) => (g.gameDate ?? '') <= today);
  const laterNext = nextCards.filter((g) => (g.gameDate ?? '') > today).sort(byWhen);
  const liveMine = mine.filter((g) => g.status === 'LIVE').sort((a, b) => tier(a) - tier(b) || byWhen(a, b));
  const tierToday = (k: number) => [
    ...mine.filter((g) => g.status !== 'LIVE' && tier(g) === k),
    ...todayNext.filter((g) => (k === 0 ? isStar(g) : k === 2 ? !isStar(g) : false)),
  ].sort(finalsFirst);

  // Folded, the block shows today: every live, starred-team and pinned game however many there are,
  // then today's followed-player games up to six cards in all. The rest of today and the days ahead
  // wait behind "Show more". An offseason morning still shows the nearest next games, up to a floor,
  // and a part-filled last row of the grid takes the next card rather than leaving a hole.
  const always = [...liveMine, ...tierToday(0), ...tierToday(1)];
  const restOfToday = tierToday(2);
  const foldable = [...restOfToday, ...laterNext];
  const todayShown = Math.max(always.length, Math.min(always.length + restOfToday.length, FAV_TODAY_ROWS * perRow));
  const target = Math.max(todayShown, FAV_MIN_ROWS * perRow);
  const rowFill = (perRow - (target % perRow)) % perRow;
  const foldedTake = target - always.length + rowFill;
  const shownFolded = moreOpen ? foldable : foldable.slice(0, foldedTake);
  const favData = [...always, ...shownFolded];
  if (favData.length) {
    sections.push({ title: 'Favorites', featured: true, data: favData, hidden: foldable.length - shownFolded.length, folded: foldable.length > foldedTake });
  }

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
