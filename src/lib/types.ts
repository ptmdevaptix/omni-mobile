// Minimal response types for the endpoints this scaffold uses. These mirror the shapes returned by
// omni-hockey's API routes. As the app grows, promote these to a shared @omni/types package that both
// repos import (see README) rather than copying more by hand.

export type ScoreGame = {
  id: string;
  top: string; // league: "NHL" | "AHL" | "OHL" | "WHL" | "QMJHL" | "NCAA" | ...
  awayTeamId: string;
  homeTeamId: string;
  status: "UPCOMING" | "LIVE" | "FINAL" | string;
  statusLabel: string;
  awayScore?: number;
  homeScore?: number;
  network?: string;
};

export type ScoreTeam = { name?: string; abbr?: string; logo?: string; darkLogo?: string };

export type ScoresResponse = {
  games: ScoreGame[];
  teamsById: Record<string, ScoreTeam>;
  currentDate?: string;
  fetchedAt?: string;
};

export type StandingsTeam = {
  name: string;
  abbr: string;
  logo?: string;
  darkLogo?: string;
  division?: string;
  conference?: string;
  gp: number;
  w: number;
  l: number;
  otl: number;
  pts: number;
  clinch?: string;
};

export type StandingsResponse = { teams: StandingsTeam[]; fetchedAt?: string };

// The team header endpoints (/api/team, /api/ncaa-team, …) return slightly different shapes per league,
// but share these fields (the header is the same across leagues).
export type TeamHeader = {
  name: string;
  nickname?: string;
  abbr: string;
  logo?: string;
  record?: string;
  confRecord?: string;
  division?: string;
  points?: number;
  gameStatus?: {
    last?: { awayAbbr: string; homeAbbr: string; awayScore: number; homeScore: number; overtime?: string; date?: string };
    next?: { opponentAbbr: string; isHome: boolean; date: string };
  };
};
