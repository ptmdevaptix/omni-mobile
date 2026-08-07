import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GameBoxScore } from '@/components/game-box-score';
import { SegmentedFilter } from '@/components/segmented-filter';
import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { shortDate, timeOfDay } from '@/lib/format';
import { fetchGameDetail } from '@/lib/game';
import type { GameDetail, GDTeam, GoalInfo } from '@/lib/game-detail-types';
import { useTheme } from '@/lib/theme';

export default function GameScreen() {
  const t = useTheme();
  const { gameId, away, home } = useLocalSearchParams<{ gameId: string; away?: string; home?: string }>();

  const [tab, setTab] = useState('Summary');
  const q = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => fetchGameDetail(gameId),
    refetchInterval: (query) => (query.state.data?.status === 'LIVE' ? 15_000 : false),
  });

  const g = q.data;
  const r = g?.rosters;
  const hasBox = !!r && [r.away, r.home].some((x) => x.forwards.length || x.defense.length || x.goalies.length);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: g ? `${g.awayTeam.abbr} @ ${g.homeTeam.abbr}` : 'Game' }} />
      {q.isLoading ? (
        <StateView kind="loading" />
      ) : q.isError || !g ? (
        <StateView kind="empty" title="Game details unavailable" message="We couldn’t load this game." onRetry={() => q.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28, gap: 12 }}>
          <Scoreboard g={g} awayId={away} homeId={home} />
          {g.periodScores?.length ? <LineScore g={g} /> : null}
          {g.status === 'UPCOMING' ? (
            <Upcoming g={g} />
          ) : hasBox ? (
            <>
              <SegmentedFilter options={['Summary', 'Box Score']} value={tab} onChange={setTab} pill={t.accent} flush />
              {tab === 'Box Score' ? <GameBoxScore g={g} /> : <PlayedBody g={g} />}
            </>
          ) : (
            <PlayedBody g={g} />
          )}
        </ScrollView>
      )}
    </View>
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
  return <Link href={{ pathname: '/teams/[teamId]', params: { teamId: routeId } }} asChild><Pressable style={{ flex: 1 }}>{inner}</Pressable></Link>;
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

function PlayedBody({ g }: { g: GameDetail }) {
  const t = useTheme();
  const hasScoring = g.scoring?.some((p) => p.goals.length);
  const logoFor = (abbr: string) => (abbr === g.awayTeam.abbr ? g.awayTeam.logo : g.homeTeam.logo);
  const darkLogoFor = (abbr: string) => (abbr === g.awayTeam.abbr ? g.awayTeam.darkLogo : g.homeTeam.darkLogo);
  return (
    <>
      {g.threeStars?.length ? (
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
      ) : null}

      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.section, { color: t.sub }]}>SCORING</Text>
        {hasScoring ? g.scoring.map((p, pi) => (
          <View key={pi} style={{ marginBottom: 6 }}>
            <Text style={{ color: t.subtle, fontSize: 12, fontWeight: '700', marginTop: 6, marginBottom: 2 }}>{p.label}</Text>
            {p.goals.length ? p.goals.map((goal, gi) => <GoalRow key={gi} goal={goal} logo={logoFor(goal.teamAbbr)} darkLogo={darkLogoFor(goal.teamAbbr)} />) : <Text style={{ color: t.subtle, fontSize: 12 }}>No goals</Text>}
          </View>
        )) : <Text style={{ color: t.subtle, fontSize: 13 }}>No scoring yet.</Text>}
      </View>

      {g.penalties?.some((p) => p.penalties.length) ? (
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.section, { color: t.sub }]}>PENALTIES</Text>
          {g.penalties.flatMap((p, pi) => p.penalties.map((pen, i) => (
            <View key={`${pi}-${i}`} style={styles.penRow}>
              <Text style={{ color: t.sub, fontSize: 15, fontWeight: '600', width: 46, fontVariant: ['tabular-nums'] }}>{pen.time}</Text>
              <TeamLogo uri={logoFor(pen.teamAbbr)} darkUri={darkLogoFor(pen.teamAbbr)} size={22} />
              <Text style={{ flex: 1, color: t.text, fontSize: 13 }} numberOfLines={1}>{pen.player} · {pen.description}</Text>
              <Text style={{ color: t.sub, fontSize: 12 }}>{pen.duration}'</Text>
            </View>
          )))}
        </View>
      ) : null}
    </>
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
