import { useQuery } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { GameCard } from '@/components/game-card';
import { SubHeading } from '@/components/sub-heading';
import { LeaguePicker } from '@/components/league-picker';
import { StateView } from '@/components/state-view';
import { useCompact } from '@/lib/compact';
import { useFavorites } from '@/lib/favorites';
import { dayKey, dayLabel, daysBetween } from '@/lib/format';
import { favMatchIds, isFavGame } from '@/lib/home';
import { fetchGameDays, fetchScores, groupNcaaByConference, hasLiveGame, leagueColors, leaguesIn, LIVE_MAX_AGE_MS, useLeague, type PickerId } from '@/lib/leagues';
import { useFollowedLeagues } from '@/lib/followed-leagues';
import { usePullRefresh } from '@/lib/pull-refresh';
import { useTheme } from '@/lib/theme';
import type { ScoreGame } from '@/lib/types';

// How far the slate list reaches. Backwards is deliberately short — deep history belongs in the
// schedules calendar, not in a swipe pager.
const LOOKBACK_DAYS = 14;
const LOOKAHEAD_DAYS = 150;

function offsetDay(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

// Group games into rows of `per` so a lone last card stays half-width (matching the Home grid)
// instead of stretching full-width like FlatList numColumns would.
function toRows(games: ScoreGame[], per: number): ScoreGame[][] {
  const rows: ScoreGame[][] = [];
  for (let i = 0; i < games.length; i += per) rows.push(games.slice(i, i + per));
  return rows;
}

// Per-league scores. The Home tab shows the cross-league aggregate.
export default function ScoresScreen() {
  const t = useTheme();
  const { league } = useLeague();
  const { followed } = useFollowedLeagues();
  const c = leagueColors(league, t.mode === 'dark');
  const { width } = useWindowDimensions();
  const today = dayKey();

  // Which leagues this tab is actually showing. A block narrowed by what the reader follows is a
  // different question than the block itself, so it has to be part of the cache key — and the slate
  // list and the games below have to be asked the SAME question, or the pager lands on days the
  // games are then filtered out of.
  const scope = leaguesIn(league, followed).join(',');

  const daysQ = useQuery({
    queryKey: ['game-days', league, scope],
    queryFn: () => fetchGameDays(league, offsetDay(-LOOKBACK_DAYS), offsetDay(LOOKAHEAD_DAYS), followed),
    staleTime: 6 * 3600_000,
  });

  // null = no slate list available (NCAA, or the endpoint failed) → single live-plus-pin view.
  const dates = daysQ.data?.length ? daysQ.data : null;

  // Land on today when it has games, otherwise the next slate; if the season is over, the last one.
  const initialIndex = useMemo(() => {
    if (!dates) return 0;
    const i = dates.findIndex((d) => d >= today);
    return i === -1 ? dates.length - 1 : i;
  }, [dates, today]);

  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);

  // Jump to the starting slate once the list arrives, and whenever the league changes.
  useEffect(() => {
    setIndex(initialIndex);
    if (dates && initialIndex > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: initialIndex, animated: false }));
    }
  }, [initialIndex, dates, league]);

  const go = (delta: number) => {
    if (!dates) return;
    const next = Math.min(Math.max(index + delta, 0), dates.length - 1);
    if (next === index) return;
    setIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  };

  const current = dates?.[index];
  // Only mention the gap when a swipe actually skipped days — an ordinary next-day move stays quiet.
  const gap = dates && index > 0 && current ? daysBetween(dates[index - 1], current) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LeaguePicker />

      {dates && current ? (
        <SlateHeader
          label={dayLabel(current, today)}
          hint={gap > 1 ? `${gap - 1} day${gap - 1 === 1 ? '' : 's'} with no games skipped` : ''}
          canPrev={index > 0}
          canNext={index < dates.length - 1}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
        />
      ) : null}

      {daysQ.isPending ? (
        // Wait for the slate list before rendering anything. Falling through to the single-day view
        // here flashes "No games" — that view asks the live feed, which is empty out of season — and
        // then replaces it with the real slate a moment later.
        <StateView kind="loading" />
      ) : dates ? (
        <FlatList
          ref={listRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={dates}
          keyExtractor={(d) => d}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          renderItem={({ item }) => <SlatePage league={league} date={item} width={width} />}
        />
      ) : (
        <SlatePage league={league} width={width} />
      )}
    </View>
  );
}

function SlateHeader({
  label, hint, canPrev, canNext, onPrev, onNext,
}: {
  label: string; hint: string; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: t.border }]}>
      <Pressable onPress={onPrev} disabled={!canPrev} hitSlop={12} style={styles.arrow}>
        <SymbolView name="chevron.left" tintColor={canPrev ? t.accent : t.subtle} size={16} />
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{label}</Text>
        {hint ? <Text style={{ color: t.subtle, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{hint}</Text> : null}
      </View>
      <Pressable onPress={onNext} disabled={!canNext} hitSlop={12} style={styles.arrow}>
        <SymbolView name="chevron.right" tintColor={canNext ? t.accent : t.subtle} size={16} />
      </Pressable>
    </View>
  );
}

// One day's slate. `date` omitted = whatever the feed treats as current (used only when a league has
// no slate list, i.e. the game-days call failed).
function SlatePage({ league, date, width }: { league: PickerId; date?: string; width: number }) {
  const t = useTheme();
  const { compact } = useCompact();
  const { followed } = useFollowedLeagues();
  const c = leagueColors(league, t.mode === 'dark');
  // Same scope as the slate list above — a block shows the member leagues the reader follows, so the
  // key has to say which, or switching what you follow serves the old set from cache.
  const scope = leaguesIn(league, followed).join(',');
  const q = useQuery({
    queryKey: ['scores', league, scope, date ?? 'live'],
    queryFn: () => fetchScores(league, date, followed),
    refetchInterval: (query) => (hasLiveGame(query.state.data?.games) ? 10_000 : 30_000),
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  // Same reasoning as Home (src/app/(tabs)/index.tsx): swiping away or opening a game unmounts this
  // list and stops the interval, and React Query hands the payload straight back on return. A finished
  // slate is fine from cache; a game in progress would re-render the clock it had when you left.
  const stale = Date.now() - q.dataUpdatedAt > LIVE_MAX_AGE_MS && hasLiveGame(q.data?.games);
  const data = stale ? undefined : q.data;

  // Favorites lead their league's slate and wear the metallic frame — the one place a favorite sits
  // among its peers, so the marker earns its keep here (Home's Favorites section is its own header).
  const { favorites } = useFavorites();
  const favIds = useMemo(() => favMatchIds(favorites), [favorites]);
  const games = useMemo(() => {
    const all = data?.games ?? [];
    if (!favIds.size) return all;
    return [...all].sort((a, b) => Number(isFavGame(b, favIds)) - Number(isFavGame(a, favIds))); // stable
  }, [data, favIds]);
  const teams = data?.teamsById ?? {};
  // The NCAA slate carries a conference sub-heading before each run (Non-Conference last); every other
  // league is one flat run. Favorites still lead within their run.
  const rows = useMemo<Row[]>(() => {
    const per = compact ? 2 : 1;
    if (league !== 'ncaa' || !games.some((g) => g.conference)) return toRows(games, per);
    return groupNcaaByConference(games).flatMap(([heading, grp]) => [{ heading }, ...toRows(grp, per)]);
  }, [games, compact, league]);

  return (
    <View style={{ width, flex: 1 }}>
      {/* `stale` as well as isLoading — isLoading is false whenever a cached payload exists, so a
          suppressed one would otherwise fall through to the "No games" empty state. */}
      {q.isLoading || stale ? (
        <StateView kind="loading" />
      ) : q.isError ? (
        <StateView kind="error" message="Couldn’t load scores." onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          key={compact ? 'grid' : 'list'}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          data={rows}
          keyExtractor={(row) => (isHeading(row) ? `h:${row.heading}` : row[0].id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
          ListEmptyComponent={<StateView kind="empty" title="No games" message="Nothing scheduled for this league right now." />}
          renderItem={({ item }) =>
            isHeading(item) ? (
              <SubHeading title={item.heading} />
            ) : (
              <View style={compact ? { flexDirection: 'row', gap: 10 } : undefined}>
                {item.map((g) => <GameCard key={g.id} game={g} teams={teams} cardColor={c.card} compact={compact} featured={isFavGame(g, favIds)} />)}
                {compact && item.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            )
          }
        />
      )}
    </View>
  );
}

type Row = ScoreGame[] | { heading: string };
const isHeading = (r: Row): r is { heading: string } => !Array.isArray(r);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  arrow: { paddingHorizontal: 10, paddingVertical: 4 },
});
