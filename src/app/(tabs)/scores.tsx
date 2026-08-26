import { useQuery } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { GameDetailBody } from '@/components/game/game-detail';
import { GameCard } from '@/components/game-card';
import { LeaguePicker } from '@/components/league-picker';
import { StateView } from '@/components/state-view';
import { useCompact } from '@/lib/compact';
import { dayKey, dayLabel, daysBetween } from '@/lib/format';
import { centered, gameColumns, toRows, useLayout } from '@/lib/layout';
import { fetchGameDays, fetchScores, leagueColors, useLeague, type LeagueId } from '@/lib/leagues';
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

// A slate list plus a detail pane needs about this much room; below it, tapping a game pushes the
// full-screen detail the way it does on a phone.
const SPLIT_MIN = 900;

type Selection = { id: string; away: string; home: string };

// Per-league scores. The Home tab shows the cross-league aggregate.
export default function ScoresScreen() {
  const t = useTheme();
  const { league } = useLeague();
  const c = leagueColors(league, t.mode === 'dark');
  const layout = useLayout();
  // Content width, not window width — the horizontal pager's pages have to match the area left of
  // the rail or paging lands mid-slate.
  const width = layout.width;
  const today = dayKey();

  const daysQ = useQuery({
    queryKey: ['game-days', league],
    queryFn: () => fetchGameDays(league, offsetDay(-LOOKBACK_DAYS), offsetDay(LOOKAHEAD_DAYS)),
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

  // ── Split view (iPad): slate list on the left, the selected game's detail on the right ──────
  const split = layout.width >= SPLIT_MIN;
  const [selected, setSelected] = useState<Selection | null>(null);
  const onSelect = useCallback((g: ScoreGame) => setSelected({ id: g.id, away: g.awayTeamId, home: g.homeTeamId }), []);
  // Measured, not derived from the window: the tab rail eats a few hundred points.
  const [paneWidth, setPaneWidth] = useState(0);

  // A selection from another league or day would sit there stale — drop it when either changes.
  useEffect(() => { setSelected(null); }, [league, current]);

  // Same query key as the slate below, so this reads the cache rather than fetching again.
  const slateQ = useQuery({
    queryKey: ['scores', league, current ?? 'live'],
    queryFn: () => fetchScores(league, current),
    enabled: split && !daysQ.isPending,
  });

  // Land on the first game so the pane is never empty on arrival.
  const firstGame = slateQ.data?.games?.[0];
  useEffect(() => {
    if (split && !selected && firstGame) {
      setSelected({ id: firstGame.id, away: firstGame.awayTeamId, home: firstGame.homeTeamId });
    }
  }, [split, selected, firstGame]);

  const listWidth = Math.max(320, Math.min(420, paneWidth * 0.34));

  const slateHeader = dates && current ? (
    <SlateHeader
      label={dayLabel(current, today)}
      hint={gap > 1 ? `${gap - 1} day${gap - 1 === 1 ? '' : 's'} with no games skipped` : ''}
      canPrev={index > 0}
      canNext={index < dates.length - 1}
      onPrev={() => go(-1)}
      onNext={() => go(1)}
    />
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* In split view the league pills and the date pager belong over the list column they drive,
          not floating across both panes. */}
      {split ? null : <LeaguePicker />}
      {split ? null : slateHeader}

      {daysQ.isPending ? (
        // Wait for the slate list before rendering anything. Falling through to the single-day view
        // here flashes "No games" — that view asks the live feed, which is empty out of season — and
        // then replaces it with the real slate a moment later.
        <StateView kind="loading" />
      ) : split ? (
        // Two panes. No horizontal swipe pager here — the slate arrows page the list column, and
        // swiping a two-pane layout sideways would be nonsense.
        <View style={{ flex: 1, flexDirection: 'row' }} onLayout={(e) => setPaneWidth(e.nativeEvent.layout.width)}>
          <View style={{ width: listWidth }}>
            <LeaguePicker />
            {slateHeader}
            <SlatePage
              league={league}
              date={current}
              width={listWidth}
              columns={1}
              selectedId={selected?.id}
              onSelect={onSelect}
            />
          </View>
          <View style={{ flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: t.border }}>
            {selected ? (
              <GameDetailBody
                key={selected.id}
                gameId={selected.id}
                away={selected.away}
                home={selected.home}
                paneWidth={Math.max(0, paneWidth - listWidth)}
              />
            ) : (
              <StateView kind="empty" title="No game selected" message="Pick a game to see its detail here." />
            )}
          </View>
        </View>
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
  const layout = useLayout();
  return (
    // Cap the row on iPad: full-width arrows would sit a screen apart from the date they page.
    <View style={[styles.header, { borderBottomColor: t.border, maxWidth: layout.regular ? 460 : undefined, alignSelf: 'center', width: '100%' }]}>
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
function SlatePage({ league, date, width, columns, selectedId, onSelect }: {
  league: LeagueId;
  date?: string;
  width: number;
  /** Fixes the column count — the split view's list column is always single-file. */
  columns?: number;
  selectedId?: string;
  /** Stable across renders — it's handed straight to every card's `onOpen`. */
  onSelect?: (g: ScoreGame) => void;
}) {
  const t = useTheme();
  const { compact } = useCompact();
  const layout = useLayout();
  const per = columns ?? gameColumns(layout, compact);
  const c = leagueColors(league, t.mode === 'dark');
  const q = useQuery({
    queryKey: ['scores', league, date ?? 'live'],
    queryFn: () => fetchScores(league, date),
    refetchInterval: 30_000,
  });
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  const games = q.data?.games ?? [];
  const teams = q.data?.teamsById ?? {};
  const rows = useMemo(() => toRows(games, per), [games, per]);

  return (
    <View style={{ width, flex: 1 }}>
      {q.isLoading ? (
        <StateView kind="loading" />
      ) : q.isError ? (
        <StateView kind="error" message="Couldn’t load scores." onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          key={`${per}`}
          style={{ flex: 1 }}
          // The split view's list column is narrow — the iPad gutter would eat it.
          contentContainerStyle={{ ...centered(layout, columns === 1 ? { padding: 12 } : undefined), paddingVertical: 12, gap: 10 }}
          data={rows}
          keyExtractor={(row) => row[0].id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
          ListEmptyComponent={<StateView kind="empty" title="No games" message="Nothing scheduled for this league right now." />}
          renderItem={({ item }) => (
            <View style={per > 1 ? { flexDirection: 'row', gap: 10 } : undefined}>
              {item.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  teams={teams}
                  cardColor={c.card}
                  compact={compact}
                  fill={per > 1}
                  selected={g.id === selectedId}
                  onOpen={onSelect}
                />
              ))}
              {per > 1 && item.length < per
                ? Array.from({ length: per - item.length }, (_, i) => <View key={`pad${i}`} style={{ flex: 1 }} />)
                : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

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
