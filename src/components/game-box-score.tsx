import { Link } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import { rowIsPlayer, type FollowedOnGame } from '@/lib/follows';
import type { BoxGoalie, BoxSkater, GameDetail, ScratchedPlayer } from '@/lib/game-detail-types';
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
export function GameBoxScore({ g, followed = [] }: { g: GameDetail; followed?: FollowedOnGame[] }) {
  const t = useTheme();
  const [side, setSide] = useState<'away' | 'home'>('away');
  const rosters = g.rosters;
  if (!rosters) return null;
  // A followed player's row is marked in the accent colour and faintly tinted — not with a star,
  // which shifted the name in a cell that has no room to give. Joined by the feed's id where we hold
  // it, else by name.
  const mine = followed.filter((p) => p.side === side);
  const isMine = (p: { name: string; playerId?: number | string }) => mine.some((f) => rowIsPlayer(p, f));
  // The API links each row by its stored slug for every league it has seeded; the NHL id is the
  // fallback for a player the nightly refresh has not minted yet.
  const nhl = (g.league || '').toUpperCase() === 'NHL';
  const box = side === 'away' ? rosters.away : rosters.home;
  const hasToi = [...box.forwards, ...box.defense].some((p) => p.toi);
  // Only the CHL feeds carry per-skater shots today — elsewhere the column would be all dashes.
  const hasSog = [...box.forwards, ...box.defense].some((p) => p.sog != null);
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
          {hasSog ? <Text style={[styles.c, { color: t.sub }]}>SOG</Text> : null}
          <Text style={[styles.c, { color: t.sub }]}>+/-</Text>
          <Text style={[styles.c, { color: t.sub }]}>PIM</Text>
          {hasToi ? <Text style={[styles.toi, { color: t.sub }]}>TOI</Text> : null}
        </View>
        {groups.map((gr) => (
          <View key={gr.label}>
            <Text style={[styles.group, { color: t.subtle }]}>{gr.label.toUpperCase()}</Text>
            {gr.players.map((p) => (
              <BoxRow key={p.playerId} routeId={p.playerSlug ?? (nhl ? playerRouteId(p.playerId) : null)} mine={isMine(p)}>
                <Text style={[styles.num, { color: t.subtle }]}>{p.number ?? ''}</Text>
                <Text style={[styles.name, { color: isMine(p) ? t.accent : t.text, fontWeight: isMine(p) ? '800' : '600' }]} numberOfLines={1}>{fitName(p.name)}</Text>
                <Text style={[styles.c, { color: t.text }]}>{fmt(p.goals)}</Text>
                <Text style={[styles.c, { color: t.text }]}>{fmt(p.assists)}</Text>
                {hasSog ? <Text style={[styles.c, { color: t.text }]}>{fmt(p.sog)}</Text> : null}
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
            <BoxRow key={p.playerId} routeId={p.playerSlug ?? (nhl ? playerRouteId(p.playerId) : null)} mine={isMine(p)}>
              <Text style={[styles.num, { color: t.subtle }]}>{p.number ?? ''}</Text>
              <Text style={[styles.name, { color: isMine(p) ? t.accent : t.text, fontWeight: isMine(p) ? '800' : '600' }]} numberOfLines={1}>{fitName(p.name)}</Text>
              <Text style={[styles.c, { color: t.text }]}>{fmt(p.shotsAgainst)}</Text>
              <Text style={[styles.c, { color: t.text }]}>{fmt(p.saves)}</Text>
              <Text style={[styles.c, { color: t.text }]}>{fmt(p.goalsAgainst)}</Text>
              <Text style={[styles.gc, { color: t.sub }]}>{svPct(p.saves, p.shotsAgainst)}</Text>
              <Text style={[styles.toi, { color: t.sub }]}>{p.toi ?? '—'}</Text>
            </BoxRow>
          ))}
        </View>
      ) : null}

      {g.scratches ? <ScratchesCard g={g} followed={followed} side={side} /> : null}
    </View>
  );
}

/**
 * Who did not dress. The NHL lists its scratches; everywhere else this is the roster minus the
 * lineup and the heading says so. A followed player is marked so a fan sees at once that the
 * prospect he came for is sitting. Without `side`, both clubs, for a pregame page with no box.
 */
export function ScratchesCard({ g, followed = [], side }: { g: GameDetail; followed?: FollowedOnGame[]; side?: 'away' | 'home' }) {
  const t = useTheme();
  if (!g.scratches) return null;
  const heading = g.scratches.source === 'listed' ? 'SCRATCHES' : 'NOT DRESSED';
  const sides = side ? [side] : (['away', 'home'] as const);
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.section, { color: t.sub }]}>{heading}</Text>
      {sides.map((s) => {
        const list: ScratchedPlayer[] = g.scratches![s];
        const mine = followed.filter((p) => p.side === s);
        const team = s === 'away' ? g.awayTeam : g.homeTeam;
        return (
          <View key={s} style={{ marginTop: side ? 0 : 6 }}>
            {!side ? <Text style={[styles.group, { color: t.subtle, marginTop: 4 }]}>{team.abbr}</Text> : null}
            {list.length === 0 ? <Text style={{ color: t.subtle, fontSize: 12 }}>None</Text> : list.map((p, i) => {
              const isMine = mine.some((f) => rowIsPlayer(p, f));
              return (
                <BoxRow key={`${p.playerId ?? i}`} routeId={p.playerSlug ?? null} mine={isMine}>
                  <Text style={[styles.num, { color: t.subtle }]}>{p.number ?? ''}</Text>
                  <Text style={[styles.name, { color: isMine ? t.accent : t.text, fontWeight: isMine ? '800' : '600' }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ color: t.sub, fontSize: 12 }}>{[p.position, p.reason].filter(Boolean).join(' — ')}</Text>
                </BoxRow>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function BoxRow({ routeId, children, mine }: { routeId: string | null; children: ReactNode; mine?: boolean }) {
  const t = useTheme();
  // A followed player's row carries a wash of the accent — enough to find him while scrolling,
  // faint enough that it does not read as a selection.
  const row = [styles.drow, { borderColor: t.border }, mine ? { backgroundColor: `${t.accent}14` } : null];
  if (!routeId) return <View style={row}>{children}</View>;
  return (
    <Link href={{ pathname: '/players/[playerId]', params: { playerId: routeId } }} asChild>
      <Pressable style={StyleSheet.flatten(row)}>{children}</Pressable>
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
