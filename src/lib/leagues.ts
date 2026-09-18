// Canonical league model for the app: the picker entries, per-league API endpoints, and typed fetchers.
// This is the single source of truth the content tabs (Scores/Standings/Stats/Teams) read from.
import { createContext, useContext } from "react";

import { api } from "./api";
import { detectRegion, type Region } from "./region";
import type { ScoreGame, ScoresResponse, ScoreTeam, StandingsTeam } from "./types";

export type LeagueId =
  | "nhl" | "ahl" | "echl"
  | "ohl" | "whl" | "qmjhl"
  | "ushl" | "ncaa"
  // Canadian Junior A, west to east. Six separate leagues that share one scoreboard feed and one
  // top-level block, exactly as OHL/WHL/QMJHL share the CHL's — see CJRA_LEAGUES in the web repo.
  | "bchl" | "ajhl" | "sjhl" | "mjhl" | "ojhl" | "cchl";

export type LeagueConfig = {
  id: LeagueId;
  label: string; // short label for the picker
  name: string; // full name
  scoresPath: string; // scores endpoint
  // Sub-league code, for the leagues that share a combined feed with their siblings: it filters that
  // feed down to this league's games and is the `sub` the game-days endpoint expects. Named for what
  // it does rather than for the CHL, which was the only block that had one until CJRA arrived.
  subCode?: string;
  // The block this league belongs to, when the game-days endpoint groups it under one — "CHL" for
  // OHL/WHL/QMJHL, "CJRA" for the Canadian Jr A six. Absent means the league is its own top level.
  topCode?: string;
  standingsPath: string;
  standingsKind: "wlotl" | "ncaa"; // NHL/AHL/CHL vs NCAA (W-L-T, conference-based)
  statsPath: string; // "" = no leader boards for this league
  teamKind: "nhl" | "ahl" | "echl" | "chl" | "ushl" | "ncaa" | "cjra"; // how to build a /teams/<id> route id from a standings row
  hasConferences?: boolean; // NCAA
};

export const LEAGUES: LeagueConfig[] = [
  { id: "nhl", label: "NHL", name: "National Hockey League", scoresPath: "/scores", standingsPath: "/nhl-standings", standingsKind: "wlotl", statsPath: "/nhl-stats", teamKind: "nhl" },
  { id: "ahl", label: "AHL", name: "American Hockey League", scoresPath: "/ahl-scores", standingsPath: "/ahl-standings", standingsKind: "wlotl", statsPath: "/ahl-stats", teamKind: "ahl" },
  // Scores are a seeded slate + results overlay and there is no stats feed, so no leader boards; the
  // web's ECHL team pages carry identity + affiliations, schedule and roster, and so do ours.
  { id: "echl", label: "ECHL", name: "ECHL", scoresPath: "/echl-scores", standingsPath: "/echl-standings", standingsKind: "wlotl", statsPath: "", teamKind: "echl" },
  { id: "ohl", label: "OHL", name: "Ontario Hockey League", scoresPath: "/chl-scores", subCode: "OHL", topCode: "CHL", standingsPath: "/ht-standings/ohl", standingsKind: "wlotl", statsPath: "/chl-stats/ohl", teamKind: "chl" },
  { id: "whl", label: "WHL", name: "Western Hockey League", scoresPath: "/chl-scores", subCode: "WHL", topCode: "CHL", standingsPath: "/ht-standings/whl", standingsKind: "wlotl", statsPath: "/chl-stats/whl", teamKind: "chl" },
  { id: "qmjhl", label: "QMJHL", name: "Quebec Maritimes Junior Hockey League", scoresPath: "/chl-scores", subCode: "QMJHL", topCode: "CHL", standingsPath: "/ht-standings/qmjhl", standingsKind: "wlotl", statsPath: "/chl-stats/qmjhl", teamKind: "chl" },
  { id: "ushl", label: "USHL", name: "United States Hockey League", scoresPath: "/ushl-scores", standingsPath: "/ht-standings/ushl", standingsKind: "wlotl", statsPath: "/ht-stats/ushl", teamKind: "ushl" },
  { id: "ncaa", label: "NCAA", name: "NCAA Division I", scoresPath: "/ncaa-scores", standingsPath: "/ncaa-standings", standingsKind: "ncaa", statsPath: "/ncaa-stats", teamKind: "ncaa", hasConferences: true },
  // ── Canadian Junior A ───────────────────────────────────────────────────────
  // Six leagues on the same HockeyTech platform, each with its own standings and stats but sharing
  // the /cjra-scores feed the way OHL/WHL/QMJHL share /chl-scores. Listed west to east, matching
  // CJRA_LEAGUES in the web repo; the two orders must not drift.
  { id: "bchl", label: "BCHL", name: "British Columbia Hockey League", scoresPath: "/cjra-scores", subCode: "BCHL", topCode: "CJRA", standingsPath: "/ht-standings/bchl", standingsKind: "wlotl", statsPath: "/ht-stats/bchl", teamKind: "cjra" },
  { id: "ajhl", label: "AJHL", name: "Alberta Junior Hockey League", scoresPath: "/cjra-scores", subCode: "AJHL", topCode: "CJRA", standingsPath: "/ht-standings/ajhl", standingsKind: "wlotl", statsPath: "/ht-stats/ajhl", teamKind: "cjra" },
  { id: "sjhl", label: "SJHL", name: "Saskatchewan Junior Hockey League", scoresPath: "/cjra-scores", subCode: "SJHL", topCode: "CJRA", standingsPath: "/ht-standings/sjhl", standingsKind: "wlotl", statsPath: "/ht-stats/sjhl", teamKind: "cjra" },
  { id: "mjhl", label: "MJHL", name: "Manitoba Junior Hockey League", scoresPath: "/cjra-scores", subCode: "MJHL", topCode: "CJRA", standingsPath: "/ht-standings/mjhl", standingsKind: "wlotl", statsPath: "/ht-stats/mjhl", teamKind: "cjra" },
  { id: "ojhl", label: "OJHL", name: "Ontario Junior Hockey League", scoresPath: "/cjra-scores", subCode: "OJHL", topCode: "CJRA", standingsPath: "/ht-standings/ojhl", standingsKind: "wlotl", statsPath: "/ht-stats/ojhl", teamKind: "cjra" },
  { id: "cchl", label: "CCHL", name: "Central Canada Hockey League", scoresPath: "/cjra-scores", subCode: "CCHL", topCode: "CJRA", standingsPath: "/ht-standings/cchl", standingsKind: "wlotl", statsPath: "/ht-stats/cchl", teamKind: "cjra" },
];

export const leagueById = (id: LeagueId): LeagueConfig => LEAGUES.find((l) => l.id === id) ?? LEAGUES[0];

// Per-league color set (OHL/WHL/QMJHL share the CHL tint). Each entry is [light, dark]:
//  - bg:   screen / header / tab-bar shade (faint)
//  - card: game-card shade (a touch deeper than bg; very dark in dark mode)
//  - pill: the SELECTED league pill — more saturated/noticeable (darker in light, lighter in dark)
type LeagueTint = { bg: [string, string]; card: [string, string]; pill: [string, string] };
const LEAGUE_TINTS: Record<string, LeagueTint> = {
  nhl:  { bg: ['#eef0f2', '#17181a'], card: ['#e2e5e9', '#0d0e0f'], pill: ['#3a3d42', '#c8ccd2'] }, // neutral gray
  ahl:  { bg: ['#f7f1e6', '#2b1d08'], card: ['#eee3cf', '#160f04'], pill: ['#9a6a12', '#e6ab3e'] }, // amber
  chl:  { bg: ['#f8ecec', '#301113'], card: ['#f0dada', '#190a0b'], pill: ['#a82a30', '#f26a70'] }, // red
  ncaa: { bg: ['#eaeef8', '#111f42'], card: ['#dae2f4', '#0a1024'], pill: ['#2a4a9c', '#6a97ff'] }, // blue
  ushl: { bg: ['#eaf4ec', '#0c2a19'], card: ['#d8ebdd', '#08160e'], pill: ['#1f7a45', '#46cc7e'] }, // green
  // The six Canadian Jr A leagues share one tint, as OHL/WHL/QMJHL share the CHL's: the color
  // encodes the BLOCK, and six hues would imply six unrelated competitions. The CHL's own red, since
  // Sep 2026: all of it is Canadian junior hockey, one tier by color, and merging early (before the
  // purple it had for a week became a habit) keeps a hue free for leagues still to come.
  cjra: { bg: ['#f8ecec', '#301113'], card: ['#f0dada', '#190a0b'], pill: ['#a82a30', '#f26a70'] }, // red, with the CHL
  // Europe — teal, shared by the SHL, Liiga and the Czech Extraliga (all on web as of Sep 2026; not
  // yet in this app). The light pill is kept brighter than the others: at their depth it drifted
  // toward both NCAA's blue and USHL's green.
  shl:   { bg: ['#e8f5f3', '#0c2a27'], card: ['#d4ece8', '#081615'], pill: ['#159c92', '#45dfd0'] }, // teal
  liiga: { bg: ['#e8f5f3', '#0c2a27'], card: ['#d4ece8', '#081615'], pill: ['#159c92', '#45dfd0'] }, // teal
  elh:   { bg: ['#e8f5f3', '#0c2a27'], card: ['#d4ece8', '#081615'], pill: ['#159c92', '#45dfd0'] }, // teal
};
// The ECHL shares the AHL's colour, as on the web: what the colour encodes is the tier, and both are
// North American minor pro. Two near-identical hues would imply a distinction that isn't there.
const CJRA_IDS = new Set<LeagueId>(['bchl', 'ajhl', 'sjhl', 'mjhl', 'ojhl', 'cchl']);
const leagueKey = (id: LeagueId): string =>
  id === 'ohl' || id === 'whl' || id === 'qmjhl' ? 'chl'
  : CJRA_IDS.has(id) ? 'cjra'
  : id === 'echl' ? 'ahl'
  : id;

export function leagueColors(id: PickerId, dark: boolean): { bg: string; card: string; pill: string } {
  const tint = LEAGUE_TINTS[isBlock(id) ? (id === 'CHL' ? 'chl' : 'cjra') : leagueKey(id as LeagueId)] ?? LEAGUE_TINTS.nhl;
  const i = dark ? 1 : 0;
  return { bg: tint.bg[i], card: tint.card[i], pill: tint.pill[i] };
}

// --- Shared selection (which league is active across the content tabs) -------
export const LeagueContext = createContext<{ league: PickerId; setLeague: (id: PickerId) => void }>({
  league: "nhl",
  setLeague: () => {},
});
export const useLeague = () => useContext(LeagueContext);

// --- Fetchers ----------------------------------------------------------------

// The real league a game belongs to. `top` is the top-level TAB, not the league: every OHL/WHL/QMJHL
// game comes back as top: "CHL" (see HT_LEAGUES in the web repo), so filtering on `top` silently drops
// every CHL game. The game id prefix is the dependable key — it's the same one the web app's
// /games/{prefix}-{id} routes use. `path` is NOT a safe first choice: it holds the sub-league on CHL
// feeds (["QMJHL"]) but the conference/division on NHL ones (["EAST","ATL","MET"]).
const KNOWN_LEAGUES = new Set(["NHL", "AHL", "ECHL", "OHL", "WHL", "QMJHL", "NCAA", "USHL",
  "BCHL", "AJHL", "SJHL", "MJHL", "OJHL", "CCHL"]);

export function gameLeague(g: ScoreGame): string {
  const prefix = (g.id ?? "").split("-")[0].toUpperCase();
  if (KNOWN_LEAGUES.has(prefix)) return prefix;
  const fromPath = (g.path?.[0] ?? "").toUpperCase();
  if (KNOWN_LEAGUES.has(fromPath)) return fromPath;
  return (g.top ?? "").toUpperCase();
}

/** True when this fixture is between two leagues (an OHL side visiting a QMJHL rink, say). */
export const isInterleague = (g: ScoreGame): boolean => (g.leagues?.length ?? 0) > 1;

/**
 * Each family names cross-league play in its own vernacular. "Interleague" is the CHL's word for an
 * OHL side visiting a QMJHL rink; college hockey calls the same idea non-conference, and would read a
 * section headed "Interleague (NCAA)" as jargon from another sport.
 */
const INTERLEAGUE_LABEL: Record<string, string> = {
  NCAA: 'NCAA Non-Conf.',
};

/**
 * Section title for an interleague fixture, scoped to the family both sides belong to:
 *
 *   OHL vs QMJHL      → "Interleague (CHL)"
 *   NCAA cross-conf.  → "NCAA Non-Conf."       (when conference grouping arrives)
 *   NCAA vs U Sports  → "Interleague"          — no shared parent
 *
 * Scoping matters because a bare "Interleague" stops being meaningful the moment a second family can
 * produce one: two unrelated fixtures would collapse into one section. The parent comes from the API
 * so both clients label identically.
 */
export const interleagueTitle = (g: ScoreGame): string => {
  const parent = g.interleagueParent;
  if (!parent) return 'Interleague';
  return INTERLEAGUE_LABEL[parent] ?? `Interleague (${parent})`;
};

/**
 * A game belongs to a league tab if it is that league's own game OR it is an interleague fixture
 * involving it. The API dedupes an interleague game to a single entry filed under the host league, so
 * without the second test an OHL supporter would not find their team's game on the OHL tab at all.
 */
const inLeague = (g: ScoreGame, code: string) => {
  const c = code.toUpperCase();
  return gameLeague(g) === c || !!g.leagues?.includes(c);
};

// Scores for one league. `date` omitted = whatever the feed considers current (the NHL feed answers with
// the next day that has games, rather than an empty today).
export async function fetchScores(id: PickerId, date?: string, followed: readonly string[] = []): Promise<ScoresResponse> {
  // A block's members share one endpoint, so "all of it" is that endpoint with no sub-filter — and
  // when the reader follows only some of the block, it is filtered to those. Selecting CJRA while
  // following two of the six should not hand back the other four.
  if (isBlock(id)) {
    const members = leaguesIn(id, followed);
    const cfg = leagueById(members[0]);
    const r = await api<ScoresResponse>(date ? `${cfg.scoresPath}?date=${date}` : cfg.scoresPath);
    const codes = new Set(members.map((m) => leagueById(m).subCode!).filter(Boolean));
    const all = blockOf(id)!.members.length === members.length;
    return { ...r, games: all ? (r.games ?? []) : (r.games ?? []).filter((g) => [...codes].some((c) => inLeague(g, c))) };
  }
  const cfg = leagueById(id as LeagueId);
  const r = await api<ScoresResponse>(date ? `${cfg.scoresPath}?date=${date}` : cfg.scoresPath);
  const games = cfg.subCode ? (r.games ?? []).filter((g) => inLeague(g, cfg.subCode!)) : (r.games ?? []);
  return { ...r, games };
}

// Days that actually have games, for the Scores pager. Hockey schedules are sparse — paging by calendar
// day would walk users through empty screens (39 of them, right now, between today and NHL opening
// night), so the pager's unit is a *slate*: one swipe = one day that has games.
//
// NCAA is not covered by the endpoint (no season-wide feed upstream); it answers { supported: false },
// and the caller falls back to the single live-plus-pin view.
export async function fetchGameDays(
  id: PickerId,
  from: string,
  to: string,
  followed: readonly string[] = [],
): Promise<string[]> {
  const block = isBlock(id) ? blockOf(id)! : undefined;
  const members = leaguesIn(id, followed);
  const cfg = leagueById(block ? block.members[0] : (id as LeagueId));
  const top = cfg.topCode ?? cfg.label;

  const ask = async (sub?: string): Promise<string[] | null> => {
    const qs = new URLSearchParams({ from, to, top, ...(sub ? { sub } : {}) });
    const r = await api<{ days?: Record<string, number>; supported?: boolean }>(`/game-days?${qs.toString()}`);
    // NCAA has no season-wide feed upstream and answers { supported: false }; the caller falls back
    // to the single live-plus-pin view. Not the same as a league with no games.
    return r.supported === false ? null : Object.keys(r.days ?? {});
  };

  /**
   * The slate list has to cover exactly the leagues the games are filtered to.
   *
   * A block with every member showing is one call with no `sub` — every day any of its leagues plays.
   * A block NARROWED to what the reader follows is one call PER member, unioned here.
   *
   * Per member rather than one call naming them all, because `sub` takes a single league: an endpoint
   * given "BCHL,AJHL" recognises neither and answers for the whole block. That is what left the pager
   * on days when only the SJHL played, where the games were then filtered away to nothing — a CJRA tab
   * with no games at all. Asking one league at a time is a question every deployment can answer, so
   * this cannot drift out of step with the API again.
   */
  if (!block || members.length === block.members.length) {
    return (await ask(!block && cfg.subCode ? cfg.subCode : undefined))?.sort() ?? [];
  }

  const lists = await Promise.all(members.map((m) => ask(leagueById(m).subCode)));
  return [...new Set(lists.flatMap((l) => l ?? []))].sort();
}

// W-L-OTL standings (NHL/AHL/CHL), normalized to StandingsTeam with a tap-through routeId.
export async function fetchStandings(id: LeagueId): Promise<StandingsTeam[]> {
  const cfg = leagueById(id);
  const raw = await api<{ teams?: any[] }>(cfg.standingsPath);
  // ECHL team pages key on the club's echl.com slug, not the HockeyTech id the standings carry (five
  // clubs have no discoverable id), so the tap-through id comes from the club registry, joined on code.
  const echlSlugByCode = new Map<string, string>();
  if (cfg.teamKind === "echl") {
    const reg = await api<{ teams?: { code?: string; slug?: string }[] }>("/echl-teams").catch(() => ({ teams: [] }));
    for (const t of reg.teams ?? []) if (t.code && t.slug) echlSlugByCode.set(t.code.toUpperCase(), t.slug);
  }
  return (raw.teams ?? []).map((r) => ({
    name: r.name,
    abbr: r.abbr,
    logo: r.logo ?? r.logoMain ?? r.logo50,
    division: r.division,
    conference: r.conference,
    gp: r.gp ?? 0,
    w: r.w ?? 0,
    l: r.l ?? 0,
    otl: r.otl ?? 0,
    pts: r.pts ?? 0,
    clinch: r.clinch ?? undefined,
    routeId:
      cfg.teamKind === "ahl" ? `ahl-${r.teamId}`
      : cfg.teamKind === "echl" ? `echl-${echlSlugByCode.get(String(r.abbr ?? "").toUpperCase()) ?? String(r.abbr ?? "").toLowerCase()}`
      : cfg.teamKind === "chl" ? `chl-${cfg.id}-${r.teamId}`
      : cfg.teamKind === "ushl" ? `ushl-${r.teamId}`
      // `cjra-<league>-<id>`, nested the way the CHL nests — the web builds the same id from
      // teamIdPrefix, and a team page keys on it.
      : cfg.teamKind === "cjra" ? `cjra-${cfg.id}-${r.teamId}`
      : String(r.abbr ?? "").toLowerCase(),
  }));
}

// NHL standings: full column set (kept un-normalized) for the grouped, rotate-to-reveal table.
export type NhlStandingsTeam = {
  name: string; abbr: string; logo?: string; darkLogo?: string;
  division: string; conference: string; clinch: string | null;
  gp: number; w: number; l: number; otl: number; pts: number;
  rw: number; row: number; sow: number; sol: number;
  homeW: number; homeL: number; homeOtl: number;
  awayW: number; awayL: number; awayOtl: number;
  gf: number; ga: number; diff: number;
  l10W: number; l10L: number; l10Otl: number;
  streakCode: string; streakCount: number;
  divisionSequence: number; wildcardSequence: number; conferenceSequence: number; leagueSequence: number;
  routeId: string;
};

export async function fetchNhlStandings(): Promise<NhlStandingsTeam[]> {
  const raw = await api<{ teams?: any[] }>("/nhl-standings");
  return (raw.teams ?? []).map((t) => ({ ...t, routeId: String(t.abbr ?? "").toLowerCase() })) as NhlStandingsTeam[];
}

// NCAA standings: flat team list with overall (o*) + conference (c*) records; group by conference.
export type NcaaStandingsTeam = {
  name: string; abbr: string; logo?: string; conference: string; routeId: string;
  oW: number; oL: number; oT: number; cW: number; cL: number; cT: number; cPts: number;
};
export type NcaaConferenceGroup = { conference: string; teams: NcaaStandingsTeam[] };

export async function fetchNcaaStandings(): Promise<NcaaConferenceGroup[]> {
  const raw = await api<{ teams?: any[] }>("/ncaa-standings");
  const teams: NcaaStandingsTeam[] = (raw.teams ?? []).map((r) => ({
    name: r.name,
    abbr: r.abbr,
    logo: r.logo,
    // NCAA_INDEPENDENTS, not "Independent" — the singular spelling used to be the fallback here, which
    // would have rendered a second, near-empty group beside the real one for any team missing a
    // conference. The API's own bucket is plural.
    conference: r.conference ?? NCAA_INDEPENDENTS,
    routeId: `ncaa-${r.seo}`,
    oW: r.oW ?? 0, oL: r.oL ?? 0, oT: r.oT ?? 0,
    cW: r.cW ?? 0, cL: r.cL ?? 0, cT: r.cT ?? 0, cPts: r.cPts ?? 0,
  }));
  const byConf = new Map<string, NcaaStandingsTeam[]>();
  for (const t of teams) {
    if (!byConf.has(t.conference)) byConf.set(t.conference, []);
    byConf.get(t.conference)!.push(t);
  }
  return [...byConf.entries()]
    .map(([conference, list]) => ({ conference, teams: list.sort((a, b) => b.cPts - a.cPts || b.cW - a.cW) }))
    .sort((a, b) => compareNcaaConferences(a.conference, b.conference));
}

// Home hub: league grouping order for the aggregated scoreboard, keyed by game.top.
// FUTURE: make this country-aware — default US = NHL, AHL, NCAA, OHL, WHL, QMJHL (NCAA ahead of CHL);
// default Canada = NHL, AHL, OHL, WHL, QMJHL, NCAA (CHL ahead of NCAA). Eventually user-customizable order.
// Region-aware league order, mirroring the web app's lib/league-order.ts (whose US row also carries
// "MC" ahead of the CHL block during the Memorial Cup — a stopgap pseudo-league that belongs in the
// planned events model, so it's deliberately absent here).
//
// The Canadian junior leagues travel together (CHL then CJRA — they share a color) and so do the
// American pair (NCAA then USHL); the two pairs swap on region: US users see NCAA/USHL first, everyone
// else sees CHL/CJRA first. Region detection is best-effort — see ./region.
// West to east — matching CJRA_SUB_LEAGUES in the web's lib/league-order.ts.
const CJRA_ORDER = ["BCHL", "AJHL", "SJHL", "MJHL", "OJHL", "CCHL"] as const;

const LEAGUE_ORDER: Record<Region, readonly string[]> = {
  US: ["NHL", "AHL", "ECHL", "NCAA", "USHL", "OHL", "WHL", "QMJHL", ...CJRA_ORDER, "SHL", "LIIGA", "ELH"],
  INTL: ["NHL", "AHL", "ECHL", "OHL", "WHL", "QMJHL", ...CJRA_ORDER, "NCAA", "USHL", "SHL", "LIIGA", "ELH"],
};

// Section order for the Home hub, by the device's region.
export function homeLeagueOrder(region: Region = detectRegion()): readonly string[] {
  return LEAGUE_ORDER[region] ?? LEAGUE_ORDER.INTL;
}

/**
 * The family a league section belongs to, matching `interleagueParent` on a game.
 *
 * Used to place an interleague section with its own family rather than at a fixed position — the
 * regional orderings above move NCAA around, and "Interleague (CHL)" has to travel with OHL/WHL/QMJHL
 * rather than sitting wherever it was hardcoded.
 */
/**
 * NCAA conference display order: alphabetical, with Independents ALWAYS last.
 *
 * Independents is not a conference; it is the bucket for teams belonging to none. Plain alphabetical
 * sorting drops it between Hockey East and NCHC, presenting it as a peer of the real conferences.
 * Mirrors lib/ncaa-conferences.ts in the web repo — the two must not drift.
 */
export const NCAA_INDEPENDENTS = 'Independents';

export function compareNcaaConferences(a: string, b: string): number {
  const aLast = a === NCAA_INDEPENDENTS ? 1 : 0;
  const bLast = b === NCAA_INDEPENDENTS ? 1 : 0;
  return aLast - bLast || a.localeCompare(b);
}

/**
 * NCAA scoreboard groups: a game is filed under a conference only when both sides are in it; anything
 * else — two conferences meeting, an Independent on either side, an unknown side — is Non-Conference
 * (the API stamps `game.conference`). Order: conferences alphabetical, Non-Conference last. Mirrors
 * lib/ncaa-conferences.ts in the web repo.
 */
export const NCAA_NON_CONFERENCE = 'Non-Conference';

export function compareNcaaGroups(a: string, b: string): number {
  const aLast = a === NCAA_NON_CONFERENCE ? 1 : 0;
  const bLast = b === NCAA_NON_CONFERENCE ? 1 : 0;
  return aLast - bLast || compareNcaaConferences(a, b);
}

/** Split an NCAA slate into [group, games] pairs in display order. Unstamped games go to Non-Conference. */
export function groupNcaaByConference(games: ScoreGame[]): [string, ScoreGame[]][] {
  const by = new Map<string, ScoreGame[]>();
  for (const g of games) {
    const k = g.conference ?? NCAA_NON_CONFERENCE;
    if (!by.has(k)) by.set(k, []);
    by.get(k)!.push(g);
  }
  return [...by.entries()].sort(([a], [b]) => compareNcaaGroups(a, b));
}

/**
 * A block's slate, split into one run per member league.
 *
 * A combined CHL slate is a list a reader has to sort in their head — the same reason the NCAA slate
 * carries conference headings. Ordered by the block's own member order, not by size, so the headings
 * stay put from day to day; a member with nothing on is simply absent.
 *
 * An interleague fixture is filed once, under the host league, the way the feed files it. Both
 * leagues are inside the same block here, so there is nothing to be gained by listing it twice.
 */
export function groupByMemberLeague(games: ScoreGame[], members: readonly LeagueId[]): [string, ScoreGame[]][] {
  const order = members.map((m) => leagueById(m));
  const by = new Map<string, ScoreGame[]>();
  for (const g of games) {
    const home = gameLeague(g);
    const cfg = order.find((l) => l.subCode?.toUpperCase() === home) ?? order.find((l) => inLeague(g, l.subCode ?? ''));
    if (!cfg) continue;   // not one of the leagues on show; fetchScores has already filtered these out
    if (!by.has(cfg.label)) by.set(cfg.label, []);
    by.get(cfg.label)!.push(g);
  }
  return order.map((l) => [l.label, by.get(l.label) ?? []] as [string, ScoreGame[]]).filter(([, gs]) => gs.length);
}

// NHL divisions in conference order (Eastern, then Western) rather than alphabetically, matching the
// web team grid. Alphabetical interleaves the conferences: Atlantic, Central, Metropolitan, Pacific.
const NHL_DIVISION_ORDER = ['Atlantic', 'Metropolitan', 'Central', 'Pacific'];

/**
 * Order the group headers on the Teams screen.
 *
 * Per league, because the right order differs: the NHL has a real conference sequence, the NCAA wants
 * Independents pinned last (it is a residual bucket, not a conference), and everything else reads fine
 * alphabetically.
 */
export function compareTeamGroups(league: LeagueId, a: string, b: string): number {
  if (league === 'ncaa') return compareNcaaConferences(a, b);
  if (league === 'nhl') {
    const rank = (g: string) => {
      const i = NHL_DIVISION_ORDER.indexOf(g);
      return i === -1 ? NHL_DIVISION_ORDER.length : i;   // unknown divisions sort last, still shown
    };
    return rank(a) - rank(b) || a.localeCompare(b);
  }
  return a.localeCompare(b);
}

export function leagueFamily(label: string): string {
  const l = label.toUpperCase();
  if (l === 'OHL' || l === 'WHL' || l === 'QMJHL') return 'CHL';
  // Cross-league play is COMMON here — the six share a border and a schedule — so the family has to
  // be right or an OJHL side visiting a CCHL rink lands in its own stray section.
  if ((CJRA_ORDER as readonly string[]).includes(l)) return 'CJRA';
  return l;
}

/**
 * Leagues that group under one pill.
 *
 * Mirrors LEAGUE_HIERARCHY in the web repo. The point is the top row: fourteen flat pills is a wall,
 * and three of them are the CHL and six are Canadian Jr A — groupings a reader thinks of as one
 * thing until they want a specific league. Collapsed, the default row is six pills instead of
 * fourteen, which is what the web shows.
 */
export type BlockKey = 'CHL' | 'CJRA';

/**
 * What the picker can have selected: a league, or a whole block.
 *
 * A block is a real selection, not a disclosure state — "CHL" means all three leagues, the way it
 * does on the web. Screens that can honour that do (Scores shows the combined slate); screens that
 * cannot resolve it to a member and say so with their own chips (Standings has no all-CHL table).
 */
export type PickerId = LeagueId | BlockKey;

export type LeagueBlock = { key: BlockKey; label: string; members: readonly LeagueId[] };

export const LEAGUE_BLOCKS: readonly LeagueBlock[] = [
  { key: 'CHL', label: 'CHL', members: ['ohl', 'whl', 'qmjhl'] },
  // Not "CJHL": the BCHL left that organisation in 2023, so the real acronym would be wrong for a
  // grouping that includes it. Same name the web uses.
  { key: 'CJRA', label: 'CJRA', members: ['bchl', 'ajhl', 'sjhl', 'mjhl', 'ojhl', 'cchl'] },
];

export const isBlock = (id: PickerId): id is BlockKey => id === 'CHL' || id === 'CJRA';

export const blockOf = (id: PickerId): LeagueBlock | undefined =>
  isBlock(id) ? LEAGUE_BLOCKS.find((b) => b.key === id)
              : LEAGUE_BLOCKS.find((b) => b.members.includes(id as LeagueId));

/**
 * The concrete leagues a selection stands for — one for a league, all of them for a block.
 * Everything that fetches uses this rather than branching on `isBlock` itself.
 */
export function leaguesIn(id: PickerId, followed: readonly string[] = []): LeagueId[] {
  if (!isBlock(id)) return [id as LeagueId];
  const block = blockOf(id)!;
  const follow = new Set(followed.map((l) => l.toUpperCase()));
  const members = block.members.map((m) => leagueById(m));
  const anyFollowed = members.some((m) => follow.has(m.label.toUpperCase()));
  return (anyFollowed ? members.filter((m) => follow.has(m.label.toUpperCase())) : members).map((m) => m.id);
}

/**
 * Top-level entries the picker always offers — six, matching ALWAYS_VISIBLE_LEAGUES on the web.
 *
 * What a general hockey reader is assumed to want. Hiding one behind a setting would make the app
 * look like it had lost coverage. CHL counts as ONE of these; its members live behind it.
 */
const ALWAYS_VISIBLE: readonly string[] = ['nhl', 'ahl', 'echl', 'CHL', 'ncaa', 'ushl'];

export type PickerEntry =
  | { kind: 'league'; id: LeagueId; label: string }
  | { kind: 'block'; key: BlockKey; label: string; members: LeagueConfig[] };

/**
 * Which of a block's members to offer beneath it.
 *
 * Following NONE of them means the block is simply a core league nobody has expressed a view about —
 * the CHL, which everyone gets — so the full membership is the right default. Following SOME is a
 * statement and is honoured exactly. The one being VIEWED always survives, so arriving on a league
 * never leaves you on a row missing it.
 */
function visibleMembers(block: LeagueBlock, followed: ReadonlySet<string>, current?: LeagueId): LeagueConfig[] {
  const all = block.members.map((id) => leagueById(id));
  const anyFollowed = all.some((l) => followed.has(l.label.toUpperCase()));
  if (!anyFollowed) return all;
  return all.filter((l) => followed.has(l.label.toUpperCase()) || l.id === current);
}

/**
 * The picker's two rows: the top-level entries, and the members of whichever block is open.
 *
 * A block is "open" when the selected league belongs to it — there is no separate expanded state to
 * keep, which is what stops the two rows disagreeing about what is selected.
 *
 * A block narrowed to a single member is rendered as that member instead: "CJRA" over a row showing
 * nothing but BCHL games is a label for a grouping the reader has opted out of most of, and a reader
 * who follows only the BCHL may not recognise the acronym at all.
 */
export function pickerRows(
  followed: readonly string[],
  current: PickerId,
  region: Region = detectRegion(),
): { top: PickerEntry[]; members: LeagueConfig[] } {
  const follow = new Set(followed.map((l) => l.toUpperCase()));
  const openBlock = blockOf(current);
  const seen = new Set<string>();
  const top: PickerEntry[] = [];

  for (const cfg of orderedLeagues(region)) {
    const block = blockOf(cfg.id);
    if (block) {
      if (seen.has(block.key)) continue;
      seen.add(block.key);
      const members = visibleMembers(block, follow, isBlock(current) ? undefined : (current as LeagueId));
      const wanted = ALWAYS_VISIBLE.includes(block.key) || members.length > 0 && members.some((m) => follow.has(m.label.toUpperCase()));
      if (!wanted && block.key !== openBlock?.key) continue;
      if (members.length === 1) top.push({ kind: 'league', id: members[0].id, label: members[0].label });
      else top.push({ kind: 'block', key: block.key, label: block.label, members });
      continue;
    }
    if (ALWAYS_VISIBLE.includes(cfg.id) || follow.has(cfg.label.toUpperCase()) || cfg.id === current) {
      top.push({ kind: 'league', id: cfg.id, label: cfg.label });
    }
  }

  const open = top.find((e) => e.kind === 'block' && e.key === openBlock?.key);
  return { top, members: open && open.kind === 'block' ? open.members : [] };
}

// The same order applied to the picker entries, so the pills and the Home sections agree. Any league
// missing from LEAGUE_ORDER falls to the end rather than disappearing.
export function orderedLeagues(region: Region = detectRegion()): LeagueConfig[] {
  const rank = new Map(homeLeagueOrder(region).map((label, i) => [label, i]));
  return [...LEAGUES].sort(
    (a, b) =>
      (rank.get(a.label.toUpperCase()) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(b.label.toUpperCase()) ?? Number.MAX_SAFE_INTEGER),
  );
}

// Aggregate one day's scores across every league into one { games, teamsById } for the Home hub.
// Each league endpoint is independent — a failure in one doesn't sink the rest.
//
// The date is always sent. Without it the NHL feed rolls forward to the next slate that has games,
// which put September 29 cards under an "NHL" header with no date on a September 8 Home. Home wants
// TODAY, and decides for itself what to show when today is dark (see lib/home.ts fetchLookahead).
export async function fetchAllScores(date: string): Promise<{
  games: ScoreGame[];
  teamsById: Record<string, ScoreTeam>;
}> {
  const empty = () => ({ games: [] as ScoreGame[], teamsById: {} as Record<string, ScoreTeam> });
  const paths = ["/scores", "/ahl-scores", "/echl-scores", "/chl-scores", "/ushl-scores", "/ncaa-scores", "/cjra-scores"];

  const live = await Promise.all(paths.map((p) => api<ScoresResponse>(`${p}?date=${date}`).catch(empty)));
  const games = live.flatMap((r) => r.games ?? []);
  const teamsById: Record<string, ScoreTeam> = Object.assign({}, ...live.map((r) => r.teamsById ?? {}));
  return { games, teamsById };
}

// ── Live-score freshness ──────────────────────────────────────────────────────
//
// Shared by Home and the Scores tab so the two screens can't drift apart on this.
//
// React Query keeps a payload for gcTime (5 min) and hands it straight back when a screen remounts.
// For a finished slate that is exactly what you want — the results are not going to change, and it
// paints instantly. For a game in progress it is the opposite: leaving the tab stops refetchInterval,
// so returning re-renders the clock, period and score as they were when you left. That is how a game
// already at "3rd • 09:35" showed on the card as "3rd • 20:00" after navigating back from its own
// detail page.
//
// So: a cached payload containing a live game is only usable for a few seconds. 30s sits comfortably
// past the 10s live poll, keeping the instant paint for a quick there-and-back.

export const LIVE_MAX_AGE_MS = 30_000;

export const hasLiveGame = (games: ScoreGame[] | undefined) => !!games?.some((g) => g.status === "LIVE");

// All teams across every league (for search). `id` is already the /teams/<id> route id per league.
export type TeamDirectoryEntry = { id: string; league: string; name: string; abbr: string; logo?: string; darkLogo?: string; group?: string };
export async function fetchAllTeams(): Promise<TeamDirectoryEntry[]> {
  const raw = await api<{ teams?: TeamDirectoryEntry[] }>("/all-teams");
  return raw.teams ?? [];
}
