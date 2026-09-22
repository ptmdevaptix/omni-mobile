import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { leagueOf } from '@/lib/api';
import { countryFlag } from '@/lib/country-flags';
import { playerRouteId } from '@/lib/player';
import { fetchTeamRoster } from '@/lib/team';
import type { RosterPlayer } from '@/lib/team-types';
import { useTheme } from '@/lib/theme';
import { useFollowedMatcher } from '@/lib/use-follows';

export function TeamRoster({ teamId }: { teamId: string }) {
  const t = useTheme();
  const isNhl = leagueOf(teamId) === 'NHL';
  const q = useQuery({ queryKey: ['team-roster', teamId], queryFn: () => fetchTeamRoster(teamId) });

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError) return <StateView kind="error" message="Couldn’t load the roster." onRetry={() => q.refetch()} />;

  const d = q.data;
  const sections = [
    { title: 'Forwards', data: d?.forwards ?? [] },
    { title: 'Defensemen', data: d?.defensemen ?? [] },
    { title: 'Goalies', data: d?.goalies ?? [] },
  ].filter((s) => s.data.length);

  if (!sections.length) return <StateView kind="empty" title="No roster" message="Roster isn’t available yet." />;

  // A feed that gives a country and nothing else (the European leagues') would put a lone flag on
  // every hometown line; for those the flag moves up beside the name — it is the whole of what we
  // know — and the hometown line goes. Mirrors countryOnly() in the web's team-roster.
  const all = sections.flatMap((s) => s.data);
  const flagInName = all.every((p) => !p.birthplace) && all.some((p) => p.birthCountry);

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
      sections={sections}
      keyExtractor={(p, i) => `${p.id}-${i}`}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        d?.estimated ? (
          <Text style={{ color: t.subtle, fontSize: 12, marginBottom: 8 }}>
            {d.incomingOnly ? 'Projected — known additions only; returning roster unavailable.' : 'Projected roster (returners + known commits) until the official one is posted.'}
          </Text>
        ) : null
      }
      renderSectionHeader={({ section }) => (
        <Text style={[styles.section, { color: t.sub }]}>{section.title.toUpperCase()}</Text>
      )}
      // The stored slug links every league the API has seeded; the id forms are the fallback for a
      // row that has no players row yet. The box score reads the same way — the roster had been
      // left on NHL ids only, so a junior with a page went unlinked here and linked there.
      renderItem={({ item }) => <PlayerRow p={item} flagInName={flagInName} routeId={item.playerSlug ?? (isNhl ? playerRouteId(item.id) : playerRouteId(item.nhlId))} />}
    />
  );
}

// Abbreviated position for the name suffix: forwards RW/LW/C; defense RD/LD by handedness; goalies none.
function posAbbr(p: RosterPlayer): string | null {
  const pos = (p.position || '').toUpperCase();
  const hand = (p.shootsCatches || '').toUpperCase();
  if (pos.startsWith('G')) return null;
  if (pos === 'C') return 'C';
  if (pos === 'LW' || pos === 'L') return 'LW';
  if (pos === 'RW' || pos === 'R') return 'RW';
  if (pos === 'LD' || pos === 'RD') return pos;
  if (pos.startsWith('D')) return hand === 'R' ? 'RD' : hand === 'L' ? 'LD' : 'D';
  return pos || null;
}

function PlayerRow({ p, routeId, flagInName }: { p: RosterPlayer; routeId: string | null; flagInName: boolean }) {
  const t = useTheme();
  // One of the reader's own, starred the way the box score stars him. Not done on the prospects
  // tab, where every row would carry the mark and the mark would say nothing.
  const followed = useFollowedMatcher();
  const mine = !!followed({ name: p.name, playerId: p.id, playerSlug: p.playerSlug });
  const abbr = posAbbr(p);
  const flag = flagInName ? countryFlag(p.birthCountry) : undefined;
  const htwt = [p.height, p.weight ? `${p.weight} lb` : null].filter(Boolean).join(' · ');
  const body = (
    <>
      <Text style={[styles.num, { color: t.subtle }]}>{p.number != null ? p.number : '--'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: mine ? t.accent : t.text, fontSize: 15, fontWeight: mine ? '800' : '600' }} numberOfLines={1}>
          {mine ? '★ ' : ''}{p.name}{abbr ? <Text style={{ color: t.sub, fontWeight: '400' }}> ({abbr})</Text> : null}{flag ? <Text accessibilityLabel={p.birthCountry}> {flag}</Text> : null}
        </Text>
        {p.birthplace ? <Text style={{ color: t.sub, fontSize: 12 }} numberOfLines={1}>{p.birthplace}</Text> : null}
      </View>
      <Text style={{ color: t.sub, fontSize: 13, fontVariant: ['tabular-nums'] }}>{htwt}</Text>
    </>
  );
  if (!routeId) return <View style={[styles.row, { borderColor: t.border }]}>{body}</View>;
  return (
    <Link href={{ pathname: '/players/[playerId]', params: { playerId: routeId } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.row, { borderColor: t.border }])}>{body}</Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  num: { width: 30, fontSize: 15, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  meta: { alignItems: 'flex-end', minWidth: 64 },
});
