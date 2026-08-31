// Minimal response types for the endpoints this scaffold uses. These mirror the shapes returned by
// omni-hockey's API routes. As the app grows, promote these to a shared @omni/types package that both
// repos import (see README) rather than copying more by hand.

export type ScoreGame = {
  id: string;
  // Top-level league tab: "NHL" | "AHL" | "CHL" | "NCAA" | "USHL". NOTE this is *not* the sub-league —
  // OHL/WHL/QMJHL games all carry top: "CHL". Use gameLeague() from lib/leagues to get the real one.
  top: string;
  path?: string[]; // breadcrumb; path[0] is the sub-league for CHL feeds (e.g. ["QMJHL"])
  // Every league involved, when more than one — an interleague CHL game, e.g. ["OHL","QMJHL"].
  // Absent for an ordinary game. Set by the API so both clients group and filter identically.
  leagues?: string[];
  // The family both sides share ("CHL"), so the section reads "Interleague (CHL)". Absent when they
  // share none — an NCAA side playing U Sports — which groups under a plain "Interleague".
  interleagueParent?: string;
  awayTeamId: string;
  homeTeamId: string;
  status: "UPCOMING" | "LIVE" | "FINAL" | string;
  statusLabel: string;
  awayScore?: number;
  homeScore?: number;
  network?: string;
  startTimeUTC?: string; // ISO puck drop — the reliable way to date a game (statusLabel is time-only)
  gameDate?: string;     // YYYY-MM-DD — feeds that know the day but not the time (seeded NCAA schedules)
  preseason?: boolean; // HockeyTech career=0 seasons (exhibition/pre-season)
};

// NHL /scores enriches teams with location + nickname (there is no single `name` field here, unlike
// /nhl-standings). Display name = `${location} ${nickname}`.trim(), falling back to abbr.
export type ScoreTeam = {
  location?: string; nickname?: string; name?: string; abbr?: string; logo?: string; darkLogo?: string;
  // False when the API could not match this team to a real team page — an interleague CHL game, where
  // one league's feed names a visiting team with an id meaningless outside it. Undefined means
  // linkable, so nothing that predates this field changes behaviour.
  linkable?: boolean;
};

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
  routeId?: string; // set by fetchStandings — the /teams/<id> id for tap-through (prefixed for AHL/CHL)
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
