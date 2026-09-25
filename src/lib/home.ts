// Home-screen data rules, shared with nothing else on purpose: which games are a favorite's, which
// belong to a followed league, a favorite's NEXT game as a card, and the next slate for a league that
// is dark today. Mirrors lib/favorite-games.ts, lib/followed-games.ts and lib/use-league-lookahead.ts
// on the web so the two Homes agree.
import { api } from './api';
import { nhlNickname } from './nhl-teams';
import { composeTeamName } from './team-name';
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
  /** The arena's zone (lib/game-time). */
  venueTimeZone?: string;
  /** The opponent's PLACE ("Belleville", "Rögle"), which is how a non-NHL card names it. */
  opponentName: string; opponentAbbr: string; opponentLogo?: string; opponentDarkLogo?: string;
  isHome: boolean;
  preseason?: boolean;
  /** The favorite's own two name fields and crest, so its card names it like every other card. */
  teamPlace?: string; teamNickname?: string; teamAbbr?: string; teamLogo?: string; teamDarkLogo?: string;
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
  const league = gameLeague({ id: info.gameId } as ScoreGame);
  // Both sides carry location AND nickname, because that is what the card's naming rule reads
  // (lib/team-name): the favorite's from the route (else the directory), the opponent's place from
  // the route — and for the NHL, where the card wants the nickname, from the static NHL table.
  const mine: ScoreTeam = {
    name: entry?.name ?? composeTeamName(info.teamPlace, info.teamNickname) ?? favorite,
    location: info.teamPlace ?? entry?.location,
    nickname: info.teamNickname ?? entry?.nickname,
    abbr: info.teamAbbr ?? entry?.abbr ?? favorite.toUpperCase(),
    logo: entry?.logo ?? info.teamLogo,
    darkLogo: entry?.darkLogo ?? info.teamDarkLogo,
  };
  const them: ScoreTeam = {
    name: info.opponentName || info.opponentAbbr,
    location: info.opponentName || undefined,
    nickname: league === 'NHL' ? nhlNickname(info.opponentAbbr, info.opponentName) : undefined,
    abbr: info.opponentAbbr,
    logo: info.opponentLogo,
    darkLogo: info.opponentDarkLogo,
    linkable: false,
  };
  const game: ScoreGame = {
    id: info.gameId,
    top: league === 'OHL' || league === 'WHL' || league === 'QMJHL' ? 'CHL' : league,
    path: league === 'OHL' || league === 'WHL' || league === 'QMJHL' ? [league] : undefined,
    awayTeamId: info.isHome ? oppId : favorite,
    homeTeamId: info.isHome ? favorite : oppId,
    status: 'UPCOMING',
    statusLabel: info.startTimeUTC ? timeOfDay(info.startTimeUTC) : 'TBD',
    startTimeUTC: info.startTimeUTC,
    venueTimeZone: info.venueTimeZone,
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

// Case-insensitive: a Home section is titled by the game feed's code ("LIIGA"), the config by the
// league's own spelling ("Liiga"), and an exact compare left Liiga's lookahead returning nothing.
const leagueIdFor = (label: string): LeagueId | undefined =>
  LEAGUES.find((l) => l.label.toUpperCase() === label.toUpperCase())?.id;

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
