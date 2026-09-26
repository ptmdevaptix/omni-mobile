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
/** One shootout attempt, in the order taken. `winner` marks the attempt that decided the game. */
export type ShootoutAttempt = { teamAbbr: string; shooter: string; goalie?: string; scored: boolean; round: number; winner?: boolean };
/** A game's shootout, when it had one. Goals here are shootout goals, not the one the winner is credited with. */
export type Shootout = { awayGoals: number; homeGoals: number; attempts: ShootoutAttempt[] };
export type PenaltyInfo = { time: string; teamAbbr: string; player: string; description: string; duration: number; isPenaltyShot?: boolean };
export type PenaltyPeriod = { label: string; penalties: PenaltyInfo[] };
export type ThreeStar = { star: number; name: string; teamAbbr: string; goals: number; assists: number; points: number };

// Box-score player rows (from the game-detail `rosters`).
export type BoxSkater = {
  playerId: number; name: string; number?: number;
  playerSlug?: string; // the player-page route id, when the API linked the row

  goals?: number; assists?: number; plusMinus?: number; pim?: number; toi?: string;
  sog?: number; // shots on goal — CHL feeds only today, so the column is conditional
};
export type BoxGoalie = {
  playerId: number; name: string; number?: number;
  playerSlug?: string;
  pim?: number; toi?: string; shotsAgainst?: number; saves?: number; goalsAgainst?: number;
};
export type TeamBox = { forwards: BoxSkater[]; defense: BoxSkater[]; goalies: BoxGoalie[] };
/**
 * A player on the roster who did not dress. The NHL lists scratches itself; every other feed lists
 * only who dressed, so there they are the roster minus the lineup and exist only once a lineup does.
 */
export type ScratchedPlayer = { playerId?: number | string; name: string; playerSlug?: string; number?: number; position?: string; reason?: string };
export type GameRosters = { away: TeamBox; home: TeamBox };

export type GameDetail = {
  league: string;
  status: 'LIVE' | 'FINAL' | 'UPCOMING';
  statusLabel: string;
  startTimeUTC?: string;
  /** The arena's zone, for showing the start on its clock (lib/game-time). */
  venueTimeZone?: string;
  venue?: string;
  venueLocation?: string;
  seriesInfo?: string;
  network?: string;
  awayTeam: GDTeam;
  homeTeam: GDTeam;
  periodScores?: PeriodScore[];
  scoring: ScoringPeriod[];
  shootout?: Shootout;
  penalties: PenaltyPeriod[];
  threeStars?: ThreeStar[];
  rosters?: GameRosters;
  scratches?: { away: ScratchedPlayer[]; home: ScratchedPlayer[]; source: 'listed' | 'derived' };
  preview?: string;
  previewTitle?: string;
  previewSummary?: string;
};
export type GameDetailResponse = { detail?: GameDetail; error?: string; stale?: boolean };
