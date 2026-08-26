// The game detail body, split out of app/games/[gameId].tsx so it can render in two places:
// full-screen (phone push navigation) and inside the right pane of the iPad split view on Scores.
// Route wiring — params, screen title — stays in the route file.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GameBoxScore } from '@/components/game-box-score';
import { SegmentedFilter } from '@/components/segmented-filter';
import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { canonicalTeamId } from '@/lib/api';
import { shortDate, timeOfDay } from '@/lib/format';
import { fetchGameDetail } from '@/lib/game';
import type { GameDetail, GDTeam, GoalInfo } from '@/lib/game-detail-types';
import { useLayout } from '@/lib/layout';
import { useTheme } from '@/lib/theme';

// Shared by the screen (for its title) and the body below — same query key, so React Query serves
// both from one fetch.
export function useGameDetail(gameId: string) {
  return useQuery({
    queryKey: ['game', gameId],
    queryFn: () => fetchGameDetail(gameId),
    refetchInterval: (query) => (query.state.data?.status === 'LIVE' ? 15_000 : false),
  });
}

// Below this the two-column layout gets cramped — it's the pane width that matters, not the
// window's, so the split view passes its measured pane in.
const TWO_COL_MIN = 900;

export function GameDetailBody({
  gameId, away, home, paneWidth,
}: {
  gameId: string;
  away?: string;
  home?: string;
  /** Width of the container this renders into. Defaults to the whole window. */
  paneWidth?: number;
}) {
  const t = useTheme();
  const layout = useLayout();
  const [tab, setTab] = useState('Summary');
  const q = useGameDetail(gameId);

  const g = q.data;
  const r = g?.rosters;
  const hasBox = !!r && [r.away, r.home].some((x) => x.forwards.length || x.defense.length || x.goalies.length);
  const twoCol = (paneWidth ?? layout.width) >= TWO_COL_MIN;

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError || !g) {
    return <StateView kind="empty" title="Game details unavailable" message="We couldn’t load this game." onRetry={() => q.refetch()} />;
  }

  const head = (
    <>
      <Scoreboard g={g} awayId={away} homeId={home} />
      {g.periodScores?.length ? <LineScore g={g} /> : null}
    </>
  );

  const summary = g.status === 'UPCOMING'
    ? <Upcoming key="upcoming" g={g} />
    : hasBox ? (
      <View key="summary" style={{ gap: 12 }}>
        <SegmentedFilter options={['Summary', 'Box Score']} value={tab} onChange={setTab} pill={t.accent} flush />
        {tab === 'Box Score' ? <GameBoxScore g={g} /> : <ScoringCard g={g} />}
      </View>
    ) : <ScoringCard key="summary" g={g} />;

  const aside = g.status === 'UPCOMING' ? null : (
    <>
      <ThreeStarsCard g={g} />
      <PenaltiesCard g={g} />
    </>
  );

  const pad = layout.regular ? layout.gutter : 12;

  if (twoCol) {
    return (
      <ScrollView contentContainerStyle={{ width: '100%', maxWidth: layout.readWidth, alignSelf: 'center', padding: pad, paddingBottom: 28, gap: 12 }}>
        {head}
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.35, gap: 12 }}>{summary}</View>
          {aside ? <View style={{ flex: 1, gap: 12 }}>{aside}</View> : null}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 820, alignSelf: 'center', padding: pad, paddingBottom: 28, gap: 12 }}>
      {head}
      {/* Single column keeps the phone's order: stars, then scoring, then penalties. */}
      {g.status === 'UPCOMING' ? summary : <><ThreeStarsCard g={g} />{summary}<PenaltiesCard g={g} /></>}
    </ScrollView>
  );
}

function TeamName({ team, routeId }: { team: GDTeam; routeId?: string }) {
  const t = useTheme();
  const label = `${team.name} ${team.nickname}`.trim() || team.abbr;
  const inner = (
    <View style={styles.teamRow}>
      <TeamLogo uri={team.logo} darkUri={team.darkLogo} size={36} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
  if (!routeId) return inner;
  // Canonicalise: these ids come from the scoreboard, where CHL teams are keyed by league code
  // ("qmjhl-2") rather than the client code the /teams route and its endpoint expect.
  return <Link href={{ pathname: '/teams/[teamId]', params: { teamId: canonicalTeamId(routeId) } }} asChild><Pressable style={{ flex: 1 }}>{inner}</Pressable></Link>;
}

function Scoreboard({ g, awayId, homeId }: { g: GameDetail; awayId?: string; homeId?: string }) {
  const t = useTheme();
  const played = g.status !== 'UPCOMING';
  const live = g.status === 'LIVE';
  const row = (team: GDTeam, id?: string) => (
    <View style={styles.sbRow}>
      <TeamName team={team} routeId={id} />
      {played ? <Text style={{ color: t.text, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' }}>{team.score ?? 0}</Text> : null}
    </View>
  );
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={{ color: live ? t.live : t.sub, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{g.statusLabel}</Text>
      {row(g.awayTeam, awayId)}
      {row(g.homeTeam, homeId)}
      <Text style={{ color: t.subtle, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
        {[g.seriesInfo, g.venue, g.venueLocation, g.network && `📺 ${g.network}`].filter(Boolean).join(' · ')}
      </Text>
    </View>
  );
}

function LineScore({ g }: { g: GameDetail }) {
  const t = useTheme();
  const cols = g.periodScores ?? [];
  const cell = (v: number | null) => (v == null ? '–' : String(v));
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, paddingVertical: 8 }]}>
      <View style={styles.lsRow}>
        <Text style={[styles.lsTeam, { color: t.sub }]} />
        {cols.map((c, i) => <Text key={i} style={[styles.lsCell, { color: t.sub, fontWeight: '700' }]}>{c.label}</Text>)}
        <Text style={[styles.lsCell, { color: t.sub, fontWeight: '700' }]}>T</Text>
      </View>
      {(['away', 'home'] as const).map((side) => {
        const team = side === 'away' ? g.awayTeam : g.homeTeam;
        const total = cols.reduce((s, c) => s + (c[side] ?? 0), 0);
        return (
          <View key={side} style={styles.lsRow}>
            <Text style={[styles.lsTeam, { color: t.text, fontWeight: '600' }]}>{team.abbr}</Text>
            {cols.map((c, i) => <Text key={i} style={[styles.lsCell, { color: t.text }]}>{cell(c[side])}</Text>)}
            <Text style={[styles.lsCell, { color: t.text, fontWeight: '800' }]}>{total}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Upcoming({ g }: { g: GameDetail }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.section, { color: t.sub }]}>PREVIEW</Text>
      {g.startTimeUTC ? <Text style={{ color: t.text, fontSize: 14, marginBottom: g.preview ? 8 : 0 }}>{shortDate(g.startTimeUTC)} · {timeOfDay(g.startTimeUTC)}</Text> : null}
      <Text style={{ color: g.preview ? t.text : t.subtle, fontSize: 14, lineHeight: 21 }}>
        {g.preview || 'A preview for this game isn’t available yet.'}
      </Text>
    </View>
  );
}

const logoFor = (g: GameDetail, abbr: string) => (abbr === g.awayTeam.abbr ? g.awayTeam.logo : g.homeTeam.logo);
const darkLogoFor = (g: GameDetail, abbr: string) => (abbr === g.awayTeam.abbr ? g.awayTeam.darkLogo : g.homeTeam.darkLogo);

function ThreeStarsCard({ g }: { g: GameDetail }) {
  const t = useTheme();
  if (!g.threeStars?.length) return null;
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.section, { color: t.sub }]}>THREE STARS</Text>
      {g.threeStars.map((s) => (
        <View key={s.star} style={styles.starRow}>
          <Text numberOfLines={1} style={{ color: t.accent, fontSize: 14, fontWeight: '800', minWidth: 46 }}>{'★'.repeat(s.star)}</Text>
          <Text style={{ flex: 1, color: t.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{s.name} <Text style={{ color: t.sub }}>{s.teamAbbr}</Text></Text>
          <Text style={{ color: t.sub, fontSize: 13 }}>{s.goals}G {s.assists}A</Text>
        </View>
      ))}
    </View>
  );
}

function ScoringCard({ g }: { g: GameDetail }) {
  const t = useTheme();
  const hasScoring = g.scoring?.some((p) => p.goals.length);
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.section, { color: t.sub }]}>SCORING</Text>
      {hasScoring ? g.scoring.map((p, pi) => (
        <View key={pi} style={{ marginBottom: 6 }}>
          <Text style={{ color: t.subtle, fontSize: 12, fontWeight: '700', marginTop: 6, marginBottom: 2 }}>{p.label}</Text>
          {p.goals.length
            ? p.goals.map((goal, gi) => <GoalRow key={gi} goal={goal} logo={logoFor(g, goal.teamAbbr)} darkLogo={darkLogoFor(g, goal.teamAbbr)} />)
            : <Text style={{ color: t.subtle, fontSize: 12 }}>No goals</Text>}
        </View>
      )) : <Text style={{ color: t.subtle, fontSize: 13 }}>No scoring yet.</Text>}
    </View>
  );
}

function PenaltiesCard({ g }: { g: GameDetail }) {
  const t = useTheme();
  if (!g.penalties?.some((p) => p.penalties.length)) return null;
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.section, { color: t.sub }]}>PENALTIES</Text>
      {g.penalties.flatMap((p, pi) => p.penalties.map((pen, i) => (
        <View key={`${pi}-${i}`} style={styles.penRow}>
          <Text style={{ color: t.sub, fontSize: 15, fontWeight: '600', width: 46, fontVariant: ['tabular-nums'] }}>{pen.time}</Text>
          <TeamLogo uri={logoFor(g, pen.teamAbbr)} darkUri={darkLogoFor(g, pen.teamAbbr)} size={22} />
          <Text style={{ flex: 1, color: t.text, fontSize: 13 }} numberOfLines={1}>{pen.player} · {pen.description}</Text>
          <Text style={{ color: t.sub, fontSize: 12 }}>{pen.duration}'</Text>
        </View>
      )))}
    </View>
  );
}

function GoalRow({ goal, logo, darkLogo }: { goal: GoalInfo; logo?: string; darkLogo?: string }) {
  const t = useTheme();
  const assists = goal.assists?.map((a) => a.name).join(', ');
  return (
    <View style={styles.goalRow}>
      <Text style={{ color: t.sub, fontSize: 16, fontWeight: '600', width: 46, fontVariant: ['tabular-nums'] }}>{goal.time}</Text>
      <TeamLogo uri={logo} darkUri={darkLogo} size={24} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
          {goal.scorer}{goal.goalType ? <Text style={{ color: t.accent }}> {goal.goalType}</Text> : null}
        </Text>
        {assists ? <Text style={{ color: t.sub, fontSize: 12 }} numberOfLines={1}>{assists}</Text> : null}
      </View>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{goal.awayScore}-{goal.homeScore}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 4 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 6 },
  sbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  teamRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  lsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  lsTeam: { width: 44, fontSize: 13 },
  lsCell: { flex: 1, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'] },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  penRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
