import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import { useTheme } from '@/lib/theme';
import type { ScoreGame, ScoreTeam } from '@/lib/types';

// Metallic frame gradients (light→mid→shadow→highlight) for the "My Teams" featured cards.
const GOLD = ['#f8e6a8', '#c9a227', '#7d6316', '#e9cd72'] as const;   // dark mode
const PEWTER = ['#f0f2f4', '#a7abb0', '#5f6368', '#c8ccd0'] as const; // light mode

// Shared score card used by the Home hub and the per-league Scores tab. `featured` wraps it in a
// metallic border (used for favorited teams in the Home "My Teams" section).
export function GameCard({ game, teams, featured = false }: { game: ScoreGame; teams: Record<string, ScoreTeam>; featured?: boolean }) {
  const t = useTheme();
  const away = teams[game.awayTeamId] ?? {};
  const home = teams[game.homeTeamId] ?? {};
  const done = game.status === 'FINAL' || game.status === 'LIVE';
  const live = game.status === 'LIVE';

  const content = (
    <>
      <View style={styles.leagueRow}>
        <Text style={[styles.badge, { color: t.sub, borderColor: t.border }]}>{game.top}</Text>
        <Text style={{ color: live ? t.live : t.sub, fontSize: 12, fontWeight: live ? '700' : '400' }}>{game.statusLabel}</Text>
      </View>
      <TeamLine team={away} id={game.awayTeamId} score={game.awayScore} showScore={done} />
      <TeamLine team={home} id={game.homeTeamId} score={game.homeScore} showScore={done} />
      {game.network ? <Text style={{ color: t.sub, fontSize: 11, marginTop: 4 }}>📺 {game.network}</Text> : null}
    </>
  );

  if (featured) {
    return (
      <Link href={{ pathname: '/teams/[teamId]', params: { teamId: game.homeTeamId } }} asChild>
        <Pressable style={styles.metalShadow}>
          <LinearGradient colors={t.mode === 'dark' ? GOLD : PEWTER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.metalFrame}>
            <View style={[styles.card, styles.cardInner, { backgroundColor: t.card }]}>{content}</View>
          </LinearGradient>
        </Pressable>
      </Link>
    );
  }

  return (
    <Link href={{ pathname: '/teams/[teamId]', params: { teamId: game.homeTeamId } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.card, { backgroundColor: t.card, borderColor: t.border }])}>{content}</Pressable>
    </Link>
  );
}

function TeamLine({ team, id, score, showScore }: { team: ScoreTeam; id: string; score?: number; showScore: boolean }) {
  const t = useTheme();
  const name = scoreName(team, id);
  return (
    <View style={styles.teamLine}>
      <TeamLogo uri={team.logo} size={24} />
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '600', flex: 1 }} numberOfLines={1}>{name}</Text>
      {showScore ? <Text style={{ color: t.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{score ?? 0}</Text> : null}
    </View>
  );
}

// Score cards show the nickname (NHL/AHL/CHL) or the place/school name (NCAA), with graceful fallbacks.
function scoreName(team: ScoreTeam, id: string): string {
  if (id.startsWith('ncaa-')) return team.location ?? team.name ?? team.abbr ?? id;
  return team.nickname ?? team.name ?? team.abbr ?? id;
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 6 },
  cardInner: { borderWidth: 0, borderRadius: 12.5 },
  metalFrame: { borderRadius: 14.5, padding: 2 },
  metalShadow: { borderRadius: 14.5, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  leagueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  badge: { fontSize: 10, fontWeight: '700', borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
