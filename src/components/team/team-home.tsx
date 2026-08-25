import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { NewsCard } from '@/components/news-card';
import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { seasonOf, shortDate, timeOfDay } from '@/lib/format';
import { fetchTeamNews } from '@/lib/news';
import { fetchTeamHome } from '@/lib/team';
import type { DivTeam, Leader, MiniGame, TeamHomeData } from '@/lib/team-types';
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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 12, paddingBottom: 24, gap: 8 }}>
      <TopNewsCard teamId={teamId} />

      {games.length ? (
        <Card title="Recent & Upcoming">
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

      {d.division?.length ? (
        <Card title={d.divisionName || 'Division'}>
          {d.division.map((dt, i) => <DivRow key={`${dt.abbr}-${i}`} dt={dt} me={teamId} rank={i + 1} />)}
        </Card>
      ) : null}
    </ScrollView>
  );
}

// Most recent article for this team, shown at the top of the home tab (replaces the old playoff line).
function TopNewsCard({ teamId }: { teamId: string }) {
  const q = useQuery({ queryKey: ['team-news-top', teamId], queryFn: () => fetchTeamNews(teamId, 20), staleTime: 5 * 60_000 });
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

function DivRow({ dt, me, rank }: { dt: DivTeam; me: string; rank: number }) {
  const t = useTheme();
  const isMe = dt.id === me || dt.abbr?.toLowerCase() === me.toLowerCase();
  return (
    <View style={styles.div}>
      <Text style={{ width: 20, color: t.subtle, fontSize: 12, textAlign: 'center' }}>{rank}</Text>
      <TeamLogo uri={dt.logo} size={18} />
      <Text style={{ flex: 1, color: isMe ? t.accent : t.text, fontSize: 13, fontWeight: isMe ? '800' : '600' }} numberOfLines={1}>{dt.abbr}</Text>
      <Text style={{ color: t.sub, fontSize: 12, fontVariant: ['tabular-nums'] }}>{dt.wins}-{dt.losses}-{dt.otl}</Text>
      <Text style={{ width: 34, color: t.text, fontSize: 13, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] }}>{dt.points}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 2 },
  cardTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 6 },
  mg: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  seasonDivider: { height: 1, borderRadius: 1, marginVertical: 7, marginHorizontal: 2, opacity: 0.45 },
  ldr: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  stRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 },
  div: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
});
