// Game-detail response shapes (subset of omni-hockey's lib/game-detail-types.ts).

export type GDTeam = {
  name: string; nickname: string; abbr: string; teamId?: string;
  logo?: string; darkLogo?: string; score?: number; record?: string; sog?: number;
};
export type PeriodScore = { label: string; away: number | null; home: number | null };
export type GoalInfo = {
  time: string; teamAbbr: string; scorer: string; scorerGoals?: number;
  goalType?: 'PP' | 'SH' | 'EN' | 'PS';
  assists: { name: string; assistsToDate?: number }[];
  awayScore: number; homeScore: number; isShootout?: boolean;
};
export type ScoringPeriod = { label: string; goals: GoalInfo[] };
export type PenaltyInfo = { time: string; teamAbbr: string; player: string; description: string; duration: number };
export type PenaltyPeriod = { label: string; penalties: PenaltyInfo[] };
export type ThreeStar = { star: number; name: string; teamAbbr: string; goals: number; assists: number; points: number };

export type GameDetail = {
  league: string;
  status: 'LIVE' | 'FINAL' | 'UPCOMING';
  statusLabel: string;
  startTimeUTC?: string;
  venue?: string;
  venueLocation?: string;
  seriesInfo?: string;
  network?: string;
  awayTeam: GDTeam;
  homeTeam: GDTeam;
  periodScores?: PeriodScore[];
  scoring: ScoringPeriod[];
  penalties: PenaltyPeriod[];
  threeStars?: ThreeStar[];
  preview?: string;
};
export type GameDetailResponse = { detail?: GameDetail; error?: string; stale?: boolean };
