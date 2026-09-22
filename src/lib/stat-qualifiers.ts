// How many games a player needs before a RATE stat counts them. Mirrors lib/stat-qualifiers.ts on
// the web; the two must not drift.
//
// A fixed floor is wrong for most of the year: a week into a season nobody has 10 games, so the
// goalie board was empty every October. The floor is a share of the season played so far — twenty
// percent: enough that one hot night cannot own the column, low enough that the board fills in
// within a couple of weeks.
export const RATE_QUALIFIER_PCT = 0.2;

/** How far the season has got: the most games any SKATER has played (a healthy one dresses for all). */
export function seasonGamesPlayed(rows: readonly { gp: number }[]): number {
  let max = 0;
  for (const r of rows) if (r.gp > max) max = r.gp;
  return max;
}

/** Season length from a goalie board alone: every game has one starting goalie, so starts per team sum to games. */
export function seasonGamesFromStarts(rows: readonly { team?: string; gs?: number }[]): number {
  const byTeam: Record<string, number> = {};
  for (const r of rows) byTeam[r.team ?? ''] = (byTeam[r.team ?? ''] ?? 0) + (r.gs ?? 0);
  let max = 0;
  for (const v of Object.values(byTeam)) if (v > max) max = v;
  return max;
}

/** Same, split by league — a combined board spans leagues that started weeks apart. */
export function seasonGamesByLeague(rows: readonly { gp: number; league?: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = (r.league ?? '').toLowerCase();
    if (r.gp > (out[k] ?? 0)) out[k] = r.gp;
  }
  return out;
}

/** The games floor for a rate column; `fallback` only when the season length is unknown. Never 0. */
export function rateMinGames(seasonGP: number, fallback: number): number {
  if (!Number.isFinite(seasonGP) || seasonGP <= 0) return fallback;
  return Math.max(1, Math.ceil(RATE_QUALIFIER_PCT * seasonGP));
}

export type RateFloor = {
  /** Games a player needs to qualify. Pass the row's league on a board that spans several. */
  min(leagueKey?: string): number;
  /** For the caption: "14 GP", or "20% of games played" when it varies by league. */
  label: string;
};

export function fixedRateFloor(games: number): RateFloor {
  return { min: () => games, label: `${games} GP` };
}

/** Build the floor from the skaters on the board — skaters even for a goalie table (see above). */
export function seasonRateFloor(skaters: readonly { gp: number; league?: string }[], fallback: number, perLeague = false): RateFloor {
  if (!perLeague) {
    const n = rateMinGames(seasonGamesPlayed(skaters), fallback);
    return { min: () => n, label: `${n} GP` };
  }
  const byLeague = seasonGamesByLeague(skaters);
  const floors: Record<string, number> = {};
  for (const [k, gp] of Object.entries(byLeague)) floors[k] = rateMinGames(gp, fallback);
  const values = Object.values(floors);
  const uniform = values.length > 0 && values.every((v) => v === values[0]);
  return {
    min: (key) => floors[(key ?? '').toLowerCase()] ?? fallback,
    label: uniform ? `${values[0]} GP` : `${Math.round(RATE_QUALIFIER_PCT * 100)}% of games played`,
  };
}
