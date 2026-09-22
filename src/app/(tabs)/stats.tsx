import { useQueries } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LeaguePicker } from '@/components/league-picker';
import { SeasonSelect } from '@/components/season-select';
import { GoaliesTable, SkatersTable } from '@/components/stats-table';
import { StateView } from '@/components/state-view';
import { useFollowedLeagues } from '@/lib/followed-leagues';
import { blockOf, compareNcaaConferences, isBlock, leagueById, leagueColors, leaguesIn, useLeague, type LeagueId, type PickerId } from '@/lib/leagues';
import { seasonRateFloor } from '@/lib/stat-qualifiers';
import { combineBoards, combinedSeasons, fetchLeagueStats, hasStats, MIN_GP, seasonParam, type LeagueStats } from '@/lib/stats';
import type { StandingsSeason } from '@/lib/standings-cards';
import { useTheme } from '@/lib/theme';

// Leaders — the web's stats pages on one screen. A league is one board; the CHL and Canadian Jr A
// blocks are a combined board of the members the reader follows (their own leagues stay a tap away
// on the member row), with the columns every league in the set can fill and a rate floor per league.
// The Euro block resolves to a member like Standings does: the web has no combined European board.

const listSentence = (items: string[]) => items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export default function StatsScreen() {
  const t = useTheme();
  const { league, setLeague } = useLeague();
  const { followed } = useFollowedLeagues();

  // A block is a combined board of its visible members — except Europe, which has none on the web
  // and resolves to one member here as it does on Standings.
  const members = isBlock(league) ? leaguesIn(league, followed) : [];
  const [member, setMember] = useState<LeagueId | null>(null);
  const euro = league === 'EURO';
  const combined = isBlock(league) && !euro && !member && members.length > 1;
  const shown: LeagueId = isBlock(league)
    ? (member && members.includes(member) ? member : members[0])
    : (league as LeagueId);
  const boards: LeagueId[] = combined ? members : [shown];

  const pick = (id: PickerId) => {
    // A member of the block already showing narrows the board; the block itself widens it back.
    if (!isBlock(id) && blockOf(id)?.key === league) { setMember(id as LeagueId); return; }
    if (id === league) { setMember(null); return; }
    setMember(null);
    setLeague(id);
  };

  const key = boards.join(',');
  const c = leagueColors(combined ? league : shown, t.mode === 'dark');
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LeaguePicker value={combined ? league : (isBlock(league) ? shown : league)} onChange={pick} />
      <Boards key={key} leagues={boards} combined={combined} pill={c.pill} />
    </View>
  );
}

function Boards({ leagues, combined, pill }: { leagues: LeagueId[]; combined: boolean; pill: string }) {
  const t = useTheme();
  const [tab, setTab] = useState<'skaters' | 'goalies'>('skaters');
  // Null is the route's own choice: this season once it has a game, last season until then. Held
  // as the season the switch chose, sent to each league in the form its route takes.
  const [season, setSeason] = useState<StandingsSeason | null>(null);
  const [conf, setConf] = useState<string>('all');

  const supported = leagues.filter(hasStats);
  const qs = useQueries({
    queries: supported.map((id) => ({
      queryKey: ['stats', id, season?.name ?? null],
      queryFn: () => fetchLeagueStats(id, season ? seasonParam(id, season) : null),
      staleTime: 15 * 60_000,
    })),
  });
  // One league failing must not empty the others — the combined view is still worth showing.
  const loaded = qs.map((q) => q.data).filter((d): d is LeagueStats => !!d);
  const loading = qs.some((q) => q.isLoading) && loaded.length === 0;
  const allFailed = qs.length > 0 && qs.every((q) => q.isError);
  const refetchAll = () => Promise.all(qs.map((q) => q.refetch()));
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => { setRefreshing(true); try { await refetchAll(); } finally { setRefreshing(false); } };

  // The board on screen: one league's, or the started members combined (lib/stats combinedSeasons).
  const { board, partial, allPrior, startedNames } = useMemo(() => {
    if (!combined) return { board: loaded[0], partial: false, allPrior: !!loaded[0]?.meta.isPriorSeason, startedNames: [] as string[] };
    const { boards, partial, allPrior } = combinedSeasons(loaded);
    return { board: combineBoards(boards), partial, allPrior, startedNames: boards.map((b) => leagueById(b.meta.league as LeagueId)?.label ?? b.meta.league.toUpperCase()) };
  }, [loaded, combined]);

  // The seasons on offer, by name, across the leagues on screen; the switch highlights what is shown.
  const seasons = useMemo<StandingsSeason[]>(() => {
    const byName = new Map<string, StandingsSeason>();
    for (const b of loaded) for (const s of b.meta.seasons) if (!byName.has(s.name)) byName.set(s.name, { id: s.name, name: s.name });
    return [...byName.values()].sort((a, b) => b.name.localeCompare(a.name));
  }, [loaded]);
  const shownSeason = season?.name ?? loaded.find((b) => b.meta.season)?.meta.season ?? null;
  const priorSeason = !season && allPrior ? loaded.find((b) => b.meta.isPriorSeason)?.meta.season ?? '' : '';

  // NCAA: one conference, or the whole division. The floor is measured on the whole league either
  // way — a small conference's board would otherwise set its own, lower bar.
  const ncaa = leagues.length === 1 && leagues[0] === 'ncaa';
  const conferences = useMemo(() => ncaa && board ? [...new Set(board.skaters.map((s) => s.conference ?? ''))].filter(Boolean).sort(compareNcaaConferences) : [], [ncaa, board]);
  const skaters = useMemo(() => (board && ncaa && conf !== 'all' ? board.skaters.filter((s) => s.conference === conf) : board?.skaters ?? []), [board, ncaa, conf]);
  const goalies = useMemo(() => (board && ncaa && conf !== 'all' ? board.goalies.filter((g) => g.conference === conf) : board?.goalies ?? []), [board, ncaa, conf]);

  // Rate columns qualify on a share of the season played — measured on SKATERS even for the goalie
  // table (a starter plays two thirds of his team's games); per league on a combined board.
  const floorKey = leagues.length === 1 ? leagues[0] : 'default';
  const skaterGames = useMemo(() => (board?.skaters ?? []).map((s) => ({ gp: s.gp, league: s.league })), [board]);
  const skaterFloor = useMemo(() => seasonRateFloor(skaterGames, MIN_GP.skater[floorKey] ?? MIN_GP.skater.default, combined), [skaterGames, floorKey, combined]);
  const goalieFloor = useMemo(() => seasonRateFloor(skaterGames, MIN_GP.goalie[floorKey] ?? MIN_GP.goalie.default, combined), [skaterGames, floorKey, combined]);

  if (supported.length === 0) {
    // The ECHL publishes no stats feed: say so rather than show an empty table.
    return <StateView kind="empty" title="No leader boards" message={`${leagueById(leagues[0]).label} does not publish a stats feed we can read.`} />;
  }
  if (loading) return <StateView kind="loading" />;
  if (allFailed || !board) return <StateView kind="error" message="Couldn’t load the leaders." onRetry={refetchAll} />;

  const onText = t.mode === 'dark' ? '#0b0b0b' : '#ffffff';
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 28, gap: 10 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}>
      <View style={styles.toolbar}>
        <View style={[styles.segment, { backgroundColor: t.card, borderColor: t.border }]}>
          {(['skaters', 'goalies'] as const).map((v) => {
            const on = v === tab;
            return (
              <Text key={v} onPress={() => setTab(v)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={[styles.segItem, on && { backgroundColor: pill }, { color: on ? onText : t.sub, fontWeight: on ? '700' : '600' }]}>
                {v === 'skaters' ? 'Skaters' : 'Goalies'}
              </Text>
            );
          })}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <SeasonSelect seasons={seasons} value={shownSeason} onChange={(id) => setSeason(seasons.find((s) => s.id === id) ?? { id, name: id })} />
        </View>
      </View>
      {ncaa && conferences.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.confRow}>
          {['all', ...conferences].map((k) => {
            const on = k === conf;
            return (
              <Pressable key={k} onPress={() => setConf(k)} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={[styles.confPill, on ? { backgroundColor: pill, borderColor: pill } : { backgroundColor: t.card, borderColor: t.border }]}>
                <Text style={{ color: on ? onText : t.sub, fontSize: 12, fontWeight: on ? '800' : '600' }}>{k === 'all' ? 'All NCAA' : k}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {priorSeason ? <Text style={styles.note(t.subtle)}>Showing final {priorSeason} leaders — the new season hasn’t started yet.</Text> : null}
      {partial ? <Text style={styles.note(t.subtle)}>{listSentence(startedNames)} so far — the rest join as their seasons begin.</Text> : null}
      {tab === 'skaters'
        ? <SkatersTable rows={skaters} meta={board.meta} showLeague={combined} floor={skaterFloor} />
        : <GoaliesTable rows={goalies} meta={board.meta} showLeague={combined} floor={goalieFloor} />}
    </ScrollView>
  );
}

const styles = {
  ...StyleSheet.create({
    toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    segment: { flexDirection: 'row', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 2, gap: 2, flex: 1, maxWidth: 220 },
    segItem: { flex: 1, textAlign: 'center', paddingVertical: 7, borderRadius: 8, fontSize: 13, overflow: 'hidden' },
    confRow: { gap: 8, paddingVertical: 2 },
    confPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  }),
  note: (color: string) => ({ color, fontSize: 11, lineHeight: 15 }),
};
