// Home-screen data rules, shared with nothing else on purpose: which games are a favorite's, which
// belong to a followed league, a favorite's NEXT game as a card, and the next slate for a league that
// is dark today. Mirrors lib/favorite-games.ts, lib/followed-games.ts and lib/use-league-lookahead.ts
// on the web so the two Homes agree.
import { api } from './api';
import { dayKey, timeOfDay } from './format';
import { fetchGameDays, fetchScores, gameLeague, LEAGUES, type LeagueId, type TeamDirectoryEntry } from './leagues';
import type { ScoreGame, ScoreTeam } from './types';

// ── Favorites ─────────────────────────────────────────────────────────────────

/**
 * Every id a favorite can appear under on a scoreboard. Favorites hold the canonical /teams id
 * ("chl-ohl-7", "chl-lhjmq-2", "cjra-ojhl-21"); the CHL and Jr A scoreboards key teams by LEAGUE
 * code ("ohl-7", "qmjhl-2", "ojhl-21"). Mirrors matchIdsForTeam in the web repo — a favorite this
 * misses never reaches Favorites and its next-game card doubles the live one.
 */
export function favMatchIds(favorites: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const id of favorites) {
    set.add(id);
    if (id.startsWith('chl-')) {
      const rest = id.slice(4);
      set.add(rest);
      if (rest.startsWith('lhjmq-')) set.add(`qmjhl-${rest.slice(6)}`);
    }
    if (id.startsWith('cjra-')) set.add(id.slice(5));
  }
  return set;
}

export const isFavGame = (g: ScoreGame, favIds: ReadonlySet<string>) =>
  favIds.has(g.awayTeamId) || favIds.has(g.homeTeamId);

/** The favorite's own id when it plays in `g`, else null. */
export function favoriteIn(g: ScoreGame, favorites: readonly string[]): string | null {
  for (const id of favorites) {
    const ids = favMatchIds([id]);
    if (ids.has(g.awayTeamId) || ids.has(g.homeTeamId)) return id;
  }
  return null;
}

// ── Followed leagues ──────────────────────────────────────────────────────────

/** A game counts for a followed league if it is that league's game, or an interleague fixture either
 *  side of which is followed — an OHL fan wants to see their league's team visit Quebec. */
export function gameIsFollowed(g: ScoreGame, followed: ReadonlySet<string>): boolean {
  return followed.has(gameLeague(g)) || !!g.leagues?.some((l) => followed.has(l.toUpperCase()));
}

// ── Next game for a favorite ──────────────────────────────────────────────────

export type NextGameInfo = {
  teamId: string; gameId: string; date: string; startTimeUTC?: string;
  opponentName: string; opponentAbbr: string; opponentLogo?: string; opponentDarkLogo?: string;
  isHome: boolean;
  preseason?: boolean;
};

/** GET /next-team-games — first upcoming game per team, however far out (no cap server-side). */
export async function fetchNextGames(teamIds: readonly string[], from: string = dayKey()): Promise<Record<string, NextGameInfo>> {
  if (!teamIds.length) return {};
  const qs = new URLSearchParams({ teams: teamIds.join(','), from });
  const r = await api<{ nextGames?: Record<string, NextGameInfo> }>(`/next-team-games?${qs.toString()}`);
  return r.nextGames ?? {};
}

/**
 * A next game as a ScoreGame + the two team entries, so the ordinary GameCard renders it — same card,
 * same taps (the game opens; the favorite's logo opens its page; the opponent falls back to the game
 * because it isn't in today's teams map). `statusLabel` is the local start time, which is what the card
 * shows for an upcoming game; the date label comes from `gameDate` like any other non-today card.
 */
export function nextGameAsCard(
  info: NextGameInfo,
  favorite: string,
  entry: TeamDirectoryEntry | undefined,
): { game: ScoreGame; teams: Record<string, ScoreTeam> } {
  const oppId = `${info.gameId}-opp`;
  const mine: ScoreTeam = { name: entry?.name ?? favorite.toUpperCase(), abbr: entry?.abbr ?? favorite.toUpperCase(), logo: entry?.logo, darkLogo: entry?.darkLogo };
  const them: ScoreTeam = { name: info.opponentName || info.opponentAbbr, abbr: info.opponentAbbr, logo: info.opponentLogo, darkLogo: info.opponentDarkLogo, linkable: false };
  const league = gameLeague({ id: info.gameId } as ScoreGame);
  const game: ScoreGame = {
    id: info.gameId,
    top: league === 'OHL' || league === 'WHL' || league === 'QMJHL' ? 'CHL' : league,
    path: league === 'OHL' || league === 'WHL' || league === 'QMJHL' ? [league] : undefined,
    awayTeamId: info.isHome ? oppId : favorite,
    homeTeamId: info.isHome ? favorite : oppId,
    status: 'UPCOMING',
    statusLabel: info.startTimeUTC ? timeOfDay(info.startTimeUTC) : 'TBD',
    startTimeUTC: info.startTimeUTC,
    gameDate: info.date,
    preseason: info.preseason || undefined,
  };
  return { game, teams: { [favorite]: mine, [oppId]: them } };
}

// ── Next slate for a dark league ──────────────────────────────────────────────

export type LookaheadSlate = { league: string; date: string; games: ScoreGame[]; teamsById: Record<string, ScoreTeam> };

const LOOKAHEAD_DAYS = 240; // spans any offseason gap — late June to early October is ~105 days

function plusDays(from: string, days: number): string {
  const [y, m, d] = from.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

const leagueIdFor = (label: string): LeagueId | undefined => LEAGUES.find((l) => l.label === label)?.id;

/**
 * For a followed league with nothing today: its next day with games and that day's slate. `date` is ""
 * when the league is known to have nothing ahead; null means unknown (endpoint unsupported or failed).
 */
export async function fetchLookahead(league: string, today: string = dayKey()): Promise<LookaheadSlate | null> {
  const id = leagueIdFor(league);
  if (!id) return null;
  const days = await fetchGameDays(id, today, plusDays(today, LOOKAHEAD_DAYS));
  const next = days.find((d) => d > today);
  if (!next) return { league, date: '', games: [], teamsById: {} };
  const r = await fetchScores(id, next);
  return { league, date: next, games: r.games ?? [], teamsById: r.teamsById ?? {} };
}
