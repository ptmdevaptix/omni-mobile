import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import { playerRouteId } from '@/lib/player';
import type { RateFloor } from '@/lib/stat-qualifiers';
import { leagueCodeLabel, type GoalieRow, type SkaterRow, type StatsMeta } from '@/lib/stats';
import { useTheme } from '@/lib/theme';

// The leaderboard tables — skaters and goalies — as the web draws them (components/ht-stats.tsx
// SkatersTable/GoaliesTable): rank, player with crest, position, a league column on a combined
// board, then the stat columns, any of which sorts the table. The name column stays put while the
// numbers scroll sideways: a phone cannot hold fifteen columns, and the name is what a reader
// scans. A rate column (P/GP, S%, GAA, SV%) qualifies on a share of the season played.

const PAGE_SIZE = 30;

type Col<R> = { key: string; label: string; title: string; get: (r: R) => number; fmt: (r: R) => string; defaultDesc: boolean; isRate: boolean; width?: number };

const fmtPlus = (n: number) => (n > 0 ? `+${n}` : String(n));
const toiStr = (secs: number) => { if (!secs) return '0:00'; const m = Math.floor(secs / 60); const s = Math.round(secs % 60); return `${m}:${String(s).padStart(2, '0')}`; };
const pct3 = (v: number) => (v ?? 0).toFixed(3).replace(/^0/, '');

function skaterCols(meta: StatsMeta): Col<SkaterRow>[] {
  const cols: Col<SkaterRow>[] = [
    { key: 'gp', label: 'GP', title: 'Games played', get: (r) => r.gp, fmt: (r) => String(r.gp), defaultDesc: true, isRate: false },
    { key: 'goals', label: 'G', title: 'Goals', get: (r) => r.goals, fmt: (r) => String(r.goals), defaultDesc: true, isRate: false },
    { key: 'assists', label: 'A', title: 'Assists', get: (r) => r.assists, fmt: (r) => String(r.assists), defaultDesc: true, isRate: false },
    { key: 'points', label: 'PTS', title: 'Points', get: (r) => r.points, fmt: (r) => String(r.points), defaultDesc: true, isRate: false },
    { key: 'pointsPerGame', label: 'P/GP', title: 'Points per game', get: (r) => r.pointsPerGame, fmt: (r) => (r.pointsPerGame ?? 0).toFixed(2), defaultDesc: true, isRate: true, width: 52 },
    { key: 'plusMinus', label: '+/-', title: 'Plus/minus', get: (r) => r.plusMinus, fmt: (r) => fmtPlus(r.plusMinus), defaultDesc: true, isRate: false },
  ];
  if (meta.hasPim) cols.push({ key: 'pim', label: 'PIM', title: 'Penalty minutes', get: (r) => r.pim ?? 0, fmt: (r) => String(r.pim ?? 0), defaultDesc: true, isRate: false });
  if (meta.hasToi) cols.push({ key: 'toiPerGame', label: 'TOI/G', title: 'Time on ice per game', get: (r) => r.toiPerGame ?? 0, fmt: (r) => toiStr(r.toiPerGame ?? 0), defaultDesc: true, isRate: true, width: 56 });
  cols.push(
    { key: 'ppGoals', label: 'PPG', title: 'Power-play goals', get: (r) => r.ppGoals, fmt: (r) => String(r.ppGoals), defaultDesc: true, isRate: false },
    { key: 'shGoals', label: 'SHG', title: 'Shorthanded goals', get: (r) => r.shGoals, fmt: (r) => String(r.shGoals), defaultDesc: true, isRate: false },
    { key: 'shots', label: 'SOG', title: 'Shots on goal', get: (r) => r.shots, fmt: (r) => String(r.shots), defaultDesc: true, isRate: false },
    { key: 'shootingPct', label: 'S%', title: 'Shooting percentage', get: (r) => r.shootingPct ?? 0, fmt: (r) => (r.shootingPct ?? 0).toFixed(1), defaultDesc: true, isRate: true },
  );
  if (meta.hasFaceoffs) cols.push(
    { key: 'faceoffWins', label: 'FOW', title: 'Faceoff wins', get: (r) => r.faceoffWins ?? 0, fmt: (r) => String(r.faceoffWins ?? 0), defaultDesc: true, isRate: false },
    { key: 'faceoffLosses', label: 'FOL', title: 'Faceoff losses', get: (r) => r.faceoffLosses ?? 0, fmt: (r) => String(r.faceoffLosses ?? 0), defaultDesc: false, isRate: false },
    { key: 'faceoffPct', label: 'FO%', title: 'Faceoff win percentage', get: (r) => r.faceoffPct ?? 0, fmt: (r) => (r.faceoffPct ?? 0).toFixed(1), defaultDesc: true, isRate: true },
  );
  return cols;
}

/**
 * Goalies, best stat first: GAA and SV% are what a goalie board is FOR, and on a phone a column
 * that needs a swipe may as well not be there. The web can afford to run the counting stats first
 * because it shows fifteen columns at once. Wins and the rest follow.
 */
function goalieCols(meta: StatsMeta): Col<GoalieRow>[] {
  const cols: Col<GoalieRow>[] = [
    { key: 'gp', label: 'GP', title: 'Games played', get: (r) => r.gp, fmt: (r) => String(r.gp), defaultDesc: true, isRate: false },
    { key: 'gaa', label: 'GAA', title: 'Goals-against average', get: (r) => r.gaa, fmt: (r) => (r.gaa ?? 0).toFixed(2), defaultDesc: false, isRate: true },
    { key: 'svPct', label: 'SV%', title: 'Save percentage', get: (r) => r.svPct, fmt: (r) => pct3(r.svPct), defaultDesc: true, isRate: true },
    { key: 'wins', label: 'W', title: 'Wins', get: (r) => r.wins, fmt: (r) => String(r.wins), defaultDesc: true, isRate: false },
    { key: 'losses', label: 'L', title: 'Losses', get: (r) => r.losses, fmt: (r) => String(r.losses), defaultDesc: false, isRate: false },
  ];
  if (meta.hasOt) cols.push({ key: 'ot', label: 'OT', title: 'Overtime losses', get: (r) => r.ot ?? 0, fmt: (r) => String(r.ot ?? 0), defaultDesc: false, isRate: false });
  cols.push({ key: 'so', label: 'SO', title: 'Shutouts', get: (r) => r.so, fmt: (r) => String(r.so), defaultDesc: true, isRate: false });
  if (meta.hasGs) cols.push({ key: 'gs', label: 'GS', title: 'Games started', get: (r) => r.gs ?? 0, fmt: (r) => String(r.gs ?? 0), defaultDesc: true, isRate: false });
  if (meta.hasGoalieSA) cols.push(
    { key: 'sa', label: 'SA', title: 'Shots against', get: (r) => r.sa ?? 0, fmt: (r) => String(r.sa ?? 0), defaultDesc: true, isRate: false },
    { key: 'sv', label: 'SV', title: 'Saves', get: (r) => r.sv ?? 0, fmt: (r) => String(r.sv ?? 0), defaultDesc: true, isRate: false },
    { key: 'ga', label: 'GA', title: 'Goals against', get: (r) => r.ga ?? 0, fmt: (r) => String(r.ga ?? 0), defaultDesc: false, isRate: false },
  );
  return cols;
}

// A phone cannot hold fifteen columns, so the frozen half carries WHO — rank, crest, name, and
// under it his position, league and club — and the scrolling half is nothing but numbers. That
// keeps GP · G · A · PTS on screen at 393pt without a swipe, which is what a reader opens a
// leaderboard for. The web spends its width on Pos, Lg and Team as columns of their own.
const W = { rank: 22, name: 150, stat: 37 };

/**
 * A column as wide as the widest thing in it. A goalie with 1,202 shots against wrapped onto two
 * lines in a cell sized for three digits; measuring means no column is ever too narrow and none is
 * padded for numbers it will never hold. ~7.5pt a digit at 13px tabular figures, plus the padding.
 */
function columnWidth<R>(c: Col<R>, rows: R[]): number {
  let chars = c.label.length + 1;   // + the sort arrow
  for (const r of rows) { const n = c.fmt(r).length; if (n > chars) chars = n; }
  return Math.max(c.width ?? W.stat, Math.round(chars * 7.5) + 10);
}

/** Full name when it fits, else "C. McDavid" — the same rule the box score's rows use. */
function fitName(name: string, max = 12): string {
  if (name.length <= max) return name;
  const p = name.trim().split(/\s+/);
  return p.length < 2 ? name : `${p[0][0]}. ${p[p.length - 1]}`;
}

type Base = { key: string; name: string; team: string; teamLogo?: string; teamDarkLogo?: string; nhlId?: number; league: string; gp: number; position?: string };

function Table<R extends Base>({ rows, cols, defaultSort, showLeague, showPos, floor, noun }: {
  rows: R[]; cols: Col<R>[]; defaultSort: string; showLeague: boolean; showPos: boolean; floor: RateFloor; noun: string;
}) {
  const t = useTheme();
  const [sortKey, setSortKey] = useState(defaultSort);
  const [desc, setDesc] = useState(true);
  const [shown, setShown] = useState(PAGE_SIZE);
  // A new board (a league, a season, a conference) starts at the first page again — reset during
  // render, the way React asks for state that follows a prop, rather than a tick later in an effect.
  const [seen, setSeen] = useState(rows);
  if (rows !== seen) { setSeen(rows); setShown(PAGE_SIZE); }

  const col = cols.find((c) => c.key === sortKey) ?? cols.find((c) => c.key === defaultSort) ?? cols[0];
  const widths = useMemo(() => new Map(cols.map((c) => [c.key, columnWidth(c, rows)])), [cols, rows]);
  const sorted = useMemo(() => {
    // A rate column counts only the players past the floor — whoever played once and got lucky
    // would otherwise own it.
    const eligible = col.isRate ? rows.filter((r) => r.gp >= floor.min(r.league)) : rows;
    return [...eligible].sort((a, b) => (desc ? col.get(b) - col.get(a) : col.get(a) - col.get(b)));
  }, [rows, col, desc, floor]);
  const visible = sorted.slice(0, shown);

  const sortBy = (c: Col<R>) => {
    if (c.key === col.key) { setDesc((d) => !d); return; }
    setSortKey(c.key); setDesc(c.defaultDesc); setShown(PAGE_SIZE);
  };

  const statHead = (c: Col<R>) => {
    const on = c.key === col.key;
    return (
      <Pressable key={c.key} onPress={() => sortBy(c)} accessibilityRole="button" accessibilityLabel={c.title} accessibilityState={{ selected: on }}
        style={[styles.cell, { width: widths.get(c.key) ?? W.stat }, on && { backgroundColor: `${t.accent}1f` }]}>
        <Text style={[styles.head, { color: on ? t.text : t.sub }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {c.label}{on ? (desc ? '▾' : '▴') : ''}
        </Text>
      </Pressable>
    );
  };

  const nameCell = (r: R, i: number) => (
    <View style={[styles.cell, styles.nameCell, { width: W.name }]}>
      <Text style={[styles.num, { color: t.subtle, width: W.rank, textAlign: 'right' }]}>{i + 1}</Text>
      <TeamLogo uri={r.teamLogo} darkUri={r.teamDarkLogo} size={18} />
      <View style={{ flexShrink: 1 }}>
        <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{fitName(r.name)}</Text>
        {/* Position, league and club — a column each on the web, one quiet line here. */}
        <Text style={{ color: t.subtle, fontSize: 10.5 }} numberOfLines={1}>
          {[showPos ? r.position : null, showLeague ? leagueCodeLabel(r.league) : null, r.team].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={{ flexDirection: 'row' }}>
        {/* The frozen column: rank and name, so the numbers scroll under a name that stays. */}
        <View style={[styles.frozen, { borderRightColor: t.border }]}>
          <View style={[styles.row, styles.headRow, { borderBottomColor: t.border }]}>
            <View style={[styles.cell, styles.nameCell, { width: W.name }]}>
              <Text style={[styles.head, { color: t.sub, width: W.rank, textAlign: 'right' }]}>RK</Text>
              <Text style={[styles.head, { color: t.sub }]}>Player</Text>
            </View>
          </View>
          {visible.map((r, i) => {
            const route = r.nhlId != null ? playerRouteId(r.nhlId) : null;
            const inner = <View key={r.key} style={[styles.row, { borderBottomColor: t.border }]}>{nameCell(r, i)}</View>;
            return route ? (
              <Link key={r.key} href={{ pathname: '/players/[playerId]', params: { playerId: route } }} asChild>
                <Pressable>{inner}</Pressable>
              </Link>
            ) : inner;
          })}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
          <View>
            <View style={[styles.row, styles.headRow, { borderBottomColor: t.border }]}>
              {cols.map(statHead)}
            </View>
            {visible.map((r) => (
              <View key={r.key} style={[styles.row, { borderBottomColor: t.border }]}>
                {cols.map((c) => {
                  const on = c.key === col.key;
                  return (
                    <View key={c.key} style={[styles.cell, { width: widths.get(c.key) ?? W.stat }, on && { backgroundColor: `${t.accent}14` }]}>
                      <Text style={[styles.num, { color: on ? t.text : t.sub, fontWeight: on ? '700' : '400' }]} numberOfLines={1}>{c.fmt(r)}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      <View style={[styles.foot, { borderTopColor: t.border }]}>
        <Text style={{ color: t.subtle, fontSize: 11, flexShrink: 1 }}>
          {visible.length} of {sorted.length} {noun}{col.isRate ? ` · min. ${floor.label} for rate stats` : ''}
        </Text>
        {shown < sorted.length ? (
          <Pressable onPress={() => setShown((s) => s + PAGE_SIZE)} accessibilityRole="button"><Text style={{ color: t.accent, fontSize: 12, fontWeight: '600' }}>Show more</Text></Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function SkatersTable({ rows, meta, showLeague, floor }: { rows: SkaterRow[]; meta: StatsMeta; showLeague: boolean; floor: RateFloor }) {
  const cols = useMemo(() => skaterCols(meta), [meta]);
  return <Table rows={rows} cols={cols} defaultSort="points" showLeague={showLeague} showPos floor={floor} noun="players" />;
}

export function GoaliesTable({ rows, meta, showLeague, floor }: { rows: GoalieRow[]; meta: StatsMeta; showLeague: boolean; floor: RateFloor }) {
  const cols = useMemo(() => goalieCols(meta), [meta]);
  return <Table rows={rows} cols={cols} defaultSort="svPct" showLeague={showLeague} showPos={false} floor={floor} noun="goalies" />;
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  frozen: { borderRightWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: StyleSheet.hairlineWidth, height: 42 },
  headRow: { height: 30 },
  cell: { paddingHorizontal: 3, justifyContent: 'center' },
  // No left padding: the rank column is the card's own edge, so the numbers and the crests below
  // them line up with the header rather than floating in a margin.
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 0 },
  head: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'right' },
  num: { fontSize: 13, textAlign: 'right', fontVariant: ['tabular-nums'] },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
