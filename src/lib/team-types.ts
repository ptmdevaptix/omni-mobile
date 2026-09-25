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
  birthDate?: string;
  nhlId?: string;
  /** The player's canonical page, as STORED on his players row — never derived. Absent when he has no row. */
  playerSlug?: string;
  /** The NHL club holding his rights (abbreviation), for the crest beside his name. Rare on a junior roster. */
  nhlRights?: string;
};
export type RosterResponse = {
  forwards: RosterPlayer[];
  defensemen: RosterPlayer[];
  goalies: RosterPlayer[];
  summary?: { avgAge: number; avgHeight: string; avgWeight: number };
  estimated?: boolean;
  incomingOnly?: boolean;
  season?: string;
  /** Which seasons this club actually has a roster for — the selector offers no dead season. */
  availableSeasons?: string[];
  error?: string;
};

export type ScheduleGame = {
  id: number;
  date: string;
  startTimeUTC: string;
  /** The arena's zone, for showing the start on its clock (lib/game-time). */
  venueTimeZone?: string;
  opponentAbbr: string;
  opponentName?: string;
  opponentId?: string;
  opponentLogo: string;
  opponentDarkLogo: string;
  isHome: boolean;
  teamScore?: number;
  opponentScore?: number;
  result?: 'W' | 'L' | 'OTL';
  preseason?: boolean; // exhibition — PRE tag, not part of the record
  overtime?: 'OT' | 'SO';
  state: 'FINAL' | 'UPCOMING' | 'POSTPONED';
  /** Networks for the country this matchup leads with; `altBroadcasts` is the other country's. */
  broadcasts?: string[];
  altBroadcasts?: string[];
  broadcastCountry?: 'CA' | 'US';
  /** Per network: which country it serves and whether it is national, in-market or out-of-market. */
  broadcastDetail?: { network: string; country?: 'CA' | 'US'; scope?: 'national' | 'in-market' | 'out-of-market'; side?: 'H' | 'A' }[];
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
  state: 'FINAL' | 'UPCOMING'; startTimeUTC?: string; venueTimeZone?: string; postseason?: string;
};
export type DivTeam = {
  id?: string; abbr: string; name: string; logo: string; darkLogo: string;
  points: number; gp: number; wins: number; losses: number; otl: number;
  /** Overtime and shootout wins, where the league splits them from `wins` (Europe's 3-2-1-0 tables). */
  otw?: number; divisionSequence: number; clinch?: string;
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
  /** Rank cut lines for the table's bands ([last playoff, last play-in, last safe]), where a league has them (Europe). */
  cuts?: number[];
};

export type OrgPlayer = {
  name: string; position?: string; age?: number;
  draftYear?: number; draftOverall?: number; draftRound?: number; undrafted?: boolean;
  signed: boolean; aavLabel?: string; contractEndYear?: number;
  nhlId?: string; lastTeamName?: string; lastTeamLeague?: string;
  // The club he plays for, as a mark: its crest where we carry one, else its country's flag.
  lastTeamLogo?: string | null; lastTeamFlag?: string;
};
export type TeamOrganization = { players: OrgPlayer[]; source?: string; sourceUrl?: string };
