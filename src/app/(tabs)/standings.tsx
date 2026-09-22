import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { LeaguePicker } from '@/components/league-picker';
import { SeasonSelect } from '@/components/season-select';
import { StandingsCard } from '@/components/standings-card';
import { StateView } from '@/components/state-view';
import { useFollowedLeagues } from '@/lib/followed-leagues';
import { blockOf, fetchAllTeams, isBlock, leagueColors, leaguesIn, useLeague, type LeagueId, type PickerId } from '@/lib/leagues';
import { usePullRefresh } from '@/lib/pull-refresh';
import { buildStandingsGroups, fetchStandingsPayload, standingsNote, standingsViews, VIEW_LABEL, type Grouping } from '@/lib/standings-data';
import { useTheme } from '@/lib/theme';

// Standings as cards, every league on the one component (components/standings-card) fed by the
// per-league adapters (lib/standings-data) — the web's standings page, at its phone width.

const ALL_STATS_KEY = 'standingsAllStats';

export default function StandingsScreen() {
  const t = useTheme();
  const { league, setLeague } = useLeague();
  const { followed } = useFollowedLeagues();

  /**
   * A block has no standings of its own — there is no all-CHL table — so it resolves to one of its
   * member leagues, and that choice lives HERE rather than in the shared selection. Switching back to
   * Scores still shows the whole block, which is the point of having a block at all.
   */
  const members = isBlock(league) ? leaguesIn(league, followed) : [];
  const [member, setMember] = useState<LeagueId | null>(null);
  const shown: LeagueId = members.length
    ? (members.includes(member as LeagueId) ? (member as LeagueId) : members[0])
    : (league as LeagueId);

  const pick = (id: PickerId) => {
    if (!isBlock(id) && blockOf(id)?.key === league) { setMember(id as LeagueId); return; }
    if (id === league) return;
    setMember(null);
    setLeague(id);
  };

  const c = leagueColors(shown, t.mode === 'dark');
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LeaguePicker value={members.length ? shown : league} onChange={pick} />
      {/* Keyed on the league so the view, sort and season all open fresh for each one. */}
      <LeagueStandings key={shown} league={shown} pill={c.pill} />
    </View>
  );
}

// Remembered per device: the switch used to reset on every remount — a league tab, a season
// switch — so the full columns seemed to vanish on their own. Read once, written on change.
function useAllStats(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => { AsyncStorage.getItem(ALL_STATS_KEY).then((v) => { if (v === '1') setOn(true); }).catch(() => {}); }, []);
  const set = (v: boolean) => { setOn(v); AsyncStorage.setItem(ALL_STATS_KEY, v ? '1' : '0').catch(() => {}); };
  return [on, set];
}

function LeagueStandings({ league, pill }: { league: LeagueId; pill: string }) {
  const t = useTheme();
  const spec = standingsViews(league);
  const [view, setView] = useState<Grouping>(spec.defaultView);
  // Null = the route's default (the current season); the switch sets an id from `seasons`.
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [allStats, setAllStats] = useAllStats();

  const q = useQuery({
    queryKey: ['standings', league, seasonId],
    queryFn: () => fetchStandingsPayload(league, seasonId),
    refetchInterval: 60_000,
  });
  // The standings feeds carry one joined name per club; the place a non-NHL row is named by comes
  // from the team directory, joined on the page id (lib/team-name rule).
  const dir = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });
  const placeById = useMemo(() => new Map((dir.data ?? []).map((tm) => [tm.id, tm.location])), [dir.data]);
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  const groups = useMemo(
    () => (q.data ? buildStandingsGroups(league, q.data, view, { rail: pill, placeById }) : []),
    [q.data, league, view, pill, placeById],
  );
  const note = standingsNote(league);
  const hasStats = groups.some((g) => g.statColumns?.length);

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError) return <StateView kind="error" message="Couldn’t load standings." onRetry={() => q.refetch()} />;
  if (!groups.length) return <StateView kind="empty" title="No standings" message="Not available for this league yet." />;

  const onText = t.mode === 'dark' ? '#0b0b0b' : '#ffffff';
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 12, paddingBottom: 28, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
    >
      {/* The toolbar: the view tabs (where a league has more than one), the season switch, and one
          "All stats" switch for every card. */}
      <View style={styles.toolbar}>
        {spec.views.length > 1 ? (
          <View style={[styles.segment, { backgroundColor: t.card, borderColor: t.border }]}>
            {spec.views.map((v) => {
              const on = v === view;
              return (
                <Text key={v} onPress={() => setView(v)} style={[styles.segItem, on && { backgroundColor: pill }, { color: on ? onText : t.sub, fontWeight: on ? '700' : '600' }]}
                  accessibilityRole="tab" accessibilityState={{ selected: on }}>
                  {VIEW_LABEL[v]}
                </Text>
              );
            })}
          </View>
        ) : null}
        <View style={styles.toolbarRight}>
          <SeasonSelect seasons={q.data?.seasons ?? []} value={q.data?.seasonId ?? null} onChange={setSeasonId} />
          {hasStats ? (
            <View style={styles.switchWrap}>
              <Text style={{ color: t.sub, fontSize: 12 }}>All stats</Text>
              <Switch value={allStats} onValueChange={setAllStats} trackColor={{ true: t.accent }} style={styles.switch} accessibilityLabel="All stats" />
            </View>
          ) : null}
        </View>
      </View>
      {groups.map((g) => <StandingsCard key={g.key} group={g} allStats={allStats} />)}
      {note ? <Text style={{ color: t.subtle, fontSize: 10.5, lineHeight: 14, paddingHorizontal: 2 }}>{note}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  toolbar: { gap: 8 },
  segment: { flexDirection: 'row', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 2, gap: 2 },
  segItem: { flex: 1, textAlign: 'center', paddingVertical: 7, borderRadius: 8, fontSize: 13, overflow: 'hidden' },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14, minHeight: 24 },
  switchWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switch: { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] },
});
