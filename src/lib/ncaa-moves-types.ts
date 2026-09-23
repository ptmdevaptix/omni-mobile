// Roster-changes shapes, mirroring omni-hockey's lib/ncaa-moves-types.ts. Same API, same types.

export type MoveConfidence = 'reported' | 'corroborated' | 'confirmed';

/** How a player arrived or left. "graduation" and "pro_signing" are derived read-side, not sourced. */
export type MoveDirection =
  | 'commit'
  | 'transfer_in'
  | 'transfer_out'
  | 'departure'
  | 'pro_signing'
  | 'graduation';

export type MoveTeamRef = { seo: string; name: string; abbr: string; logo: string };

export type RosterMove = {
  playerName: string;
  playerId: string | null;
  nhlId?: string;
  draft?: { year: number; team: string; overall: number } | null;
  direction: MoveDirection;
  position: string | null;
  classYear: number | null;
  confidence: MoveConfidence;
  sources: string[];
  otherTeam: MoveTeamRef | null;
};

export type RosterMovesResponse = {
  season: string;
  incoming: RosterMove[];
  outgoing: RosterMove[];
  error?: string;
};
