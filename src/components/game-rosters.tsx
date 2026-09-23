import { useQueries } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NhlCrest } from '@/components/nhl-crest';
import { SegmentedFilter } from '@/components/segmented-filter';
import { gameTeamPageIds } from '@/lib/follows';
import type { GameDetail } from '@/lib/game-detail-types';
import { playerRouteId } from '@/lib/player';
import { fetchTeamRoster } from '@/lib/team';
import type { RosterPlayer, RosterResponse } from '@/lib/team-types';
import { useTheme } from '@/lib/theme';
import { useFollowedMatcher } from '@/lib/use-follows';
import { useState } from 'react';

/**
 * Who is on each club before a game is played. Not a lineup — no feed posts one this far out — but
 * the roster each side will pick from, which is what a reader wants when there is nothing else yet.
 *
 * A phone cannot hold two rosters side by side the way the web does, so the sides take turns behind
 * a switch, exactly as the box score's do after the game.
 *
 * A club whose roster the API cannot answer is simply absent; a projected one says so, because in
 * September half these rosters are guesses.
 */
export function GameRosters({ g }: { g: GameDetail }) {
  const t = useTheme();
  const [side, setSide] = useState<'away' | 'home'>('away');
  const followed = useFollowedMatcher();

  // The page id is the first form the game's team can appear under — the same resolution the follows
  // code uses, so a club that has a team page here has one there.
  const ids = { away: gameTeamPageIds(g, 'away')[0], home: gameTeamPageIds(g, 'home')[0] };
  const results = useQueries({
    queries: (['away', 'home'] as const).map((s) => ({
      queryKey: ['game-roster', ids[s]],
      queryFn: () => fetchTeamRoster(ids[s]!),
      enabled: !!ids[s],
      staleTime: 30 * 60_000,
    })),
  });
  const data: Record<'away' | 'home', RosterResponse | undefined> = { away: results[0].data, home: results[1].data };
  const count = (r?: RosterResponse) => (r?.forwards?.length ?? 0) + (r?.defensemen?.length ?? 0) + (r?.goalies?.length ?? 0);
  if (!count(data.away) && !count(data.home)) return null;

  const team = side === 'away' ? g.awayTeam : g.homeTeam;
  const roster = data[side];
  // Sorted by sweater number, as the web does: before a game there is no ice time to rank anyone by.
  const players = [...(roster?.forwards ?? []), ...(roster?.defensemen ?? []), ...(roster?.goalies ?? [])]
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999));

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={[styles.section, { color: t.sub, marginBottom: 0 }]}>ROSTERS</Text>
        {roster?.estimated ? (
          <Text style={{ color: t.subtle, fontSize: 10, fontWeight: '700' }}>PROJECTED</Text>
        ) : null}
      </View>
      <SegmentedFilter
        options={[g.awayTeam.abbr, g.homeTeam.abbr]}
        value={team.abbr}
        onChange={(v) => setSide(v === g.awayTeam.abbr ? 'away' : 'home')}
        pill={t.accent}
        flush
        capitalize={false}
      />
      {players.length === 0 ? (
        <Text style={{ color: t.subtle, fontSize: 12, paddingTop: 6 }}>Roster isn’t available yet.</Text>
      ) : (
        players.map((p, i) => <Row key={`${p.id}-${i}`} p={p} mine={!!followed({ name: p.name, playerId: p.id, playerSlug: p.playerSlug })} />)
      )}
    </View>
  );
}

function Row({ p, mine }: { p: RosterPlayer; mine: boolean }) {
  const t = useTheme();
  const routeId = p.playerSlug ?? playerRouteId(p.nhlId);
  const body = (
    <>
      <Text style={{ width: 26, color: t.subtle, fontSize: 12, textAlign: 'right' }}>{p.number ?? ''}</Text>
      <Text style={{ flex: 1, color: mine ? t.accent : t.text, fontSize: 14, fontWeight: mine ? '800' : '600' }} numberOfLines={1}>
        {p.name}
      </Text>
      {p.nhlRights ? <NhlCrest abbr={p.nhlRights} size={14} /> : null}
      <Text style={{ width: 30, color: t.sub, fontSize: 12, textAlign: 'right' }}>{p.position}</Text>
    </>
  );
  const row = [styles.row, { borderColor: t.border }, mine ? { backgroundColor: `${t.accent}14` } : null];
  if (!routeId) return <View style={row}>{body}</View>;
  return (
    <Link href={{ pathname: '/players/[playerId]', params: { playerId: routeId } }} asChild>
      <Pressable style={StyleSheet.flatten(row)}>{body}</Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, marginBottom: 10 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
});
