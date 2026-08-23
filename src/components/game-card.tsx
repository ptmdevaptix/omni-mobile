import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import { cardDate } from '@/lib/format';
import { gameLeague } from '@/lib/leagues';
import { useTheme } from '@/lib/theme';
import type { ScoreGame, ScoreTeam } from '@/lib/types';

// Preseason chip colors. Deliberately amber rather than the theme accent (blue in light, gold in dark) —
// accent means "tappable" everywhere else in the app, and green is taken by live games.
const preColors = (mode: 'light' | 'dark') =>
  mode === 'dark'
    ? { backgroundColor: '#8a4b0a', color: '#ffe8cc' }
    : { backgroundColor: '#fde3ad', color: '#7a3f05' };

// Metallic frame gradients (light→mid→shadow→highlight) for the "My Teams" featured cards.
const GOLD = ['#f8e6a8', '#c9a227', '#7d6316', '#e9cd72'] as const;   // dark mode
const PEWTER = ['#f0f2f4', '#a7abb0', '#5f6368', '#c8ccd0'] as const; // light mode

type Result = 'win' | 'loss' | 'tie' | undefined;
type GameCardProps = { game: ScoreGame; teams: Record<string, ScoreTeam>; featured?: boolean; cardColor?: string; compact?: boolean };

// Shared score card. Tapping the card opens the game; tapping a team's logo/name opens that team.
// `featured` wraps it in a metallic border (favorited teams in the Home "My Teams" section).
// `compact` renders a tighter, abbreviation-based card so two fit side by side (grid mode).
function GameCardBase({ game, teams, featured = false, cardColor, compact = false }: GameCardProps) {
  const t = useTheme();
  const router = useRouter();
  const away = teams[game.awayTeamId] ?? {};
  const home = teams[game.homeTeamId] ?? {};
  const done = game.status === 'FINAL' || game.status === 'LIVE';
  const live = game.status === 'LIVE';
  const dateLabel = cardDate(game.startTimeUTC, game.gameDate);

  // Winner/loser only for FINAL games with both scores (dim the loser + wedge at the winner).
  const final = game.status === 'FINAL' && game.awayScore != null && game.homeScore != null;
  const aw = game.awayScore ?? 0;
  const hm = game.homeScore ?? 0;
  const awayResult: Result = !final ? undefined : aw === hm ? 'tie' : aw > hm ? 'win' : 'loss';
  const homeResult: Result = !final ? undefined : hm === aw ? 'tie' : hm > aw ? 'win' : 'loss';

  const openGame = () => router.push({ pathname: '/games/[gameId]', params: { gameId: game.id, away: game.awayTeamId, home: game.homeTeamId } });
  const openTeam = (id: string) => router.push({ pathname: '/teams/[teamId]', params: { teamId: id } });

  const content = compact ? (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {game.preseason ? <Text style={[styles.badge, styles.preBadge, styles.preBadgeCompact, preColors(t.mode)]}>PRE</Text> : null}
        <Text style={{ color: live ? t.live : t.sub, fontSize: 10, fontWeight: live ? '700' : '500', flexShrink: 1 }} numberOfLines={1}>
          {[dateLabel || null, game.statusLabel].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <TeamLine compact team={away} id={game.awayTeamId} score={game.awayScore} showScore={done} result={awayResult} onPress={() => openTeam(game.awayTeamId)} />
      <TeamLine compact team={home} id={game.homeTeamId} score={game.homeScore} showScore={done} result={homeResult} onPress={() => openTeam(game.homeTeamId)} />
    </>
  ) : (
    <>
      <View style={styles.leagueRow}>
        {/* gameLeague(), not game.top — CHL feeds label every OHL/WHL/QMJHL game as "CHL". */}
        <Text style={[styles.badge, { color: t.sub, borderColor: t.border }]}>{gameLeague(game)}</Text>
        {game.preseason ? <Text style={[styles.badge, styles.preBadge, preColors(t.mode)]}>PRE</Text> : null}
        {/* statusLabel is time-only ("5:00 PM ET"), which is ambiguous the moment a card isn't from
            today — and the Home hub now mixes leagues on different days. Date shown only when needed. */}
        <Text style={{ color: live ? t.live : t.sub, fontSize: 12, fontWeight: live ? '700' : '400' }}>
          {dateLabel ? `${dateLabel} · ${game.statusLabel}` : game.statusLabel}
        </Text>
      </View>
      <TeamLine team={away} id={game.awayTeamId} score={game.awayScore} showScore={done} result={awayResult} onPress={() => openTeam(game.awayTeamId)} />
      <TeamLine team={home} id={game.homeTeamId} score={game.homeScore} showScore={done} result={homeResult} onPress={() => openTeam(game.homeTeamId)} />
      {game.network ? <Text style={{ color: t.sub, fontSize: 11, marginTop: 4 }}>📺 {game.network}</Text> : null}
    </>
  );

  if (featured) {
    return (
      <Pressable onPress={openGame} style={[styles.metalShadow, compact && styles.flex1]}>
        <LinearGradient colors={t.mode === 'dark' ? GOLD : PEWTER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.metalFrame}>
          <View style={[styles.card, styles.cardInner, compact && styles.cardCompact, { backgroundColor: t.card }]}>{content}</View>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={openGame} style={[styles.card, compact && styles.cardCompact, compact && styles.flex1, { backgroundColor: cardColor ?? t.card, borderColor: t.border }]}>{content}</Pressable>
  );
}

function TeamLine({ team, id, score, showScore, result, onPress, compact = false }: { team: ScoreTeam; id: string; score?: number; showScore: boolean; result?: Result; onPress: () => void; compact?: boolean }) {
  const t = useTheme();
  const name = compact ? (team.abbr ?? scoreName(team, id)) : scoreName(team, id);
  const lost = result === 'loss';
  return (
    <View style={styles.teamLine}>
      {/* Tight tap target: only the logo + visible name characters (+ tiny hitSlop). */}
      <Pressable onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 3, right: 2 }} style={({ pressed }) => [styles.teamTap, pressed && { opacity: 0.55 }]}>
        <TeamLogo uri={team.logo} darkUri={team.darkLogo} size={compact ? 18 : 24} />
        <Text style={{ color: lost ? t.sub : t.text, fontSize: compact ? 14 : 16, fontWeight: compact ? '700' : '600', flexShrink: 1 }} numberOfLines={1}>{name}</Text>
      </Pressable>
      {/* Everything to the right of the name (whitespace) falls through to the card → game details. */}
      <View style={{ flex: 1 }} />
      {showScore ? (
        <View style={styles.scoreCell}>
          {result === 'win' ? <Text style={{ color: t.accent, fontSize: compact ? 10 : 12, fontWeight: '900' }}>▸</Text> : null}
          <Text style={{ color: lost ? t.subtle : t.text, fontSize: compact ? 15 : 18, fontWeight: compact ? '800' : '700', fontVariant: ['tabular-nums'] }}>{score ?? 0}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Score cards show the nickname (NHL/AHL/CHL) or the place/school name (NCAA), with graceful fallbacks.
// Compact cards use the abbreviation instead (see TeamLine).
function scoreName(team: ScoreTeam, id: string): string {
  if (id.startsWith('ncaa-')) return team.location ?? team.name ?? team.abbr ?? id;
  return team.nickname ?? team.name ?? team.abbr ?? id;
}

// Skip re-rendering a card when its game + team display data are unchanged — the whole scores list
// otherwise re-renders on every 30s background refetch, which VirtualizedList flags as slow.
const teamEq = (x?: ScoreTeam, y?: ScoreTeam) =>
  x?.logo === y?.logo && x?.name === y?.name && x?.nickname === y?.nickname && x?.location === y?.location && x?.abbr === y?.abbr;

function areEqual(a: GameCardProps, b: GameCardProps): boolean {
  const g1 = a.game, g2 = b.game;
  if (a.featured !== b.featured || a.cardColor !== b.cardColor || a.compact !== b.compact) return false;
  if (g1.id !== g2.id || g1.status !== g2.status || g1.statusLabel !== g2.statusLabel
    || g1.awayScore !== g2.awayScore || g1.homeScore !== g2.homeScore || g1.network !== g2.network) return false;
  return teamEq(a.teams[g1.awayTeamId], b.teams[g2.awayTeamId]) && teamEq(a.teams[g1.homeTeamId], b.teams[g2.homeTeamId]);
}

export const GameCard = memo(GameCardBase, areEqual);

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 6 },
  cardCompact: { padding: 9, gap: 3 },
  flex1: { flex: 1 },
  cardInner: { borderWidth: 0, borderRadius: 12.5 },
  metalFrame: { borderRadius: 14.5, padding: 2 },
  metalShadow: { borderRadius: 14.5, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  leagueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  badge: { fontSize: 10, fontWeight: '700', borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  // Filled rather than outlined, so "this result doesn't count" reads at a glance instead of blending
  // into the league badge beside it.
  preBadge: { borderWidth: 0, fontWeight: '800', letterSpacing: 0.3 },
  preBadgeCompact: { fontSize: 9, paddingHorizontal: 4, paddingVertical: 1 },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamTap: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
