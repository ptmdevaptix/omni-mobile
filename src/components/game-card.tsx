import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { DaysOutSquares } from '@/components/days-out';
import { TeamLogo } from '@/components/team-logo';
import { canonicalTeamId } from '@/lib/api';
import { cardDate } from '@/lib/format';
import { gameLeague, isInterleague } from '@/lib/leagues';
import { teamDisplayName } from '@/lib/team-name';
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
/** Why a game is among the favorites — the followed players (grayed when one sat) or the affiliate. */
export type FollowReason = { items: { label: string; muted: boolean }[] };
type GameCardProps = {
  game: ScoreGame; teams: Record<string, ScoreTeam>; featured?: boolean; cardColor?: string; compact?: boolean; starred?: boolean; reason?: FollowReason;
  /** Here for a followed player or prospect — the corner shows the person mark. */
  followed?: boolean;
  pinned?: boolean;
  /** Given for a game that can be pinned (today's, not a starred team's): the corner mark toggles it. */
  onTogglePin?: () => void;
};

// The pin's blue, the web's primary. Not the theme accent: that is gold in dark mode, where a pinned
// game would read as a starred one.
const PIN_BLUE = { light: '#2563eb', dark: '#60a5fa' } as const;

// Shared score card. The app's own look — the league badge row on top with the status at the right,
// no accent bar — deliberately not the web's; what it shares with the web is the CONTENT: the corner
// mark (star, pin or person) saying why a game is yours, the network beside the time (linked when the API knows the broadcaster's
// page), and how far off a future game is, in squares. Tapping the card opens the game; tapping a
// team's logo/name opens that team.
// `featured` wraps it in a metallic border (a favorite among its league on the Scores tab).
// `compact` renders a tighter, abbreviation-based card so two fit side by side (grid mode).
function GameCardBase({ game, teams, featured = false, cardColor, compact = false, starred = false, reason, followed = false, pinned = false, onTogglePin }: GameCardProps) {
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

  // The ECHL has no game-detail pages — its schedule is seeded from the clubs' iCal feeds, which carry
  // no league game id — so its cards don't navigate, the same call the web makes. Team taps still work.
  const hasDetail = game.top !== 'ECHL';
  const league = gameLeague(game);
  const nhl = league === 'NHL';
  const openGame = () => {
    if (!hasDetail) return;
    router.push({ pathname: '/games/[gameId]', params: { gameId: game.id, away: game.awayTeamId, home: game.homeTeamId } });
  };
  // Navigate with the canonical id so the team page, its endpoint and the ★ all agree — the CHL
  // scoreboard's own ids ("qmjhl-2") are not valid /teams ids.
  // A team the API could not match to a real team page — the interleague CHL case, where one league's
  // feed refers to a visiting team by an id meaningless outside it. Tapping it used to land on
  // "Something went wrong"; opening the game instead is the useful fallback.
  const openTeam = (id: string, team: ScoreTeam) =>
    team.linkable === false
      ? openGame()
      : router.push({ pathname: '/teams/[teamId]', params: { teamId: canonicalTeamId(id) } });

  const status = (size: number) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
      <Text style={{ color: live ? t.live : t.sub, fontSize: size, fontWeight: live ? '700' : compact ? '500' : '400', flexShrink: 1 }} numberOfLines={1}>
        {[dateLabel || null, game.statusLabel].filter(Boolean).join(' · ')}
      </Text>
    </View>
  );
  // Where to watch, linked to the broadcaster when the API knows the page.
  const network = game.network ? (
    game.networkUrl ? (
      <Pressable onPress={() => Linking.openURL(game.networkUrl!)} hitSlop={6} accessibilityRole="link" style={{ flexShrink: 1 }}>
        <Text style={{ color: t.sub, fontSize: 11, textDecorationLine: 'underline' }} numberOfLines={1}>📺 {game.network}</Text>
      </Pressable>
    ) : (
      <Text style={{ color: t.sub, fontSize: 11, flexShrink: 1 }} numberOfLines={1}>📺 {game.network}</Text>
    )
  ) : null;
  // How far off, in squares, for a future game — see components/days-out.tsx.
  const squares = game.status === 'UPCOMING' ? <DaysOutSquares utc={game.startTimeUTC} day={game.gameDate} /> : null;
  // Who put this game here: "Lechner (COL)", "NYI AFFILIATE" — cycling when there are several.
  const why = reason?.items.length ? <Reason items={reason.items} size={compact ? 10 : 11} /> : null;
  // The lower-right corner says why the game is yours, as on the web: the gold star for a starred
  // team, the solid pin for a pinned game, the person mark for a followed player's. On any other game
  // today it is a faint pin. A phone cannot hover, so the mark itself is the control: tapping the
  // person or the faint pin pins the game, tapping the solid pin unpins it.
  const iconSize = compact ? 12 : 13;
  const pinTint = PIN_BLUE[t.mode];
  const corner = starred ? (
    <Text style={{ color: '#f5a623', fontSize: iconSize }} accessibilityLabel="Favorite team">★</Text>
  ) : onTogglePin ? (
    <Pressable
      onPress={onTogglePin}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityState={{ selected: pinned }}
      accessibilityLabel={pinned ? 'Unpin this game' : 'Pin this game to Favorites for today'}
    >
      <SymbolView
        name={pinned ? 'pin.fill' : followed ? 'person.fill' : 'pin'}
        size={iconSize}
        tintColor={pinned ? pinTint : followed ? t.accent : t.subtle}
      />
    </Pressable>
  ) : followed ? (
    <SymbolView name="person.fill" size={iconSize} tintColor={t.accent} accessibilityLabel="Followed player" />
  ) : null;

  const content = compact ? (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {game.preseason ? <Text style={[styles.badge, styles.preBadge, styles.preBadgeCompact, preColors(t.mode)]}>PRE</Text> : null}
        {status(10)}
        <View style={{ flex: 1 }} />
        {squares}
        {/* The corner mark rides the top row here: a row of its own under every card would cost
            compact mode the height it exists to save. */}
        {corner}
      </View>
      <TeamLine nhl={nhl} compact team={away} score={game.awayScore} showScore={done} result={awayResult} onPress={() => openTeam(game.awayTeamId, away)} />
      <TeamLine nhl={nhl} compact team={home} score={game.homeScore} showScore={done} result={homeResult} onPress={() => openTeam(game.homeTeamId, home)} />
      {why}
    </>
  ) : (
    <>
      <View style={styles.leagueRow}>
        {/* PRE is grouped WITH the league badge rather than left as a third child of the row. The row
            is space-between, so a bare third child floated to the middle and read as though it
            belonged to neither end — it qualifies the league, so it sits against it. */}
        <View style={styles.leagueBadges}>
          {/* gameLeague(), not game.top — CHL feeds label every OHL/WHL/QMJHL game as "CHL".
              An interleague fixture names both, in away-then-home order to match the two rows below;
              a single league badge on a cross-league game reads as though it were an ordinary one. */}
          <Text style={[styles.badge, { color: t.sub, borderColor: t.border }]}>
            {isInterleague(game) ? game.leagues!.join(' · ') : league}
          </Text>
          {game.preseason ? <Text style={[styles.badge, styles.preBadge, preColors(t.mode)]}>PRE</Text> : null}
        </View>
        {/* statusLabel is time-only ("5:00 PM ET"), which is ambiguous the moment a card isn't from
            today — and the Home hub now mixes leagues on different days. Date shown only when needed. */}
        {status(12)}
      </View>
      <TeamLine nhl={nhl} team={away} score={game.awayScore} showScore={done} result={awayResult} onPress={() => openTeam(game.awayTeamId, away)} />
      <TeamLine nhl={nhl} team={home} score={game.homeScore} showScore={done} result={homeResult} onPress={() => openTeam(game.homeTeamId, home)} />
      {network || squares || why || corner ? (
        <View style={styles.footer}>
          {why ?? network}
          <View style={{ flex: 1 }} />
          {why && network ? network : null}
          {squares}
          {corner}
        </View>
      ) : null}
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

/** The foot line's follow reason: up to two names side by side, more than two cycling. A followed
 *  player who did not dress reads in gray — a fan should not have to open the game to learn he sat. */
function Reason({ items, size }: { items: { label: string; muted: boolean }[]; size: number }) {
  const t = useTheme();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length <= 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % items.length), 3000);
    return () => clearInterval(id);
  }, [items.length]);
  const shown = items.length <= 2 ? items : [items[i % items.length]];
  return (
    <Text style={{ fontSize: size, flexShrink: 1 }} numberOfLines={1}>
      {/* The accent colour, as the web gives it: this line is why the card is here at all, and in
          plain grey it read as one more caption. A player who did not dress stays muted. */}
      {shown.map((it, k) => (
        <Text key={k} style={{ color: it.muted ? t.subtle : t.accent, fontWeight: '600' }} accessibilityLabel={it.muted ? `${it.label}, not dressed` : undefined}>{k > 0 ? ', ' : ''}{it.label}</Text>
      ))}
    </Text>
  );
}

function TeamLine({ team, score, showScore, result, onPress, compact = false, nhl }: { team: ScoreTeam; score?: number; showScore: boolean; result?: Result; onPress: () => void; compact?: boolean; nhl: boolean }) {
  const t = useTheme();
  // Mini cards abbreviate every league; full cards follow the one naming rule (lib/team-name).
  const name = compact ? (team.abbr ?? teamDisplayName(team, nhl)) : teamDisplayName(team, nhl);
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


// Skip re-rendering a card when its game + team display data are unchanged — the whole scores list
// otherwise re-renders on every 30s background refetch, which VirtualizedList flags as slow.
const teamEq = (x?: ScoreTeam, y?: ScoreTeam) =>
  x?.logo === y?.logo && x?.name === y?.name && x?.nickname === y?.nickname && x?.location === y?.location && x?.abbr === y?.abbr;

function areEqual(a: GameCardProps, b: GameCardProps): boolean {
  const g1 = a.game, g2 = b.game;
  if (a.featured !== b.featured || a.cardColor !== b.cardColor || a.compact !== b.compact || a.starred !== b.starred) return false;
  // onTogglePin is compared by presence, not identity: callers build it inline each render, and it
  // only ever pins this card's own game.
  if (a.followed !== b.followed || a.pinned !== b.pinned || !!a.onTogglePin !== !!b.onTogglePin) return false;
  if (JSON.stringify(a.reason?.items ?? null) !== JSON.stringify(b.reason?.items ?? null)) return false;
  if (g1.id !== g2.id || g1.status !== g2.status || g1.statusLabel !== g2.statusLabel
    || g1.awayScore !== g2.awayScore || g1.homeScore !== g2.homeScore || g1.network !== g2.network || g1.networkUrl !== g2.networkUrl) return false;
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
  // The left end of leagueRow: league badge + any qualifier (PRE), kept together against the edge.
  leagueBadges: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  badge: { fontSize: 10, fontWeight: '700', borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  // Filled rather than outlined, so "this result doesn't count" reads at a glance instead of blending
  // into the league badge beside it.
  preBadge: { borderWidth: 0, fontWeight: '800', letterSpacing: 0.3 },
  preBadgeCompact: { fontSize: 9, paddingHorizontal: 4, paddingVertical: 1 },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamTap: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
