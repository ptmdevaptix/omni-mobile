// Followed players and the clubs they put among the favorites (docs/design/prospect-follows.md on
// the web). Pure logic, mirrored from lib/use-follows.ts (mergeClubs), lib/favorite-games.ts (the
// derived index and the foot-line labels) and lib/followed-on-game.ts (joining a followed player to a
// box score) — the two must not drift.
import type { GameDetail, ScratchedPlayer } from './game-detail-types';
import { favMatchIds } from './home';
import { foldAccents } from './team-name';
import type { ScoreGame } from './types';

// ── Shapes the API answers with ───────────────────────────────────────────────

/** GET /follows/players?ids=… — where each starred player plays NOW. */
export type FollowedPlayerClub = {
  /** The id as the star stored it — the key the client joins back on. */
  id: string;
  /** Our canonical row, or null when the id resolves to nobody. */
  playerId: string | null;
  name: string;
  position?: string;
  /** The feeds' own ids for him (nhl, ht_{client}, sidearm) — what a box score can be joined on. */
  externalIds?: Record<string, string | number>;
  club: { teamId: string; name: string; abbr?: string; league?: string; logo?: string } | null;
};

/** GET /team/{abbr}/prospect-clubs — an NHL org's prospects, grouped by the club each plays for now. */
export type ProspectClubs = {
  team: string;
  affiliates: { teamId: string; league: 'AHL' | 'ECHL'; name: string; location: string; abbr: string; logo: string | null }[];
  clubs: { teamId: string; name: string; league?: string; logo?: string; affiliate?: 'AHL' | 'ECHL'; players: { id: string; name: string; position?: string; externalIds?: Record<string, string | number> }[] }[];
  uncovered: { name: string; league?: string; team?: string }[];
  unresolved: number;
  prospects: number;
  fetchedAt: string;
};

// ── Derived clubs ─────────────────────────────────────────────────────────────

export type DerivedPlayer = {
  id: string;
  name: string;
  /** The ids as the stars stored them, for joining back to the favorites list. */
  starIds: string[];
  /** The NHL org whose prospect switch put him here ("nyi"); absent for a hand-star. */
  via?: string;
  externalIds?: Record<string, string | number>;
};

export type DerivedClub = {
  teamId: string;
  name: string;
  league?: string;
  logo?: string;
  /** Set when the club is a followed org's own affiliate: { org: "nyi", league: "AHL" }. */
  affiliate?: { org: string; league: 'AHL' | 'ECHL' };
  players: DerivedPlayer[];
};

/** Two sources, one shape: hand-starred players and every prospect of each followed org. */
export function mergeClubs(stars: readonly FollowedPlayerClub[], orgs: readonly ProspectClubs[]): DerivedClub[] {
  const byTeam = new Map<string, DerivedClub>();
  const clubFor = (teamId: string, name: string, league?: string, logo?: string) => {
    const key = teamId.toLowerCase();
    if (!byTeam.has(key)) byTeam.set(key, { teamId, name, league, logo, players: [] });
    return byTeam.get(key)!;
  };
  for (const p of stars) {
    if (!p.club || !p.playerId) continue;
    const club = clubFor(p.club.teamId, p.club.name, p.club.league, p.club.logo);
    const existing = club.players.find((x) => x.id === p.playerId);
    if (existing) existing.starIds.push(p.id);
    else club.players.push({ id: p.playerId, name: p.name, starIds: [p.id], externalIds: p.externalIds });
  }
  for (const org of orgs) {
    for (const c of org.clubs) {
      const club = clubFor(c.teamId, c.name, c.league, c.logo);
      if (c.affiliate) club.affiliate = { org: org.team, league: c.affiliate };
      for (const p of c.players) {
        // A hand-star outranks the org: it survives the switch turning off, so it keeps its label.
        if (club.players.some((x) => x.id === p.id)) continue;
        club.players.push({ id: p.id, name: p.name, starIds: [], via: org.team, externalIds: p.externalIds });
      }
    }
  }
  return [...byTeam.values()];
}

/** Scoreboard team id → the derived club, under every id the club can appear as. */
export type DerivedIndex = Map<string, DerivedClub>;

export function buildDerivedIndex(clubs: readonly DerivedClub[]): DerivedIndex {
  const map: DerivedIndex = new Map();
  for (const c of clubs) for (const id of favMatchIds([c.teamId])) map.set(id, c);
  return map;
}

/** Scoreboard team ids → the org whose switch added the favorite, from the favorites' `via` tags. */
export function buildAffiliateIndex(teams: readonly { id: string; via?: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of teams) if (f.via) for (const id of favMatchIds([f.id])) map.set(id, f.via);
  return map;
}

/**
 * "A. Lee" — the initial and the surname. A bare surname is ambiguous on a card ("Misa" is three
 * players in our own data), and a full name does not fit the one line a card has to spend.
 */
function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return parts.length > 1 && parts[0] ? `${parts[0][0]}. ${last}` : last;
}

export type FollowReasonItem = {
  label: string;
  /** The followed player this item names, when it names one — so a card can gray him if he sat. */
  player?: DerivedPlayer;
  side?: 'away' | 'home';
};

const NO_AFFILIATES: ReadonlyMap<string, string> = new Map();

/**
 * Why a game is among the favorites, as short foot-line items the card can cycle through:
 * "Lechner (COL)" for an org's prospect, "Cook" for a hand-starred player, "NYI AFFILIATE" for an
 * affiliate the switch added. Empty when neither club is derived. Surnames only: one short line.
 */
export function followReasonItems(game: ScoreGame, derived: DerivedIndex, affiliateOf: ReadonlyMap<string, string> = NO_AFFILIATES): FollowReasonItem[] {
  if (derived.size === 0 && affiliateOf.size === 0) return [];
  const out: FollowReasonItem[] = [];
  const push = (item: FollowReasonItem) => { if (!out.some((o) => o.label === item.label)) out.push(item); };
  for (const side of ['away', 'home'] as const) {
    const teamId = side === 'away' ? game.awayTeamId : game.homeTeamId;
    const club = derived.get(teamId);
    // An affiliate the switch added is a favorite only because of the switch, and the card says so
    // even before any prospect is on its roster (AHL lists are empty until October).
    const viaOrg = affiliateOf.get(teamId) ?? club?.affiliate?.org;
    if (viaOrg) push({ label: `${viaOrg.toUpperCase()} AFFILIATE`, side });
    if (!club) continue;
    for (const p of club.players) {
      if (!p.via) push({ label: surname(p.name), player: p, side });
      else if (p.via !== viaOrg) push({ label: `${surname(p.name)} (${p.via.toUpperCase()})`, player: p, side });
      else push({ label: surname(p.name), player: p, side });   // on its own org's affiliate, the org is already said
    }
  }
  return out;
}

/** Why a club's NEXT game is among the favorites — the same items a live card would carry. */
export function reasonForTeam(teamId: string, derived: DerivedIndex, affiliateOf: ReadonlyMap<string, string>): string[] {
  const club = derived.get(teamId) ?? derived.get(teamId.toLowerCase());
  const viaOrg = affiliateOf.get(teamId) ?? club?.affiliate?.org;
  const items: string[] = [];
  if (viaOrg) items.push(`${viaOrg.toUpperCase()} AFFILIATE`);
  for (const p of club?.players ?? []) {
    const label = !p.via || p.via === viaOrg ? surname(p.name) : `${surname(p.name)} (${p.via.toUpperCase()})`;
    if (!items.includes(label)) items.push(label);
  }
  return items;
}

// ── Joining a followed player to a box score ──────────────────────────────────

export const nameKey = (name?: string | null) => foldAccents(name ?? '').toLowerCase().replace(/[^a-z]/g, '');

const NICKNAMES: Record<string, string> = {
  mike: 'michael', mickey: 'michael', bob: 'robert', bobby: 'robert', rob: 'robert',
  bill: 'william', billy: 'william', will: 'william', rick: 'richard', ricky: 'richard',
  dick: 'richard', tom: 'thomas', tommy: 'thomas', jack: 'john', johnny: 'john',
  jim: 'james', jimmy: 'james', joe: 'joseph', joey: 'joseph', tony: 'anthony',
  ted: 'edward', teddy: 'edward', ned: 'edward', hank: 'henry', harry: 'henry',
  chuck: 'charles', charlie: 'charles', tj: 'thomas', pat: 'patrick', paddy: 'patrick',
  nick: 'nicholas', nicky: 'nicholas',
  luke: 'lucas', nate: 'nathan', jake: 'jacob', gabe: 'gabriel',
  danny: 'daniel', drew: 'andrew', andy: 'andrew', zack: 'zachary',
  steve: 'stephen', steven: 'stephen', mikey: 'michael',
  dave: 'david', davey: 'david', kenny: 'kenneth', larry: 'lawrence',
  vinny: 'vincent', eddie: 'edward', frank: 'francis',
};
const formal = (n: string) => NICKNAMES[n] ?? n;

/** Identical, one a prefix of the other (josh/joshua), or a known diminutive (mike/michael). */
export function firstNameEquivalent(a?: string | null, b?: string | null): boolean {
  const x = nameKey(a), y = nameKey(b);
  if (!x || !y) return false;
  if (x === y || formal(x) === formal(y)) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 3 && long.startsWith(short);
}

/**
 * Does a box-score row name this followed player? By id where the feed's id is one we hold for him,
 * else by surname plus an equivalent or same-initial first name — the USHL writes "Teddy Lechner"
 * where our row says "Theodore".
 */
export function rowIsPlayer(row: { name: string; playerId?: number | string }, p: DerivedPlayer): boolean {
  if (row.playerId != null && p.externalIds) {
    const id = String(row.playerId);
    if (Object.values(p.externalIds).some((v) => String(v) === id)) return true;
  }
  const [rf, ...rrest] = row.name.trim().split(/\s+/);
  const [pf, ...prest] = p.name.trim().split(/\s+/);
  const rl = rrest.slice(-1)[0] ?? rf, pl = prest.slice(-1)[0] ?? pf;
  if (!rl || !pl || nameKey(rl) !== nameKey(pl)) return false;
  if (!rrest.length || !prest.length) return true;   // a bare surname on one side
  return firstNameEquivalent(rf, pf) || nameKey(rf)[0] === nameKey(pf)[0];
}

const CJRA = ['BCHL', 'AJHL', 'SJHL', 'MJHL', 'OJHL', 'CCHL'];

/** Every id the club on `side` could carry in the follows index — page ids and scoreboard aliases. */
export function gameTeamPageIds(detail: GameDetail, side: 'away' | 'home'): string[] {
  const t = side === 'away' ? detail.awayTeam : detail.homeTeam;
  const lg = (detail.league ?? '').toUpperCase();
  const id = t.teamId ?? '';
  let pageId: string | undefined;
  if (lg === 'NHL') pageId = t.abbr.toLowerCase();
  else if (lg === 'NCAA') pageId = id ? `ncaa-${id}` : undefined;
  else if (lg === 'AHL') pageId = id ? `ahl-${id}` : undefined;
  else if (lg === 'USHL') pageId = id ? `ushl-${id}` : undefined;
  else if (lg === 'OHL' || lg === 'WHL') pageId = id ? `chl-${lg.toLowerCase()}-${id}` : undefined;
  else if (lg === 'QMJHL') pageId = id ? `chl-lhjmq-${id}` : undefined;
  else if (CJRA.includes(lg)) pageId = id ? `cjra-${lg.toLowerCase()}-${id}` : undefined;
  else if (lg === 'SHL' || lg === 'LIIGA' || lg === 'ELH') pageId = id ? `${lg.toLowerCase()}-${id}` : undefined;
  return pageId ? [...favMatchIds([pageId])].map((x) => x.toLowerCase()) : [];
}

export type DressedStatus = 'dressed' | 'scratched' | 'unknown';

/**
 * Whether a followed player on `side` dressed. "Scratched" comes ONLY from the scratches list, which
 * exists only once a whole lineup does — a box score that lists just the scorers is not evidence
 * anyone sat.
 */
export function dressedStatus(detail: GameDetail, side: 'away' | 'home', p: DerivedPlayer): DressedStatus {
  const scratched: ScratchedPlayer[] | undefined = detail.scratches?.[side];
  if (scratched?.some((r) => rowIsPlayer(r, p))) return 'scratched';
  const roster = detail.rosters?.[side];
  if (roster && [...roster.forwards, ...roster.defense, ...roster.goalies].some((r) => rowIsPlayer(r, p))) return 'dressed';
  return 'unknown';
}

export type FollowedOnGame = DerivedPlayer & { side: 'away' | 'home'; status: DressedStatus };

/** The user's followed players on either club of a game, with whether each dressed (once knowable). */
export function followedOnGame(detail: GameDetail | null | undefined, clubs: readonly DerivedClub[]): FollowedOnGame[] {
  const out: FollowedOnGame[] = [];
  if (!detail) return out;
  for (const side of ['away', 'home'] as const) {
    const ids = new Set(gameTeamPageIds(detail, side));
    for (const club of clubs) {
      if (![...favMatchIds([club.teamId])].some((x) => ids.has(x.toLowerCase()))) continue;
      for (const p of club.players) out.push({ ...p, side, status: dressedStatus(detail, side, p) });
    }
  }
  return out;
}

export const followedLabel = (p: DerivedPlayer) => (p.via ? `${surname(p.name)} (${p.via.toUpperCase()})` : surname(p.name));
