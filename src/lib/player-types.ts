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

export type PlayerSearchResult = { id: string; name: string; pos: string; teamAbbrev?: string; active?: boolean };
