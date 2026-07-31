import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { shortDate, timeOfDay } from '@/lib/format';
import { fetchTeamSchedule } from '@/lib/team';
import type { ScheduleGame } from '@/lib/team-types';
import { useTheme } from '@/lib/theme';

export function TeamSchedule({ teamId }: { teamId: string }) {
  const t = useTheme();
  const q = useQuery({ queryKey: ['team-schedule', teamId], queryFn: () => fetchTeamSchedule(teamId) });

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError) return <StateView kind="error" message="Couldn’t load the schedule." onRetry={() => q.refetch()} />;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
      data={q.data ?? []}
      keyExtractor={(g, i) => `${g.id}-${i}`}
      ListEmptyComponent={<StateView kind="empty" title="No schedule" message="Not available yet." />}
      renderItem={({ item }) => <GameRow g={item} />}
    />
  );
}

function GameRow({ g }: { g: ScheduleGame }) {
  const t = useTheme();
  const resultColor = g.result === 'W' ? '#22c55e' : g.result === 'L' ? '#ef4444' : t.sub;
  return (
    <View style={[styles.row, { borderColor: t.border }]}>
      <Text style={[styles.date, { color: t.sub }]}>{shortDate(g.date)}</Text>
      <Text style={[styles.at, { color: t.subtle }]}>{g.isHome ? 'vs' : '@'}</Text>
      <TeamLogo uri={g.opponentLogo} size={22} />
      <Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{g.opponentAbbr}</Text>
      {g.postseason ? <Text style={{ color: t.subtle, fontSize: 10, marginRight: 6 }} numberOfLines={1}>{g.postseason}</Text> : null}
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
        <Text style={{ color: t.sub, fontSize: 13 }}>{timeOfDay(g.startTimeUTC) || '—'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  date: { width: 52, fontSize: 13, fontWeight: '600' },
  at: { width: 20, fontSize: 12, textAlign: 'center' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
