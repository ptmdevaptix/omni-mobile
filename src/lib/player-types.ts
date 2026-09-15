// Player-detail response shapes (subset of omni-hockey's lib/player-detail-types.ts).

export type PlayerStatLine = {
  season?: number;
  gamesPlayed?: number;
  goals?: number; assists?: number; points?: number; plusMinus?: number; pim?: number;
  wins?: number; losses?: number; otLosses?: number; shutouts?: number; goalsAgainstAvg?: number; savePctg?: number;
};

export type PlayerSeasonStatRow = PlayerStatLine & {
  season: number;
  gameType: number;           // 2 = regular season, 3 = playoffs
  leagueAbbrev: string;
  teamName: string;
  teamAbbrev?: string;
  teamLogo?: string | null;
  /** Orders two stints in the SAME season — a player traded mid-year has a row for each club. */
  sequence?: number;
  /** "/teams/col" when the club has a page of ours. */
  teamHref?: string | null;
};

export type PlayerDraft = { year?: number; teamAbbrev?: string; round?: number; overallPick?: number };

/** One season of a deal, as cap-space publishes it: its own cap hit, and its own clause. */
export type ContractSeason = { startYear: number; capHit: number; clause?: string };

export type PlayerContract = {
  status: 'signed' | 'ufa' | 'rfa';
  /**
   * An entry-level deal — the one contract whose dates are not settled. It SLIDES a year forward if
   * the player is 18 or 19 and does not reach ten NHL games, so the seasons drawn from it are a plan
   * rather than a commitment.
   */
  entryLevel?: boolean;
  capHitLabel?: string; termYears?: number; expiryYear?: number; expiryStatus?: 'UFA' | 'RFA'; source?: string;
  sourceUrl?: string;
  /** Average annual value in dollars, for the seasons a per-season figure is missing. */
  capHit?: number;
  yearsRemaining?: number;
  /**
   * Per season, when the crawl could read the table. A commitment is not one number repeated: Makar
   * is on $9M through 2026-27 and $20.4M for the eight years after that.
   */
  seasons?: ContractSeason[];
};

export type PlayerDetail = {
  id: string;
  league: string;
  sourceId: string;
  firstName: string; lastName: string; fullName: string;
  position: string; isGoalie: boolean; number?: number; isActive?: boolean;
  headshot?: string;
  teamAbbrev?: string; teamName?: string; teamLogo?: string;
  height?: string; weight?: number; shootsCatches?: string;
  birthDate?: string; age?: number; birthplace?: string; birthCountry?: string;
  draft?: PlayerDraft;
  /** False when nobody has told us whether he was drafted — not the same as "undrafted". */
  draftStatusKnown?: boolean;
  currentSeason?: PlayerStatLine;
  careerTotals?: PlayerStatLine;
  seasonTotals: PlayerSeasonStatRow[];
  contract?: PlayerContract;
  error?: string;
};

/**
 * One hit from /api/search/players, which searches OUR players table — not the NHL's endpoint — so
 * juniors and college players are reachable by name too.
 *
 * Keyed by SLUG, the canonical player page. There is no numeric id here any more: the search stopped
 * being NHL-only, and most of the players it can find have never had one.
 *
 * The list arrives RANKED (relevance, then league tier, then whether he is playing, then career
 * games, then age) and capped at eight. Re-sorting it on this side throws that away — an earlier
 * version sorted by `active` and undid the whole ordering.
 */
export type PlayerSearchResult = {
  slug: string;
  name: string;
  pos: string;
  /** Sweater number from his most recent roster, when a feed has recorded one. */
  number?: number;
  /** NHL club abbreviation when we know one, for the row's crest. Empty for most juniors. */
  teamAbbrev?: string;
  headshot?: string;
  active?: boolean | null;
  /** The league he is best associated with — "NHL", "OHL" — and what the ranking sorted on. */
  league?: string | null;
};
