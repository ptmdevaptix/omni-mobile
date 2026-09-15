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
};

export type PlayerDraft = { year?: number; teamAbbrev?: string; round?: number; overallPick?: number };

export type PlayerContract = {
  status: 'signed' | 'ufa' | 'rfa';
  capHitLabel?: string; termYears?: number; expiryYear?: number; expiryStatus?: 'UFA' | 'RFA'; source?: string;
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
