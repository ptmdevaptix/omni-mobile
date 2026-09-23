import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import type { GDTeam } from '@/lib/game-detail-types';
import {
  fetchGamePreview, previewSupported, seriesSummary,
  type LeaderSet, type PreviewTeamStats, type SeriesGame,
} from '@/lib/game-preview';
import type { ScheduleGame } from '@/lib/team-types';
import { useTheme } from '@/lib/theme';

/**
 * What there is to say about a game before it is played: how the season series stands, how each club
 * has been going, who leads each of them, and how the two compare.
 *
 * The web lays the leaders and stats out as away | label | home. That survives the move to a phone —
 * the label column is short and the values are short — so the shape is kept rather than stacked.
 *
 * Silent when the league's feed cannot answer (the route 400s on an unsupported prefix) and when the
 * answer comes back empty, which is the normal case on the first day of a season.
 */
export function GamePreview({ gameId, away, home }: { gameId: string; away: GDTeam; home: GDTeam }) {
  const t = useTheme();
  const supported = previewSupported(gameId);
  const q = useQuery({
    queryKey: ['game-preview', gameId],
    queryFn: () => fetchGamePreview(gameId),
    enabled: supported,
    staleTime: 5 * 60_000,
  });
  const d = q.data;
  if (!supported || !d || d.error) return null;

  const series = d.seasonSeries ?? [];
  const summary = seriesSummary(series, away.abbr, home.abbr);
  const hasLeaders = !!(d.awayLeaders?.points?.[0] || d.homeLeaders?.points?.[0]);
  const hasStats = (d.awayStats?.gp ?? 0) > 0 || (d.homeStats?.gp ?? 0) > 0;
  const hasForm = !!(d.awayLast5?.length || d.homeLast5?.length);
  if (!series.length && !hasLeaders && !hasStats && !hasForm) return null;

  return (
    <>
      {series.length ? (
        <Card title="SEASON SERIES">
          {summary ? <Text style={{ color: t.sub, fontSize: 13, marginBottom: 6 }}>{summary}</Text> : null}
          {series.map((g, i) => <SeriesRow key={i} g={g} />)}
        </Card>
      ) : null}

      {hasForm ? (
        <Card title="LAST 5">
          <Form abbr={away.abbr} games={d.awayLast5 ?? []} />
          <View style={{ height: 10 }} />
          <Form abbr={home.abbr} games={d.homeLast5 ?? []} />
        </Card>
      ) : null}

      {hasLeaders ? (
        <Card title="TEAM LEADERS">
          <Heads away={away} home={home} />
          {LEADER_ROWS.map(({ label, key }) => (
            <CompareRow
              key={key}
              label={label}
              away={leaderText(d.awayLeaders, key)}
              home={leaderText(d.homeLeaders, key)}
            />
          ))}
        </Card>
      ) : null}

      {hasStats ? (
        <Card title="TEAM STATS">
          <Heads away={away} home={home} />
          {statRows(d.awayStats, d.homeStats).map((r) => (
            <CompareRow key={r.label} label={r.label} away={r.away} home={r.home} awayBetter={r.awayBetter} homeBetter={r.homeBetter} />
          ))}
        </Card>
      ) : null}
    </>
  );
}

const LEADER_ROWS: { label: string; key: keyof LeaderSet }[] = [
  { label: 'Points', key: 'points' },
  { label: 'Goals', key: 'goals' },
  { label: 'Assists', key: 'assists' },
  { label: 'TOI/GP', key: 'toi' },
  { label: 'Wins', key: 'goalie' },
];

function leaderText(set: LeaderSet | undefined, key: keyof LeaderSet): string | null {
  const l = set?.[key]?.[0];
  return l ? `${l.name} (${l.value})` : null;
}

function statRows(a: PreviewTeamStats, h: PreviewTeamStats) {
  const per = (n: number, gp: number) => (gp > 0 ? n / gp : 0);
  const dec = (v: number) => v.toFixed(1);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const gpgA = per(a.gf, a.gp), gpgH = per(h.gf, h.gp);
  const gaaA = per(a.ga, a.gp), gaaH = per(h.ga, h.gp);
  const rows = [
    { label: 'Goals/Game', away: dec(gpgA), home: dec(gpgH), awayBetter: gpgA > gpgH, homeBetter: gpgH > gpgA },
    { label: 'Goals Against/Game', away: dec(gaaA), home: dec(gaaH), awayBetter: gaaA < gaaH, homeBetter: gaaH < gaaA },
  ];
  // A feed that does not count shots reports zero for both, which would read as a tie at 0.0 rather
  // than as an absence — so the rows only appear when someone actually has the number.
  if (a.sf > 0 || h.sf > 0) {
    rows.push({ label: 'Shots/Game', away: dec(a.sf), home: dec(h.sf), awayBetter: a.sf > h.sf, homeBetter: h.sf > a.sf });
    rows.push({ label: 'Shots Against/Game', away: dec(a.sa), home: dec(h.sa), awayBetter: a.sa < h.sa, homeBetter: h.sa < a.sa });
  }
  if (a.ppPct > 0 || h.ppPct > 0) {
    rows.push({ label: 'Power Play', away: pct(a.ppPct), home: pct(h.ppPct), awayBetter: a.ppPct > h.ppPct, homeBetter: h.ppPct > a.ppPct });
  }
  if (a.pkPct > 0 || h.pkPct > 0) {
    rows.push({ label: 'Penalty Kill', away: pct(a.pkPct), home: pct(h.pkPct), awayBetter: a.pkPct > h.pkPct, homeBetter: h.pkPct > a.pkPct });
  }
  return rows;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.section, { color: t.sub }]}>{title}</Text>
      {children}
    </View>
  );
}

function Heads({ away, home }: { away: GDTeam; home: GDTeam }) {
  const t = useTheme();
  const side = (team: GDTeam, align: 'flex-start' | 'flex-end') => (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: align, gap: 5 }}>
      {align === 'flex-end' ? <Text style={[styles.head, { color: t.sub }]}>{team.abbr}</Text> : null}
      <TeamLogo uri={team.logo} darkUri={team.darkLogo} size={18} />
      {align === 'flex-start' ? <Text style={[styles.head, { color: t.sub }]}>{team.abbr}</Text> : null}
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 6 }}>
      {side(away, 'flex-start')}
      <View style={{ width: 96 }} />
      {side(home, 'flex-end')}
    </View>
  );
}

/** away | label | home — the label column names the measure so neither value needs a caption. */
function CompareRow({ label, away, home, awayBetter, homeBetter }: {
  label: string; away: string | null; home: string | null; awayBetter?: boolean; homeBetter?: boolean;
}) {
  const t = useTheme();
  const val = (v: string | null, better?: boolean, align: 'left' | 'right' = 'left') => (
    <Text
      style={{ flex: 1, textAlign: align, fontSize: 12, color: better ? t.text : t.sub, fontWeight: better ? '700' : '400' }}
      numberOfLines={1}>
      {v ?? '–'}
    </Text>
  );
  return (
    <View style={[styles.compare, { borderTopColor: t.border }]}>
      {val(away, awayBetter, 'left')}
      <Text style={{ width: 96, textAlign: 'center', fontSize: 10, color: t.subtle, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </Text>
      {val(home, homeBetter, 'right')}
    </View>
  );
}

function SeriesRow({ g }: { g: SeriesGame }) {
  const t = useTheme();
  const awayWon = g.awayScore > g.homeScore;
  const w = awayWon ? g : { awayAbbr: g.homeAbbr, awayScore: g.homeScore, homeAbbr: g.awayAbbr, homeScore: g.awayScore };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
      <Text style={{ width: 52, color: t.subtle, fontSize: 11 }}>{fmtDate(g.date)}</Text>
      <Text style={{ flex: 1, fontSize: 12 }} numberOfLines={1}>
        <Text style={{ color: awayWon ? t.text : t.sub, fontWeight: awayWon ? '700' : '400' }}>{g.awayAbbr}</Text>
        <Text style={{ color: t.subtle }}> @ </Text>
        <Text style={{ color: !awayWon ? t.text : t.sub, fontWeight: !awayWon ? '700' : '400' }}>{g.homeAbbr}</Text>
      </Text>
      <Text style={{ fontSize: 12, color: t.sub }} numberOfLines={1}>
        <Text style={{ color: t.text, fontWeight: '700' }}>{w.awayAbbr} {w.awayScore}</Text>
        <Text>, {w.homeAbbr} {w.homeScore}</Text>
        {g.overtime ? <Text style={{ color: t.subtle }}> ({g.overtime})</Text> : null}
      </Text>
    </View>
  );
}

/** A club's last five, as a row of W/L pills with the scores beneath — a phone's version of a table. */
function Form({ abbr, games }: { abbr: string; games: ScheduleGame[] }) {
  const t = useTheme();
  if (!games.length) return null;
  return (
    <View>
      <Text style={{ color: t.subtle, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>{abbr}</Text>
      {/* Fixed-width columns, not flex: a club with two games played would otherwise spread those
          two across the whole card and read as a five-game row with holes in it. */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {games.map((g, i) => {
          const us = g.teamScore, them = g.opponentScore;
          const won = us != null && them != null && us > them;
          const tone = us == null || them == null ? t.subtle : won ? '#10b981' : '#ef4444';
          return (
            <View key={i} style={{ width: 52, alignItems: 'center', gap: 2 }}>
              <View style={{ backgroundColor: `${tone}1f`, borderColor: `${tone}66`, borderWidth: StyleSheet.hairlineWidth, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: tone, fontSize: 11, fontWeight: '800' }}>{us == null || them == null ? '–' : won ? 'W' : 'L'}</Text>
              </View>
              <Text style={{ color: t.subtle, fontSize: 10 }} numberOfLines={1}>
                {us == null || them == null ? '' : `${us}-${them}`}
              </Text>
              <Text style={{ color: t.subtle, fontSize: 9 }} numberOfLines={1}>
                {g.isHome ? '' : '@'}{g.opponentAbbr}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function fmtDate(d: string): string {
  const dt = new Date(d.length <= 10 ? `${d}T12:00:00Z` : d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, marginBottom: 10 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 8 },
  head: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  compare: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
});
