// Team-hub response shapes (subset of omni-hockey's lib/team-*-types.ts). Same API, so these mirror it.

export type RosterPlayer = {
  id: number;
  name: string;
  number?: number;
  position: string;
  positionLabel: string;
  shootsCatches?: string;
  height: string;
  weight?: number;
  age?: number;
  birthplace: string;
  birthCountry?: string;
  headshot?: string;
  nhlId?: string;
};
export type RosterResponse = {
  forwards: RosterPlayer[];
  defensemen: RosterPlayer[];
  goalies: RosterPlayer[];
  summary?: { avgAge: number; avgHeight: string; avgWeight: number };
  estimated?: boolean;
  incomingOnly?: boolean;
  season?: string;
  error?: string;
};

export type ScheduleGame = {
  id: number;
  date: string;
  startTimeUTC: string;
  opponentAbbr: string;
  opponentName?: string;
  opponentId?: string;
  opponentLogo: string;
  opponentDarkLogo: string;
  isHome: boolean;
  teamScore?: number;
  opponentScore?: number;
  result?: 'W' | 'L' | 'OTL';
  overtime?: 'OT' | 'SO';
  state: 'FINAL' | 'UPCOMING' | 'POSTPONED';
  broadcasts?: string[];
  postseason?: string;
  venue?: string;
};

export type TeamSkaterStat = {
  id: number; name: string; position: string; gp: number;
  goals: number; assists: number; points: number; plusMinus: number; pim: number;
  toiPerGame: number; shots: number;
};
export type TeamGoalieStat = {
  id: number; name: string; gp: number; wins: number; losses: number; otl: number;
  gaa: number; savePct: number; shutouts: number;
};
export type TeamSummary = {
  ppPct: number; ppRank: number; pkPct: number; pkRank: number;
  sogPerGame: number; sogPerGameRank: number; sogaPerGame: number; sogaPerGameRank: number; totalTeams: number;
};
export type TeamStatsResponse = { skaters: TeamSkaterStat[]; goalies: TeamGoalieStat[]; summary?: TeamSummary; error?: string };

export type Leader = { name: string; value: string; raw: number };
export type MiniGame = {
  id: number; date: string; opponentAbbr: string; opponentName?: string; opponentId?: string;
  opponentLogo: string; opponentDarkLogo: string; isHome: boolean;
  teamScore?: number; opponentScore?: number; result?: 'W' | 'L' | 'OTL'; overtime?: 'OT' | 'SO';
  state: 'FINAL' | 'UPCOMING'; startTimeUTC?: string; postseason?: string;
};
export type DivTeam = {
  id?: string; abbr: string; name: string; logo: string; darkLogo: string;
  points: number; gp: number; wins: number; losses: number; otl: number; divisionSequence: number; clinch?: string;
};
export type TeamHomeData = {
  leaders: { goals: Leader[]; assists: Leader[]; points: Leader[]; plusMinus: Leader[]; toi: Leader[] };
  ppPct: number; ppRank: number; pkPct: number; pkRank: number;
  sogPerGame: number; sogPerGameRank: number; sogaPerGame: number; sogaPerGameRank: number;
  lastFive: MiniGame[]; nextTen: MiniGame[];
  arena?: { name: string; capacity?: number };
  division: DivTeam[]; divisionName: string;
  playoffStatus?: { positionLabel?: string; playoffSeriesStatus?: string; hidden?: boolean };
  totalTeams: number;
};

export type OrgPlayer = {
  name: string; position?: string; age?: number;
  draftYear?: number; draftOverall?: number; draftRound?: number; undrafted?: boolean;
  signed: boolean; aavLabel?: string; contractEndYear?: number;
  nhlId?: string; lastTeamName?: string; lastTeamLeague?: string;
};
export type TeamOrganization = { players: OrgPlayer[]; source?: string; sourceUrl?: string };
