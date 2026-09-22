import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { NewsCard } from '@/components/news-card';
import { MiniStandings } from '@/components/standings-card';
import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { leagueOf } from '@/lib/api';
import { seasonOf, shortDate, timeOfDay } from '@/lib/format';
import { fetchAllTeams, leagueColors, type LeagueId } from '@/lib/leagues';
import { fetchTeamNews } from '@/lib/news';
import { NHL_TEAM_NAMES } from '@/lib/nhl-teams';
import { fetchTeamHome } from '@/lib/team';
import type { StandingsCardGroup, StandingsZone } from '@/lib/standings-cards';
import type { Leader, MiniGame, TeamHomeData } from '@/lib/team-types';
import { useTheme } from '@/lib/theme';

export function TeamHome({ teamId }: { teamId: string }) {
  const t = useTheme();
  const q = useQuery({ queryKey: ['team-home', teamId], queryFn: () => fetchTeamHome(teamId) });

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError) return <StateView kind="error" message="Couldn’t load the team home." onRetry={() => q.refetch()} />;
  const d = q.data as TeamHomeData | undefined;
  if (!d) return <StateView kind="empty" title="Nothing here yet" />;

  const recent = (d.lastFive ?? []).slice(-3);
  const upcoming = (d.nextTen ?? []).slice(0, 3);
  const games = [...recent, ...upcoming];
  // Title follows the contents. Before a season starts there are no completed games to show for the
  // NHL or NCAA — both scope to the current season — so "Recent & Upcoming" promised a half the card
  // did not have. (The AHL and CHL do fill it, but with LAST season's games, which is why they looked
  // like the ones that worked.)
  const cardTitle = recent.length ? 'Recent & Upcoming' : 'Upcoming';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 12, paddingBottom: 24, gap: 8 }}>
      <TopNewsCard teamId={teamId} />

      {games.length ? (
        <Card title={cardTitle}>
          {games.map((g, i) => {
            // Between the end of one season and the start of the next, this list jumps months without
            // saying so. A rule is enough to signal the break — no label needed.
            const newSeason = i > 0 && seasonOf(games[i - 1].date) !== seasonOf(g.date);
            return (
              <View key={`${g.id}-${i}`}>
                {newSeason ? <SeasonDivider /> : null}
                <MiniGameRow g={g} />
              </View>
            );
          })}
        </Card>
      ) : null}

      {d.leaders?.points?.length ? (
        <Card title="Team Leaders">
          <LeaderRow label="Points" leaders={d.leaders.points} />
          <LeaderRow label="Goals" leaders={d.leaders.goals} />
          <LeaderRow label="Assists" leaders={d.leaders.assists} />
        </Card>
      ) : null}

      {/* `> 0`, not `!= null` — the AHL/CHL/USHL endpoints hardcode 0 for special teams because
          HockeyTech doesn't supply them, and 0 is not null. Rendering it claimed a 0.0% power play
          and a rank of #0/0. This matches the web's guard in components/team-home.tsx. */}
      {d.ppPct > 0 || d.pkPct > 0 ? (
        <Card title="Special Teams">
          <View style={styles.stRow}>
            <Stat label="PP%" val={`${d.ppPct?.toFixed(1)}%`} rank={d.ppRank} total={d.totalTeams} />
            <Stat label="PK%" val={`${d.pkPct?.toFixed(1)}%`} rank={d.pkRank} total={d.totalTeams} />
            <Stat label="SOG/G" val={d.sogPerGame?.toFixed(1)} rank={d.sogPerGameRank} total={d.totalTeams} />
          </View>
        </Card>
      ) : null}

      {d.division?.length ? <DivisionCard teamId={teamId} d={d} /> : null}
    </ScrollView>
  );
}

// Most recent article for this team, shown at the top of the home tab (replaces the old playoff line).
function TopNewsCard({ teamId }: { teamId: string }) {
  const q = useQuery({ queryKey: ['team-news-top', teamId], queryFn: () => fetchTeamNews(teamId, 10), staleTime: 5 * 60_000 });
  const top = q.data?.[0];
  if (!top) return null;
  return <NewsCard a={top} />;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.cardTitle, { color: t.sub }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

// Season break. Tinted with the accent and inset from the edges so it reads as a division between
// groups rather than as another row separator.
function SeasonDivider() {
  const t = useTheme();
  return <View style={[styles.seasonDivider, { backgroundColor: t.accent }]} />;
}

function MiniGameRow({ g }: { g: MiniGame }) {
  const t = useTheme();
  const rc = g.result === 'W' ? '#22c55e' : g.result === 'L' ? '#ef4444' : t.sub;
  return (
    <View style={styles.mg}>
      <Text style={{ width: 46, color: t.sub, fontSize: 12 }}>{shortDate(g.date)}</Text>
      <Text style={{ width: 18, color: t.subtle, fontSize: 12 }}>{g.isHome ? 'vs' : '@'}</Text>
      <TeamLogo uri={g.opponentLogo} size={20} />
      <Text style={{ flex: 1, color: t.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{g.opponentAbbr}</Text>
      {g.state === 'FINAL' ? (
        <Text style={{ color: rc, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{g.result} {g.teamScore}-{g.opponentScore}{g.overtime ? ` ${g.overtime}` : ''}</Text>
      ) : (
        <Text style={{ color: t.sub, fontSize: 12 }}>{timeOfDay(g.startTimeUTC) || 'TBD'}</Text>
      )}
    </View>
  );
}

function LeaderRow({ label, leaders }: { label: string; leaders: Leader[] }) {
  const t = useTheme();
  const top = leaders[0];
  if (!top) return null;
  return (
    <View style={styles.ldr}>
      <Text style={{ width: 64, color: t.sub, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <Text style={{ flex: 1, color: t.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{top.name}</Text>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{top.value}</Text>
    </View>
  );
}

function Stat({ label, val, rank, total }: { label: string; val: string; rank?: number; total?: number }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ color: t.sub, fontSize: 11, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{val}</Text>
      {rank ? <Text style={{ color: t.subtle, fontSize: 10 }}>#{rank}{total ? `/${total}` : ''}</Text> : null}
    </View>
  );
}

/**
 * The team page's standings card, in the standings page's own look (MiniStandings): rank, rail,
 * crest, name, record, points, with the club's own row picked out. Bands only where the rule is a
 * fixed rank in THIS table — the NHL's division top three, and the European leagues' cut lines;
 * the AHL, CHL, USHL and ECHL seed by a rule the division table cannot draw, so they show none.
 * Mirrors DivisionSnippet in the web's components/team-home.tsx.
 */
function DivisionCard({ teamId, d }: { teamId: string; d: TeamHomeData }) {
  const t = useTheme();
  const league = leagueOf(teamId);
  const nhl = league === 'NHL';
  const euro = league === 'SHL' || league === 'LIIGA' || league === 'ELH';
  const ncaa = league === 'NCAA';
  // The place a non-NHL row is named by, from the team directory (lib/team-name rule).
  const dir = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });
  const placeById = useMemo(() => new Map((dir.data ?? []).map((tm) => [tm.id, tm.location])), [dir.data]);
  const me = teamId.toLowerCase();
  const rows = d.division.map((dt) => {
    const id = dt.id ?? dt.abbr.toLowerCase();
    // The record in the league's own order: W-L-T for college, W-OTW-OTL-L in Europe (the shared
    // row folds overtime wins into `wins`; `otw` carries them separately where the league splits them).
    const record = euro && dt.otw != null ? `${dt.wins - dt.otw}-${dt.otw}-${dt.otl}-${dt.losses}` : `${dt.wins}-${dt.losses}-${dt.otl}`;
    return {
      id, abbr: dt.abbr, logo: dt.logo, darkLogo: dt.darkLogo, gp: dt.gp, record, pts: dt.points,
      name: nhl ? NHL_TEAM_NAMES[dt.abbr.toUpperCase()]?.nickname ?? dt.name : placeById.get(id) || dt.name,
      us: id === me || dt.abbr?.toLowerCase() === me,
      badge: dt.clinch ? { label: dt.clinch.toUpperCase(), kind: 'in' as const } : undefined,
    };
  });
  const [direct = 0, playIn = 0, safe = 0] = d.cuts ?? [];
  const size = rows.length;
  const group: StandingsCardGroup = {
    key: 'division', title: d.divisionName || 'Division', rows,
    railColor: leagueColors(leagueIdOf(league), t.mode === 'dark').pill,
    recordFormat: euro ? 'W-OTW-OTL-L' : ncaa ? 'W-L-T' : 'W-L-OTL',
    recordLabel: euro ? 'W-OTW-OTL-L' : ncaa ? 'W-L-T' : 'Record',
    ...(nhl ? {
      lines: [{ after: 3, label: 'Division top 3 — automatic' }],
      zoneOf: (rank: number): StandingsZone => (rank <= 3 ? 'in' : 'out'),
      legend: [{ zone: 'in' as const, label: 'Division top 3' }],
    } : euro && direct ? {
      lines: [
        { after: direct, label: 'Playoff line' },
        ...(playIn ? [{ after: playIn, label: 'Play-in line' }] : []),
        ...(safe && safe < size ? [{ after: safe, label: 'Relegation line' }] : []),
      ],
      zoneOf: (rank: number): StandingsZone => (rank <= direct ? 'in' : playIn && rank <= playIn ? 'bubble' : safe && rank > safe && safe < size ? 'drop' : 'out'),
      legend: [{ zone: 'in' as const, label: 'Playoffs' }, { zone: 'bubble' as const, label: 'Play-in' }, ...(safe && safe < size ? [{ zone: 'drop' as const, label: 'Relegation' }] : [])],
    } : {}),
  };
  return <MiniStandings group={group} />;
}

// The picker id whose color a club's card wears: the member league for the CHL and Jr A blocks
// resolves through the club's id prefix; the rest map by name.
function leagueIdOf(league: string): LeagueId {
  const l = league.toLowerCase();
  if (l === 'chl') return 'ohl';
  if (l === 'cjra') return 'bchl';
  return l as LeagueId;
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 2 },
  cardTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 6 },
  mg: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  seasonDivider: { height: 1, borderRadius: 1, marginVertical: 7, marginHorizontal: 2, opacity: 0.45 },
  ldr: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  stRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 },
});
