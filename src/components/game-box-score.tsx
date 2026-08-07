import { Link } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import type { BoxGoalie, BoxSkater, GameDetail } from '@/lib/game-detail-types';
import { playerRouteId } from '@/lib/player';
import { useTheme } from '@/lib/theme';

const fmt = (v?: number) => (v == null ? '—' : String(v));
const fmtPM = (v?: number) => (v == null ? '—' : v > 0 ? `+${v}` : String(v));
const svPct = (sv?: number, sa?: number) => (sa && sa > 0 && sv != null ? (sv / sa).toFixed(3).replace(/^0/, '') : '—');
const toiSec = (toi?: string) => { if (!toi) return 0; const [m, s] = toi.split(':').map(Number); return (m || 0) * 60 + (s || 0); };
const byToi = (a: { toi?: string }, b: { toi?: string }) => toiSec(b.toi) - toiSec(a.toi);
const byPts = (a: BoxSkater, b: BoxSkater) => ((b.goals ?? 0) + (b.assists ?? 0)) - ((a.goals ?? 0) + (a.assists ?? 0));

// Full name when short, else "F. Last" so it fits the narrow name column.
function fitName(name: string, max = 18): string {
  if (name.length <= max) return name;
  const p = name.trim().split(/\s+/);
  return p.length < 2 ? name : `${p[0][0]}. ${p[p.length - 1]}`;
}

// Per-game box score: pick a team, see its skaters (by line) and goalies with individual stats.
export function GameBoxScore({ g }: { g: GameDetail }) {
  const t = useTheme();
  const [side, setSide] = useState<'away' | 'home'>('away');
  const rosters = g.rosters;
  if (!rosters) return null;
  const nhl = (g.league || '').toUpperCase() === 'NHL';
  const box = side === 'away' ? rosters.away : rosters.home;
  const hasToi = [...box.forwards, ...box.defense].some((p) => p.toi);
  const sortFn = hasToi ? byToi : byPts;
  const groups = [
    { label: 'Forwards', players: [...box.forwards].sort(sortFn) },
    { label: 'Defense', players: [...box.defense].sort(sortFn) },
  ].filter((gr) => gr.players.length);
  const goalies = [...box.goalies].sort(byToi);

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.seg, { backgroundColor: t.card, borderColor: t.border }]}>
        {(['away', 'home'] as const).map((s) => {
          const on = s === side;
          const tm = s === 'away' ? g.awayTeam : g.homeTeam;
          return (
            <Pressable key={s} onPress={() => setSide(s)} style={[styles.segItem, on && { backgroundColor: t.accent }]}>
              <TeamLogo uri={tm.logo} darkUri={tm.darkLogo} size={18} />
              <Text style={{ color: on ? t.onAccent : t.sub, fontWeight: on ? '800' : '600' }}>{tm.abbr}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[styles.hrow, { borderColor: t.border }]}>
          <Text style={[styles.num, { color: t.sub }]}>#</Text>
          <Text style={[styles.hname, { color: t.sub }]}>Player</Text>
          <Text style={[styles.c, { color: t.sub }]}>G</Text>
          <Text style={[styles.c, { color: t.sub }]}>A</Text>
          <Text style={[styles.c, { color: t.sub }]}>+/-</Text>
          <Text style={[styles.c, { color: t.sub }]}>PIM</Text>
          {hasToi ? <Text style={[styles.toi, { color: t.sub }]}>TOI</Text> : null}
        </View>
        {groups.map((gr) => (
          <View key={gr.label}>
            <Text style={[styles.group, { color: t.subtle }]}>{gr.label.toUpperCase()}</Text>
            {gr.players.map((p) => (
              <BoxRow key={p.playerId} routeId={nhl ? playerRouteId(p.playerId) : null}>
                <Text style={[styles.num, { color: t.subtle }]}>{p.number ?? ''}</Text>
                <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{fitName(p.name)}</Text>
                <Text style={[styles.c, { color: t.text }]}>{fmt(p.goals)}</Text>
                <Text style={[styles.c, { color: t.text }]}>{fmt(p.assists)}</Text>
                <Text style={[styles.c, { color: t.sub }]}>{fmtPM(p.plusMinus)}</Text>
                <Text style={[styles.c, { color: t.sub }]}>{fmt(p.pim)}</Text>
                {hasToi ? <Text style={[styles.toi, { color: t.sub }]}>{p.toi ?? '—'}</Text> : null}
              </BoxRow>
            ))}
          </View>
        ))}
      </View>

      {goalies.length ? (
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.section, { color: t.sub }]}>GOALIES</Text>
          <View style={[styles.hrow, { borderColor: t.border }]}>
            <Text style={[styles.num, { color: t.sub }]}>#</Text>
            <Text style={[styles.hname, { color: t.sub }]}>Player</Text>
            <Text style={[styles.c, { color: t.sub }]}>SA</Text>
            <Text style={[styles.c, { color: t.sub }]}>SV</Text>
            <Text style={[styles.c, { color: t.sub }]}>GA</Text>
            <Text style={[styles.gc, { color: t.sub }]}>SV%</Text>
            <Text style={[styles.toi, { color: t.sub }]}>TOI</Text>
          </View>
          {goalies.map((p: BoxGoalie) => (
            <BoxRow key={p.playerId} routeId={nhl ? playerRouteId(p.playerId) : null}>
              <Text style={[styles.num, { color: t.subtle }]}>{p.number ?? ''}</Text>
              <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{fitName(p.name)}</Text>
              <Text style={[styles.c, { color: t.text }]}>{fmt(p.shotsAgainst)}</Text>
              <Text style={[styles.c, { color: t.text }]}>{fmt(p.saves)}</Text>
              <Text style={[styles.c, { color: t.text }]}>{fmt(p.goalsAgainst)}</Text>
              <Text style={[styles.gc, { color: t.sub }]}>{svPct(p.saves, p.shotsAgainst)}</Text>
              <Text style={[styles.toi, { color: t.sub }]}>{p.toi ?? '—'}</Text>
            </BoxRow>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function BoxRow({ routeId, children }: { routeId: string | null; children: ReactNode }) {
  const t = useTheme();
  if (!routeId) return <View style={[styles.drow, { borderColor: t.border }]}>{children}</View>;
  return (
    <Link href={{ pathname: '/players/[playerId]', params: { playerId: routeId } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.drow, { borderColor: t.border }])}>{children}</Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 6 },
  seg: { flexDirection: 'row', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 2, gap: 2 },
  segItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
  hrow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  drow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  group: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginTop: 10, marginBottom: 2 },
  num: { width: 22, fontSize: 12, textAlign: 'left', fontVariant: ['tabular-nums'] },
  hname: { flex: 1, fontSize: 12 },
  name: { flex: 1, fontSize: 13, fontWeight: '600', paddingRight: 6 },
  c: { width: 28, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'] },
  gc: { width: 42, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'] },
  toi: { width: 44, textAlign: 'right', fontSize: 13, fontVariant: ['tabular-nums'] },
});
