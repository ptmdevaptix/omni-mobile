import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { SegmentedFilter } from '@/components/segmented-filter';
import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { leagueOf } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { detectRegion } from '@/lib/region';
import { fetchTeamSchedule } from '@/lib/team';
import type { ScheduleGame } from '@/lib/team-types';
import { formatGameTime } from '@/lib/game-time';
import { useTheme } from '@/lib/theme';
import { useTimeZoneMode } from '@/lib/time-zone-mode';

/** Which country's networks to show. A Canadian and an American reader want different lines. */
type Country = 'CA' | 'US';

/**
 * Where a network reaches, which is the thing that decides whether a reader can watch it: a national
 * feed is everywhere, an in-market one is the club's own regional channel, and an out-of-market one
 * is the pay package. Tinted rather than labelled — a phone row has no space for a legend, and the
 * colours repeat down the column until they are learned.
 */
const SCOPE_TINT: Record<string, [string, string]> = {
  national: ['#2a4a9c', '#6a97ff'],
  'in-market': ['#14603a', '#2f9e5a'],
  'out-of-market': ['#9a6a12', '#e6ab3e'],
};

export function TeamSchedule({ teamId }: { teamId: string }) {
  const t = useTheme();
  const router = useRouter();
  const q = useQuery({ queryKey: ['team-schedule', teamId], queryFn: () => fetchTeamSchedule(teamId) });
  // The reader's own country first, and a switch when the games carry both — a Toronto schedule
  // lists Sportsnet and TSN for Canada and the national US feed beside it.
  const [country, setCountry] = useState<Country>(detectRegion() === 'US' ? 'US' : 'CA');
  const games = q.data;
  const hasBothCountries = useMemo(() => (games ?? []).some((g) => (g.altBroadcasts?.length ?? 0) > 0), [games]);
  // The ECHL's schedule is seeded from the clubs' calendars and carries no league game id, so its
  // rows have nowhere to go — the same call the score cards make.
  const hasDetail = leagueOf(teamId) !== 'ECHL';

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError) return <StateView kind="error" message="Couldn’t load the schedule." onRetry={() => q.refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {hasBothCountries ? (
        <View style={{ paddingTop: 10 }}>
          <SegmentedFilter options={['CA', 'US']} value={country} onChange={(v) => setCountry(v as Country)} pill={t.accent} capitalize={false} />
        </View>
      ) : null}
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        data={games ?? []}
        keyExtractor={(g, i) => `${g.id}-${i}`}
        ListEmptyComponent={<StateView kind="empty" title="No schedule" message="Not available yet." />}
        renderItem={({ item }) => (
          <GameRow
            g={item}
            country={country}
            onPress={hasDetail && item.id ? () => router.push({ pathname: '/games/[gameId]', params: { gameId: gameRouteId(teamId, item.id) } }) : undefined}
          />
        )}
      />
    </View>
  );
}

/** The `/games/{prefix}-{id}` id for a club's own league — the same prefixes the scoreboards use. */
function gameRouteId(teamId: string, gameId: number): string {
  const league = leagueOf(teamId).toLowerCase();
  if (league === 'nhl') return `nhl-${gameId}`;
  if (league === 'chl' || league === 'cjra') {
    // The member league, which the page id carries: "chl-lhjmq-2" → qmjhl, "cjra-ojhl-21" → ojhl.
    const member = teamId.split('-')[1] ?? '';
    return `${member === 'lhjmq' ? 'qmjhl' : member}-${gameId}`;
  }
  return `${league}-${gameId}`;
}

/** The networks for one country, in the order the feed lists them. */
function networksFor(g: ScheduleGame, country: Country): { network: string; scope?: string }[] {
  if (g.broadcastDetail?.length) return g.broadcastDetail.filter((b) => !b.country || b.country === country);
  // Older payloads carry only the two lists and which country the first belongs to.
  const own = g.broadcastCountry ?? 'US';
  const list = country === own ? g.broadcasts : g.altBroadcasts;
  return (list ?? []).map((network) => ({ network }));
}

function GameRow({ g, country, onPress }: { g: ScheduleGame; country: Country; onPress?: () => void }) {
  const t = useTheme();
  const { mode } = useTimeZoneMode();
  const dark = t.mode === 'dark';
  const resultColor = g.result === 'W' ? '#22c55e' : g.result === 'L' ? '#ef4444' : t.sub;
  const nets = g.state === 'FINAL' ? [] : networksFor(g, country);
  const body = (
    <>
      <View style={styles.line}>
        <Text style={[styles.date, { color: t.sub }]}>{shortDate(g.date)}</Text>
        <Text style={[styles.at, { color: t.subtle }]}>{g.isHome ? 'vs' : '@'}</Text>
        <TeamLogo uri={g.opponentLogo} darkUri={g.opponentDarkLogo} size={22} />
        <Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{g.opponentAbbr}</Text>
        {g.postseason ? <Text style={{ color: t.subtle, fontSize: 10, marginRight: 6 }} numberOfLines={1}>{g.postseason}</Text> : null}
        {g.preseason ? <Text style={{ color: t.subtle, fontSize: 10, fontWeight: '800', marginRight: 6 }}>PRE</Text> : null}
        {g.state === 'FINAL' ? (
          <View style={styles.result}>
            <Text style={{ color: resultColor, fontSize: 14, fontWeight: '800' }}>{g.result ?? ''}</Text>
            <Text style={{ color: t.text, fontSize: 14, fontVariant: ['tabular-nums'] }}>
              {g.teamScore ?? 0}-{g.opponentScore ?? 0}{g.overtime ? ` ${g.overtime}` : ''}
            </Text>
          </View>
        ) : g.state === 'POSTPONED' ? (
          <Text style={{ color: t.subtle, fontSize: 12 }}>PPD</Text>
        ) : (
          <Text style={{ color: t.sub, fontSize: 13 }}>{g.startTimeUTC ? formatGameTime(g.startTimeUTC, { mode, venueTimeZone: g.venueTimeZone }) || '—' : '—'}</Text>
        )}
      </View>
      {nets.length ? (
        <View style={styles.tvRow}>
          {nets.map((b, i) => {
            const tint = SCOPE_TINT[b.scope ?? ''] ?? [t.sub, t.sub];
            return (
              <Text key={`${b.network}-${i}`} style={[styles.chip, { color: tint[dark ? 1 : 0], borderColor: `${tint[dark ? 1 : 0]}66` }]} numberOfLines={1}>
                {b.network}
              </Text>
            );
          })}
        </View>
      ) : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, { borderColor: t.border }]}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.row, { borderColor: t.border }]}>{body}</Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, gap: 5 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { width: 52, fontSize: 13, fontWeight: '600' },
  at: { width: 20, fontSize: 12, textAlign: 'center' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tvRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingLeft: 72 },
  chip: { fontSize: 10, fontWeight: '700', borderWidth: StyleSheet.hairlineWidth, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
});
