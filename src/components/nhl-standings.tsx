import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { fetchNhlStandings, leagueColors, type NhlStandingsTeam } from '@/lib/leagues';
import { usePullRefresh } from '@/lib/pull-refresh';
import { nhlNickname } from '@/lib/nhl-teams';
import { useTheme } from '@/lib/theme';

type ViewType = 'division' | 'conference' | 'league';

type Col = { key: string; label: string; w: number; sortable: boolean; defaultAsc: boolean; priority: number };

// Display order (left→right). `priority` decides which columns survive when width is tight (lower = kept
// first). The 5 record basics are always shown; everything else fills in as the screen widens (rotate!).
const COLS: Col[] = [
  { key: 'gp', label: 'GP', w: 30, sortable: true, defaultAsc: false, priority: 1 },
  { key: 'w', label: 'W', w: 26, sortable: true, defaultAsc: false, priority: 2 },
  { key: 'l', label: 'L', w: 26, sortable: true, defaultAsc: true, priority: 3 },
  { key: 'otl', label: 'OTL', w: 36, sortable: true, defaultAsc: true, priority: 4 },
  { key: 'pts', label: 'PTS', w: 36, sortable: true, defaultAsc: false, priority: 0 },
  { key: 'pct', label: 'P%', w: 44, sortable: true, defaultAsc: false, priority: 8 },
  { key: 'rw', label: 'RW', w: 30, sortable: true, defaultAsc: false, priority: 11 },
  { key: 'row', label: 'ROW', w: 38, sortable: true, defaultAsc: false, priority: 12 },
  { key: 'sow', label: 'SOW', w: 38, sortable: true, defaultAsc: false, priority: 13 },
  { key: 'sol', label: 'SOL', w: 34, sortable: true, defaultAsc: true, priority: 14 },
  { key: 'home', label: 'HOME', w: 66, sortable: false, defaultAsc: false, priority: 15 },
  { key: 'away', label: 'AWAY', w: 66, sortable: false, defaultAsc: false, priority: 16 },
  { key: 'gf', label: 'GF', w: 34, sortable: true, defaultAsc: false, priority: 6 },
  { key: 'ga', label: 'GA', w: 34, sortable: true, defaultAsc: true, priority: 7 },
  { key: 'diff', label: 'DIFF', w: 42, sortable: true, defaultAsc: false, priority: 5 },
  { key: 'l10', label: 'L10', w: 64, sortable: false, defaultAsc: false, priority: 10 },
  { key: 'strk', label: 'STRK', w: 42, sortable: true, defaultAsc: false, priority: 9 },
];
const FORCED = new Set(['gp', 'w', 'l', 'otl', 'pts']);
const FORCED_W = COLS.filter((c) => FORCED.has(c.key)).reduce((s, c) => s + c.w, 0);
// Portrait shows a fixed, compact set that ends at GA (no DIFF/STRK/etc.).
const PORTRAIT_KEYS = new Set(['gp', 'w', 'l', 'otl', 'pts', 'gf', 'ga']);

const CONF_DIVISIONS: Record<string, string[]> = { Eastern: ['Atlantic', 'Metropolitan'], Western: ['Central', 'Pacific'] };

function rec(w: number, l: number, o: number) { return `${w}-${l}-${o}`; }
function sign(n: number) { return n > 0 ? `+${n}` : String(n); }
function pct(t: NhlStandingsTeam) { const g = (t.w + t.l + t.otl) * 2; return g > 0 ? ((t.w * 2 + t.otl) / g).toFixed(3).replace(/^0/, '') : '.000'; }

function cellText(t: NhlStandingsTeam, key: string): string {
  switch (key) {
    case 'gp': return String(t.gp);
    case 'w': return String(t.w);
    case 'l': return String(t.l);
    case 'otl': return String(t.otl);
    case 'pts': return String(t.pts);
    case 'pct': return pct(t);
    case 'rw': return String(t.rw);
    case 'row': return String(t.row);
    case 'sow': return String(t.sow);
    case 'sol': return String(t.sol);
    case 'home': return rec(t.homeW, t.homeL, t.homeOtl);
    case 'away': return rec(t.awayW, t.awayL, t.awayOtl);
    case 'gf': return String(t.gf);
    case 'ga': return String(t.ga);
    case 'diff': return sign(t.diff);
    case 'l10': return rec(t.l10W, t.l10L, t.l10Otl);
    case 'strk': return `${t.streakCode}${t.streakCount}`;
    default: return '';
  }
}

function sortVal(t: NhlStandingsTeam, key: string): number {
  switch (key) {
    case 'pct': { const g = (t.w + t.l + t.otl) * 2; return g > 0 ? (t.w * 2 + t.otl) / g : 0; }
    case 'strk': return t.streakCode === 'W' ? t.streakCount : -t.streakCount;
    case 'diff': return t.diff;
    default: return (t as any)[key] ?? 0;
  }
}

type Section = { confHeader: string | null; label: string; confKey?: 'Eastern' | 'Western'; teams: NhlStandingsTeam[] };

function buildSections(teams: NhlStandingsTeam[], view: ViewType, col: string, asc: boolean): Section[] {
  const sort = (list: NhlStandingsTeam[]) => [...list].sort((a, b) => (asc ? 1 : -1) * (sortVal(a, col) - sortVal(b, col)));
  if (view === 'league') return [{ confHeader: null, label: '', teams: sort(teams) }];
  if (view === 'conference') {
    return (['Eastern', 'Western'] as const).map((conf) => ({
      confHeader: null, label: conf.toUpperCase(), confKey: conf, // "EASTERN" / "WESTERN" (no "CONFERENCE")
      teams: sort(teams.filter((t) => t.conference === conf)),
    }));
  }
  const out: Section[] = [];
  for (const [conf, divs] of Object.entries(CONF_DIVISIONS)) {
    divs.forEach((div, di) => out.push({
      confHeader: di === 0 ? `${conf} Conference` : null,
      label: div.toUpperCase(), // "ATLANTIC", "METROPOLITAN", … (uppercase like other headers, no "DIVISION")
      teams: sort(teams.filter((t) => t.division === div)),
    }));
  }
  return out;
}

export function NhlStandings({ card }: { card?: string }) {
  const t = useTheme();
  const pill = leagueColors('nhl', t.mode === 'dark').pill;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const portrait = height >= width;
  const safeWidth = width - insets.left - insets.right; // keep columns clear of the Dynamic Island
  const teamMin = portrait ? 72 : 132; // portrait shows 3-letter abbrs (compact); landscape shows names
  const [view, setView] = useState<ViewType>('division');
  const [sortCol, setSortCol] = useState('pts');
  const [sortAsc, setSortAsc] = useState(false);

  const q = useQuery({ queryKey: ['nhl-standings-full'], queryFn: fetchNhlStandings });
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  // Columns that fit without horizontal scroll. Portrait = fixed compact set ending at GA; landscape =
  // greedy fill by priority within the SAFE width (so the last column isn't hidden under the notch).
  const visible = useMemo(() => {
    if (portrait) return COLS.filter((c) => PORTRAIT_KEYS.has(c.key));
    const budget = safeWidth - 24 - teamMin - FORCED_W;
    let used = 0;
    const keep = new Set(FORCED);
    for (const col of [...COLS].filter((c) => !FORCED.has(c.key)).sort((a, b) => a.priority - b.priority)) {
      if (used + col.w <= budget) { keep.add(col.key); used += col.w; }
    }
    return COLS.filter((c) => keep.has(c.key));
  }, [portrait, safeWidth, teamMin]);

  const sections = useMemo(() => (q.data ? buildSections(q.data, view, sortCol, sortAsc) : []), [q.data, view, sortCol, sortAsc]);

  function onSort(key: string) {
    const def = COLS.find((c) => c.key === key);
    if (!def?.sortable) return;
    if (key === sortCol) setSortAsc((a) => !a);
    else { setSortCol(key); setSortAsc(def.defaultAsc); }
  }

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError) return <StateView kind="error" message="Couldn’t load standings." onRetry={() => q.refetch()} />;

  return (
    <View style={{ flex: 1, paddingLeft: insets.left, paddingRight: insets.right }}>
      <ViewFilter value={view} onChange={setView} pill={pill} />
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {sections.map((sec, si) => (
          <View key={si}>
            {sec.confHeader ? <ConfSuperHeader label={sec.confHeader} /> : null}
            <HeaderRow label={sec.label} cols={visible} teamMin={teamMin} confKey={sec.confKey} sortCol={sortCol} sortAsc={sortAsc} onSort={onSort} />
            {sec.teams.map((team) => <TeamRow key={team.abbr} team={team} cols={visible} teamMin={teamMin} sortCol={sortCol} card={card} />)}
          </View>
        ))}
        <Text style={{ color: t.subtle, fontSize: 11, padding: 12 }}>
          Tap a column to sort; rotate for more stats.
        </Text>
      </ScrollView>
    </View>
  );
}

function confTint(theme: ReturnType<typeof useTheme>, confKey?: 'Eastern' | 'Western') {
  if (confKey === 'Eastern') return { bg: 'rgba(59,130,246,0.16)', fg: theme.mode === 'dark' ? '#93c5fd' : '#1e3a8a' };
  if (confKey === 'Western') return { bg: 'rgba(239,68,68,0.16)', fg: theme.mode === 'dark' ? '#fca5a5' : '#7f1d1d' };
  return { bg: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', fg: theme.sub };
}

function ViewFilter({ value, onChange, pill }: { value: ViewType; onChange: (v: ViewType) => void; pill: string }) {
  const t = useTheme();
  const onText = t.mode === 'dark' ? '#0b0b0b' : '#ffffff';
  return (
    <View style={styles.filter}>
      <View style={[styles.segment, { backgroundColor: t.card, borderColor: t.border }]}>
        {(['division', 'conference', 'league'] as ViewType[]).map((v) => {
          const on = v === value;
          return (
            <Pressable key={v} onPress={() => onChange(v)} style={[styles.segItem, on && { backgroundColor: pill }]}>
              <Text style={{ color: on ? onText : t.sub, fontSize: 13, fontWeight: on ? '700' : '600', textTransform: 'capitalize' }}>{v}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ConfSuperHeader({ label }: { label: string }) {
  const t = useTheme();
  const tint = confTint(t, label.startsWith('Eastern') ? 'Eastern' : 'Western');
  return (
    <View style={{ backgroundColor: tint.bg, paddingHorizontal: 12, paddingVertical: 8 }}>
      <Text style={{ color: tint.fg, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

function HeaderRow({ label, cols, teamMin, confKey, sortCol, sortAsc, onSort }: {
  label: string; cols: Col[]; teamMin: number; confKey?: 'Eastern' | 'Western'; sortCol: string; sortAsc: boolean; onSort: (k: string) => void;
}) {
  const t = useTheme();
  const tint = confTint(t, confKey);
  return (
    <View style={[styles.row, { backgroundColor: tint.bg, borderColor: t.border }]}>
      <Text style={[styles.teamCell, { minWidth: teamMin, color: tint.fg, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' }]} numberOfLines={1}>{label}</Text>
      {cols.map((c) => {
        const active = c.sortable && sortCol === c.key;
        return (
          <Pressable key={c.key} onPress={() => onSort(c.key)} style={{ width: c.w }}>
            <Text style={{ color: active ? t.text : t.sub, fontSize: 10, fontWeight: '700', textAlign: 'center' }}>
              {c.label}{active ? (sortAsc ? ' ↑' : ' ↓') : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TeamRow({ team, cols, teamMin, sortCol, card }: { team: NhlStandingsTeam; cols: Col[]; teamMin: number; sortCol: string; card?: string }) {
  const t = useTheme();
  return (
    <Link href={{ pathname: '/teams/[teamId]', params: { teamId: team.routeId } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.row, { backgroundColor: card ?? t.card, borderColor: t.border }])}>
        <View style={[styles.teamCell, { minWidth: teamMin }]}>
          <TeamLogo uri={team.logo} darkUri={team.darkLogo} size={22} />
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
            {nhlNickname(team.abbr, team.name)}
          </Text>
        </View>
        {cols.map((c) => {
          let color = c.key === sortCol ? t.text : t.sub;
          if (c.key === 'diff') color = team.diff > 0 ? '#22c55e' : team.diff < 0 ? '#ef4444' : t.sub;
          if (c.key === 'strk') color = team.streakCode === 'W' ? '#22c55e' : '#ef4444';
          const bold = c.key === 'pts' || c.key === sortCol;
          return (
            <Text key={c.key} style={{ width: c.w, textAlign: 'center', fontSize: 12, color, fontWeight: bold ? '700' : '400', fontVariant: ['tabular-nums'] }}>
              {cellText(team, c.key)}
            </Text>
          );
        })}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  filter: { paddingHorizontal: 12, paddingBottom: 8 },
  segment: { flexDirection: 'row', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 2, gap: 2 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  teamCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 6 },
});
