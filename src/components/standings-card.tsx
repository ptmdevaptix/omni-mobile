import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import {
  isBanded, pointsPct, sortRows,
  type FormResult, type SortKey, type StandingsCardGroup, type StandingsCardLine, type StandingsCardRow, type StandingsZone,
} from '@/lib/standings-cards';
import { useTheme } from '@/lib/theme';

// Standings as cards — one card per group, the same anatomy as the web's standings-cards.tsx at
// phone width: rail · # · crest + name + badge · Record · Pts. Everything the web drops below 400px
// (GP, Pct, the points bar, Last 5) lives behind "All stats", where the table scrolls sideways and
// the name gives way to the abbreviation. Sorting is per card; the bands — rail, cut lines, legend —
// stay only while the rows are in standings order.

const ZONE_RAIL: Record<StandingsZone, [string, string]> = {
  bye: ['#0284c7', '#38bdf8'], in: ['#059669', '#34d399'], bubble: ['#f59e0b', '#fbbf24'], out: ['transparent', 'transparent'], drop: ['#dc2626', '#f87171'],
};
const FORM_TICK: Record<FormResult, [string, string]> = {
  W: ['#059669', '#34d399'], L: ['#dc2626', '#f87171'], OTL: ['#f59e0b', '#fbbf24'], T: ['#f59e0b', '#fbbf24'],
};
const BADGE: Record<'in' | 'out' | 'title', { bg: string; fg: [string, string] }> = {
  in: { bg: 'rgba(16,185,129,0.15)', fg: ['#047857', '#34d399'] },
  title: { bg: 'rgba(59,130,246,0.15)', fg: ['#1d4ed8', '#60a5fa'] },
  out: { bg: 'rgba(127,127,127,0.15)', fg: ['#dc2626', '#f87171'] },
};
// Lines are styled by their order in the card, not by the caller: the first cut is solid green,
// every later one dashed amber — so a bye line over a playoff line reads the same on every league.
const LINE_STYLE = [
  { color: ['#059669', '#34d399'] as [string, string], dashed: false },
  { color: ['#f59e0b', '#fbbf24'] as [string, string], dashed: true },
];
const LINE_BUBBLE = { color: ['#f59e0b', '#fbbf24'] as [string, string], dashed: false };

const W = { rail: 4, rank: 30, gp: 34, rec: 76, recWide: 96, pts: 40, pct: 46, stat: 44, statWide: 62, form: 62, abbr: 76, compact: 70 };

function lineStyle(lines: StandingsCardLine[] | undefined, banded: boolean) {
  const map = new Map<number, { style: typeof LINE_BUBBLE; label?: string }>();
  if (!banded) return map;
  (lines ?? []).forEach((l, i) => map.set(l.after, { style: l.tone === 'bubble' ? LINE_BUBBLE : LINE_STYLE[Math.min(i, LINE_STYLE.length - 1)], label: l.label }));
  return map;
}

function Form({ results, dark }: { results?: FormResult[]; dark: boolean }) {
  const last = (results ?? []).slice(-5);
  const wins = last.filter((r) => r === 'W').length;
  const losses = last.filter((r) => r === 'L').length;
  // Always five boxes. Games not yet played sit gray on the left, so the column keeps its shape.
  const pad = 5 - last.length;
  const label = last.length ? `Last ${last.length}: ${wins}-${losses}-${last.length - wins - losses}` : 'No games played yet';
  return (
    <View style={styles.form} accessibilityLabel={label}>
      {Array.from({ length: pad }, (_, i) => <View key={`p${i}`} style={[styles.tick, { backgroundColor: 'rgba(127,127,127,0.3)' }]} />)}
      {last.map((r, i) => <View key={i} style={[styles.tick, { backgroundColor: FORM_TICK[r][dark ? 1 : 0] }]} />)}
    </View>
  );
}

/** A cut line under a row — solid, or a run of dashes: RN cannot dash one side of a border. */
function CutLine({ color, dashed }: { color: string; dashed: boolean }) {
  if (!dashed) return <View style={{ height: 2, backgroundColor: color }} />;
  return (
    <View style={{ height: 2, flexDirection: 'row', overflow: 'hidden', gap: 4 }}>
      {Array.from({ length: 80 }, (_, i) => <View key={i} style={{ width: 6, height: 2, backgroundColor: color }} />)}
    </View>
  );
}

function Rail({ zone, dark }: { zone: StandingsZone; dark: boolean }) {
  return <View style={{ width: W.rail, alignSelf: 'stretch', backgroundColor: ZONE_RAIL[zone][dark ? 1 : 0] }} />;
}

function Legend({ legend, dark }: { legend: { zone: StandingsZone; label: string }[]; dark: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.legend, { borderTopColor: t.border }]}>
      {legend.map((l) => (
        <View key={l.label} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: ZONE_RAIL[l.zone][dark ? 1 : 0] }, l.zone === 'out' && { borderWidth: StyleSheet.hairlineWidth, borderColor: t.border }]} />
          <Text style={{ color: t.sub, fontSize: 10.5 }}>{l.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Head({ label, width, left, active, desc, onPress, flex }: { label: string; width?: number; left?: boolean; active?: boolean; desc?: boolean; onPress?: () => void; flex?: boolean }) {
  const t = useTheme();
  const inner = (
    <Text style={[styles.head, { color: active ? t.text : t.sub, textAlign: left ? 'left' : 'right' }]} numberOfLines={1}>
      {label}{active && label !== '#' ? <Text style={{ fontSize: 9 }}>{desc ? ' ↓' : ' ↑'}</Text> : null}
    </Text>
  );
  const box = flex ? { flex: 1 } : { width };
  return onPress
    ? <Pressable onPress={onPress} style={[styles.cell, box]} accessibilityRole="button" accessibilityState={{ selected: !!active }}>{inner}</Pressable>
    : <View style={[styles.cell, box]}>{inner}</View>;
}

function Cell({ children, width, muted, flex, color }: { children: React.ReactNode; width?: number; muted?: boolean; flex?: boolean; color?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.cell, flex ? { flex: 1 } : { width }]}>
      <Text style={[styles.num, { color: color ?? (muted ? t.sub : t.text) }]} numberOfLines={1}>{children}</Text>
    </View>
  );
}

function Badge({ badge, dark }: { badge: NonNullable<StandingsCardRow['badge']>; dark: boolean }) {
  const b = BADGE[badge.kind];
  return (
    <View style={[styles.badge, { backgroundColor: b.bg }]} accessibilityLabel={badge.title}>
      <Text style={{ color: b.fg[dark ? 1 : 0], fontSize: 10, fontWeight: '700' }}>{badge.label}</Text>
    </View>
  );
}

export function StandingsCard({ group, allStats }: { group: StandingsCardGroup; allStats: boolean }) {
  const t = useTheme();
  const dark = t.mode === 'dark';
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [desc, setDesc] = useState(true);
  const banded = isBanded(sortKey);
  const lineAfter = lineStyle(group.lines, banded);
  const perGame = group.pointsPerGame ?? 2;
  const hasForm = group.recent ? group.recent === 'form' : group.rows.some((r) => r.form?.length);
  const pctOf = (r: StandingsCardRow) => r.pct ?? pointsPct(r.pts, r.gp, perGame);
  // A league that lists "pct" among its own stat columns places it itself in All stats.
  const ownPct = (group.statColumns ?? []).some((c) => c.key === 'pct');
  const cols = allStats ? group.statColumns ?? [] : [];
  const wide = (group.recordFormat ?? '').split('-').length > 3;
  const ordered = sortRows(group, sortKey, desc);

  const sortBy = (key: SortKey) => {
    if (key === sortKey) { if (key !== 'rank') setDesc((d) => !d); return; }
    setSortKey(key);
    setDesc(key !== 'name');   // numbers open biggest-first, names A–Z
  };
  const hdr = (key: SortKey, label: string, width?: number, left?: boolean, flex?: boolean) => (
    <Head key={String(key)} label={label} width={width} left={left} flex={flex} active={sortKey === key} desc={desc} onPress={() => sortBy(key)} />
  );
  const statWidth = (key: string) => (['home', 'away', 'l10', 'conf', 'overall', 'nonconf'].includes(key) ? W.statWide : W.stat);

  const header = (
    <View style={[styles.row, { borderBottomColor: t.border }]}>
      <View style={{ width: W.rail }} />
      {hdr('rank', '#', W.rank)}
      {allStats ? hdr('name', 'Team', W.abbr, true) : hdr('name', 'Team', undefined, true, true)}
      {allStats ? hdr('gp', 'GP', W.gp) : null}
      {!allStats ? <Head label={group.recordLabel ?? 'Record'} width={wide ? W.recWide : W.rec} /> : null}
      {!group.noPoints ? hdr('pts', 'Pts', W.pts) : null}
      {allStats && !ownPct ? hdr('pct', 'Pct', W.pct) : null}
      {!allStats ? (group.compactColumns ?? []).map((c) => hdr(`stat:${c.key}`, c.label, W.compact)) : null}
      {cols.map((c) => hdr(`stat:${c.key}`, c.label, statWidth(c.key)))}
      {allStats ? <Head label={hasForm ? 'Last 5' : 'Strk'} width={W.form} /> : null}
    </View>
  );

  const body = ordered.map(({ r, i }, idx) => {
    const rank = i + 1;
    // The rank is the STANDINGS rank whatever the sort. The rail follows the bands and goes with them.
    const zone = banded ? group.zoneOf?.(rank, r) ?? 'out' : 'out';
    const line = lineAfter.get(rank);
    const last = idx === ordered.length - 1;
    const rowStyle = [
      styles.row,
      { borderBottomColor: t.border, borderBottomWidth: line || last ? 0 : StyleSheet.hairlineWidth },
      r.us && { backgroundColor: dark ? 'rgba(232,187,70,0.12)' : 'rgba(32,138,239,0.10)' },
    ];
    const streakColor = /W/i.test(r.streak ?? '') ? ZONE_RAIL.in[dark ? 1 : 0] : /L/i.test(r.streak ?? '') ? ZONE_RAIL.drop[dark ? 1 : 0] : t.sub;
    return (
      <View key={r.id}>
      <Link href={{ pathname: '/teams/[teamId]', params: { teamId: r.id } }} asChild>
        <Pressable style={StyleSheet.flatten(rowStyle)} accessibilityLabel={[r.name, `${group.recordFormat ?? 'Record'} ${r.record}`, line?.label ? `${line.label} below` : ''].filter(Boolean).join(', ')}>
          <Rail zone={zone} dark={dark} />
          <Cell width={W.rank} muted>{rank}</Cell>
          <View style={[styles.cell, styles.nameCell, allStats ? { width: W.abbr } : { flex: 1 }]}>
            <TeamLogo uri={r.logo} darkUri={r.darkLogo} size={20} />
            <Text style={{ color: t.text, fontSize: 13, fontWeight: r.us ? '700' : '500', flexShrink: 1 }} numberOfLines={1}>{allStats ? r.abbr : r.name}</Text>
            {r.badge && !allStats ? <Badge badge={r.badge} dark={dark} /> : null}
          </View>
          {allStats ? <Cell width={W.gp} muted>{r.gp}</Cell> : null}
          {!allStats ? <Cell width={wide ? W.recWide : W.rec} muted>{r.record}</Cell> : null}
          {!group.noPoints ? <View style={[styles.cell, { width: W.pts }]}><Text style={[styles.num, { color: t.text, fontWeight: '700' }]}>{r.pts}</Text></View> : null}
          {allStats && !ownPct ? <Cell width={W.pct} muted>{pctOf(r)}</Cell> : null}
          {!allStats ? (group.compactColumns ?? []).map((c) => <Cell key={c.key} width={W.compact} muted>{r.stats?.[c.key] ?? ''}</Cell>) : null}
          {cols.map((c) => {
            const v = r.stats?.[c.key];
            const n = typeof v === 'number' ? v : NaN;
            const tone = c.key === 'diff' && Number.isFinite(n) ? (n > 0 ? ZONE_RAIL.in[dark ? 1 : 0] : n < 0 ? ZONE_RAIL.drop[dark ? 1 : 0] : undefined) : undefined;
            return <Cell key={c.key} width={statWidth(c.key)} color={tone}>{c.key === 'diff' && Number.isFinite(n) && n > 0 ? `+${n}` : v ?? ''}</Cell>;
          })}
          {allStats ? (
            <View style={[styles.cell, { width: W.form, alignItems: 'flex-end' }]}>
              {hasForm ? <Form results={r.form} dark={dark} /> : <Text style={[styles.num, { color: streakColor }]}>{r.streak ?? '—'}</Text>}
            </View>
          ) : null}
        </Pressable>
      </Link>
      {line ? <CutLine color={line.style.color[dark ? 1 : 0]} dashed={line.style.dashed} /> : null}
      </View>
    );
  });

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={[styles.cardHead, { borderBottomColor: t.border }]}>
        {group.railColor ? <View style={[styles.railChip, { backgroundColor: group.railColor }]} /> : null}
        <Text style={{ color: t.text, fontSize: 13, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>{group.title}</Text>
        {group.subtitle ? <Text style={{ color: t.sub, fontSize: 11, marginLeft: 'auto', flexShrink: 1 }} numberOfLines={1}>{group.subtitle}</Text> : null}
      </View>
      {allStats ? (
        // The full column set is wider than a phone; the card scrolls sideways rather than squeezing
        // the numbers, and the name column is the abbreviation so it is not what gets clipped.
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
          <View>{header}{body}</View>
        </ScrollView>
      ) : (
        <View>{header}{body}</View>
      )}
      {banded && group.legend?.length ? <Legend legend={group.legend} dark={dark} /> : null}
    </View>
  );
}

/**
 * The team page's standings card: the same look, cut to what fits under a schedule — rank, rail,
 * crest, name, record, points; no percentage, no Last 5, no sort, no All stats. The club's own row
 * (`us`) is picked out. Lines and zones are the league's, where the caller knows them.
 */
export function MiniStandings({ group }: { group: StandingsCardGroup }) {
  const t = useTheme();
  const dark = t.mode === 'dark';
  const lineAfter = lineStyle(group.lines, true);
  const wide = (group.recordFormat ?? '').split('-').length > 3;
  const hasZones = !!group.zoneOf;
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={[styles.cardHead, { borderBottomColor: t.border }]}>
        {group.railColor ? <View style={[styles.railChip, { backgroundColor: group.railColor }]} /> : null}
        <Text style={{ color: t.text, fontSize: 13, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>{group.title}</Text>
        {group.subtitle ? <Text style={{ color: t.sub, fontSize: 11, marginLeft: 'auto', flexShrink: 1 }} numberOfLines={1}>{group.subtitle}</Text> : null}
      </View>
      <View style={[styles.row, { borderBottomColor: t.border }]}>
        {hasZones ? <View style={{ width: W.rail }} /> : null}
        <Head label="#" width={W.rank} />
        <Head label="Team" left flex />
        <Head label={group.recordLabel ?? 'Record'} width={wide ? W.recWide : W.rec} />
        <Head label="Pts" width={W.pts} />
      </View>
      {group.rows.map((r, i) => {
        const rank = i + 1;
        const zone = group.zoneOf?.(rank, r) ?? 'out';
        const line = lineAfter.get(rank);
        const last = i === group.rows.length - 1;
        return (
          <View key={r.id}>
          <Link href={{ pathname: '/teams/[teamId]', params: { teamId: r.id } }} asChild>
            <Pressable style={StyleSheet.flatten([
              styles.row,
              { borderBottomColor: t.border, borderBottomWidth: line || last ? 0 : StyleSheet.hairlineWidth },
              r.us && { backgroundColor: dark ? 'rgba(232,187,70,0.12)' : 'rgba(32,138,239,0.10)' },
            ])}>
              {hasZones ? <Rail zone={zone} dark={dark} /> : null}
              <Cell width={W.rank} muted>{rank}</Cell>
              <View style={[styles.cell, styles.nameCell, { flex: 1 }]}>
                <TeamLogo uri={r.logo} darkUri={r.darkLogo} size={20} />
                <Text style={{ color: t.text, fontSize: 13, fontWeight: r.us ? '700' : '500', flexShrink: 1 }} numberOfLines={1}>{r.name}</Text>
                {r.badge ? <Badge badge={r.badge} dark={dark} /> : null}
              </View>
              <Cell width={wide ? W.recWide : W.rec} muted>{r.record}</Cell>
              <View style={[styles.cell, { width: W.pts }]}><Text style={[styles.num, { color: t.text, fontWeight: '700' }]}>{r.pts}</Text></View>
            </Pressable>
          </Link>
          {line ? <CutLine color={line.style.color[dark ? 1 : 0]} dashed={line.style.dashed} /> : null}
          </View>
        );
      })}
      {group.legend?.length ? <Legend legend={group.legend} dark={dark} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  railChip: { width: 4, height: 14, borderRadius: 2 },
  row: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { paddingHorizontal: 5, paddingVertical: 8, justifyContent: 'center' },
  nameCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 7, paddingLeft: 4 },
  head: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  num: { fontSize: 13, textAlign: 'right', fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  form: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  tick: { width: 9, height: 9, borderRadius: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 4, height: 12, borderRadius: 2 },
});
