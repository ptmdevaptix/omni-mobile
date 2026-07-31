import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { leagueOf } from '@/lib/api';
import { playerRouteId } from '@/lib/player';
import { fetchTeamRoster } from '@/lib/team';
import type { RosterPlayer } from '@/lib/team-types';
import { useTheme } from '@/lib/theme';

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
      renderItem={({ item }) => <PlayerRow p={item} routeId={isNhl ? playerRouteId(item.id) : playerRouteId(item.nhlId)} />}
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

function PlayerRow({ p, routeId }: { p: RosterPlayer; routeId: string | null }) {
  const t = useTheme();
  const abbr = posAbbr(p);
  const htwt = [p.height, p.weight ? `${p.weight} lb` : null].filter(Boolean).join(' · ');
  const body = (
    <>
      <Text style={[styles.num, { color: t.subtle }]}>{p.number != null ? p.number : '--'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
          {p.name}{abbr ? <Text style={{ color: t.sub, fontWeight: '400' }}> ({abbr})</Text> : null}
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
