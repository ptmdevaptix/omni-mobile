import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { leagueOf } from '@/lib/api';
import { pct3 } from '@/lib/format';
import { playerRouteId } from '@/lib/player';
import { fetchTeamStats } from '@/lib/team';
import type { TeamGoalieStat, TeamSkaterStat, TeamSummary } from '@/lib/team-types';
import { useTheme } from '@/lib/theme';

export function TeamStats({ teamId }: { teamId: string }) {
  const t = useTheme();
  const isNhl = leagueOf(teamId) === 'NHL';
  const [view, setView] = useState<'skaters' | 'goalies'>('skaters');
  const q = useQuery({ queryKey: ['team-stats', teamId], queryFn: () => fetchTeamStats(teamId) });

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError) return <StateView kind="error" message="Couldn’t load stats." onRetry={() => q.refetch()} />;

  const d = q.data;
  const hasAny = (d?.skaters?.length ?? 0) + (d?.goalies?.length ?? 0) > 0;
  if (!hasAny && !d?.summary) return <StateView kind="empty" title="No stats" message="Not available yet." />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
      {d?.summary ? <SummaryCard s={d.summary} /> : null}

      <View style={[styles.seg, { backgroundColor: t.card, borderColor: t.border }]}>
        {(['skaters', 'goalies'] as const).map((v) => {
          const on = v === view;
          return (
            <Pressable key={v} onPress={() => setView(v)} style={[styles.segItem, on && { backgroundColor: t.accent }]}>
              <Text style={{ color: on ? t.onAccent : t.sub, fontWeight: on ? '700' : '600', textTransform: 'capitalize' }}>{v}</Text>
            </Pressable>
          );
        })}
      </View>

      {view === 'skaters' ? <SkaterTable rows={d?.skaters ?? []} isNhl={isNhl} /> : <GoalieTable rows={d?.goalies ?? []} isNhl={isNhl} />}
    </ScrollView>
  );
}

function SummaryCard({ s }: { s: TeamSummary }) {
  const t = useTheme();
  const item = (label: string, val: string, rank?: number) => (
    <View style={styles.sumItem}>
      <Text style={{ color: t.sub, fontSize: 11, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{val}</Text>
      {rank ? <Text style={{ color: t.subtle, fontSize: 10 }}>#{rank}</Text> : null}
    </View>
  );
  return (
    <View style={[styles.sumCard, { backgroundColor: t.card, borderColor: t.border }]}>
      {item('PP%', `${s.ppPct?.toFixed(1)}%`, s.ppRank)}
      {item('PK%', `${s.pkPct?.toFixed(1)}%`, s.pkRank)}
      {item('SOG/G', s.sogPerGame?.toFixed(1), s.sogPerGameRank)}
      {item('SOGA/G', s.sogaPerGame?.toFixed(1), s.sogaPerGameRank)}
    </View>
  );
}

function StatRow({ routeId, children }: { routeId: string | null; children: ReactNode }) {
  const t = useTheme();
  if (!routeId) return <View style={[styles.drow, { borderColor: t.border }]}>{children}</View>;
  return (
    <Link href={{ pathname: '/players/[playerId]', params: { playerId: routeId } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.drow, { borderColor: t.border }])}>{children}</Pressable>
    </Link>
  );
}

// Full name when it fits the column, else "F. Last" (e.g. "M. Hogberg").
function fitName(name: string, max: number): string {
  if (name.length <= max) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

function SkaterTable({ rows, isNhl }: { rows: TeamSkaterStat[]; isNhl: boolean }) {
  const t = useTheme();
  if (!rows.length) return <Text style={{ color: t.subtle, padding: 16, textAlign: 'center' }}>No skater stats.</Text>;
  const sorted = [...rows].sort((a, b) => b.points - a.points || b.goals - a.goals);
  return (
    <View>
      <View style={[styles.hrow, { borderColor: t.border }]}>
        <Text style={[styles.hname, { color: t.sub }]}>Skater</Text>
        {['GP', 'G', 'A', 'PTS', '+/-', 'PIM'].map((h) => <Text key={h} style={[styles.c, { color: t.sub, fontWeight: '700' }]}>{h}</Text>)}
      </View>
      {sorted.map((p, i) => (
        <StatRow key={`${p.id}-${i}`} routeId={isNhl ? playerRouteId(p.id) : null}>
          <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{fitName(p.name, 17)}</Text>
          <Text style={[styles.c, { color: t.sub }]}>{p.gp}</Text>
          <Text style={[styles.c, { color: t.text }]}>{p.goals}</Text>
          <Text style={[styles.c, { color: t.text }]}>{p.assists}</Text>
          <Text style={[styles.c, { color: t.text, fontWeight: '700' }]}>{p.points}</Text>
          <Text style={[styles.c, { color: t.sub }]}>{p.plusMinus > 0 ? `+${p.plusMinus}` : p.plusMinus}</Text>
          <Text style={[styles.c, { color: t.sub }]}>{p.pim}</Text>
        </StatRow>
      ))}
    </View>
  );
}

function GoalieTable({ rows, isNhl }: { rows: TeamGoalieStat[]; isNhl: boolean }) {
  const t = useTheme();
  if (!rows.length) return <Text style={{ color: t.subtle, padding: 16, textAlign: 'center' }}>No goalie stats.</Text>;
  const sorted = [...rows].sort((a, b) => b.gp - a.gp || b.savePct - a.savePct || a.gaa - b.gaa);
  return (
    <View>
      <View style={[styles.hrow, { borderColor: t.border }]}>
        <Text style={[styles.hname, { color: t.sub }]}>Goalie</Text>
        <Text style={[styles.gp, { color: t.sub, fontWeight: '700' }]}>GP</Text>
        <Text style={[styles.rec, { color: t.sub, fontWeight: '700' }]}>Record</Text>
        <Text style={[styles.stat, { color: t.sub, fontWeight: '700' }]}>GAA</Text>
        <Text style={[styles.stat, { color: t.sub, fontWeight: '700' }]}>SV%</Text>
        <Text style={[styles.so, { color: t.sub, fontWeight: '700' }]}>SO</Text>
      </View>
      {sorted.map((g, i) => (
        <StatRow key={`${g.id}-${i}`} routeId={isNhl ? playerRouteId(g.id) : null}>
          <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{fitName(g.name, 15)}</Text>
          <Text style={[styles.gp, { color: t.sub }]}>{g.gp}</Text>
          <Text style={[styles.rec, { color: t.text }]}>{g.wins}-{g.losses}-{g.otl}</Text>
          <Text style={[styles.stat, { color: t.text }]}>{g.gaa?.toFixed(2)}</Text>
          <Text style={[styles.stat, { color: t.text }]}>{pct3(g.savePct)}</Text>
          <Text style={[styles.so, { color: t.sub }]}>{g.shutouts}</Text>
        </StatRow>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sumCard: { flexDirection: 'row', justifyContent: 'space-around', borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 12, marginBottom: 12 },
  sumItem: { alignItems: 'center', gap: 2 },
  seg: { flexDirection: 'row', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 2, gap: 2, marginBottom: 10 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  hrow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  drow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  hname: { flex: 1, fontSize: 12 },
  name: { flex: 1, fontSize: 14, fontWeight: '600', paddingRight: 6 },
  c: { width: 34, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'] },
  gp: { width: 30, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'] },
  rec: { width: 64, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'] },
  stat: { width: 44, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'] },
  so: { width: 26, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'] },
});
