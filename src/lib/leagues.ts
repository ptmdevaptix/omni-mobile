// Canonical league model for the app: the picker entries, per-league API endpoints, and typed fetchers.
// This is the single source of truth the content tabs (Scores/Standings/Stats/Teams) read from.
import { createContext, useContext } from "react";

import { api, withScoresDate } from "./api";
import { buildMockScores, isMockableLeague, MOCK_SCORES_ENABLED, MOCKABLE_LEAGUES } from "./mock-scores";
import type { ScoreGame, ScoresResponse, ScoreTeam, StandingsTeam } from "./types";

export type LeagueId = "nhl" | "ahl" | "ohl" | "whl" | "qmjhl" | "ncaa";

export type LeagueConfig = {
  id: LeagueId;
  label: string; // short label for the picker
  name: string; // full name
  scoresPath: string; // scores endpoint
  chlCode?: string; // for OHL/WHL/QMJHL: filter the combined /chl-scores feed by game.top
  standingsPath: string;
  standingsKind: "wlotl" | "ncaa"; // NHL/AHL/CHL vs NCAA (W-L-T, conference-based)
  statsPath: string;
  teamKind: "nhl" | "ahl" | "chl" | "ncaa"; // how to build a /teams/<id> route id from a standings row
  hasConferences?: boolean; // NCAA
};

export const LEAGUES: LeagueConfig[] = [
  { id: "nhl", label: "NHL", name: "National Hockey League", scoresPath: "/scores", standingsPath: "/nhl-standings", standingsKind: "wlotl", statsPath: "/nhl-stats", teamKind: "nhl" },
  { id: "ahl", label: "AHL", name: "American Hockey League", scoresPath: "/ahl-scores", standingsPath: "/ahl-standings", standingsKind: "wlotl", statsPath: "/ahl-stats", teamKind: "ahl" },
  { id: "ohl", label: "OHL", name: "Ontario Hockey League", scoresPath: "/chl-scores", chlCode: "OHL", standingsPath: "/ht-standings/ohl", standingsKind: "wlotl", statsPath: "/chl-stats/ohl", teamKind: "chl" },
  { id: "whl", label: "WHL", name: "Western Hockey League", scoresPath: "/chl-scores", chlCode: "WHL", standingsPath: "/ht-standings/whl", standingsKind: "wlotl", statsPath: "/chl-stats/whl", teamKind: "chl" },
  { id: "qmjhl", label: "QMJHL", name: "Quebec Maritimes Junior Hockey League", scoresPath: "/chl-scores", chlCode: "QMJHL", standingsPath: "/ht-standings/qmjhl", standingsKind: "wlotl", statsPath: "/chl-stats/qmjhl", teamKind: "chl" },
  { id: "ncaa", label: "NCAA", name: "NCAA Division I", scoresPath: "/ncaa-scores", standingsPath: "/ncaa-standings", standingsKind: "ncaa", statsPath: "/ncaa-stats", teamKind: "ncaa", hasConferences: true },
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
  // Green reserved for a future league/group (e.g. Euro):
  //   { bg: ['#eaf4ec', '#0c2a19'], card: ['#d8ebdd', '#08160e'], pill: ['#1f7a45', '#46cc7e'] }
};
const leagueKey = (id: LeagueId): string => (id === 'ohl' || id === 'whl' || id === 'qmjhl' ? 'chl' : id);

export function leagueColors(id: LeagueId, dark: boolean): { bg: string; card: string; pill: string } {
  const tint = LEAGUE_TINTS[leagueKey(id)] ?? LEAGUE_TINTS.nhl;
  const i = dark ? 1 : 0;
  return { bg: tint.bg[i], card: tint.card[i], pill: tint.pill[i] };
}

// --- Shared selection (which league is active across the content tabs) -------
export const LeagueContext = createContext<{ league: LeagueId; setLeague: (id: LeagueId) => void }>({
  league: "nhl",
  setLeague: () => {},
});
export const useLeague = () => useContext(LeagueContext);

// --- Fetchers ----------------------------------------------------------------

// Scores. CHL sub-leagues share one combined feed (/chl-scores); filter client-side by game.top.
export async function fetchScores(id: LeagueId): Promise<ScoresResponse> {
  const cfg = leagueById(id);
  const data = await api<ScoresResponse>(withScoresDate(cfg.scoresPath));
  let games = data.games ?? [];
  if (cfg.chlCode) {
    const code = cfg.chlCode.toLowerCase();
    games = games.filter((g) => (g.top ?? "").toLowerCase() === code);
  }
  // Prototype: fill empty offseason feeds with mock same-league matchups.
  if (games.length === 0 && isMockableLeague(cfg.label)) {
    return buildMockScores(cfg.label, await fetchAllTeams());
  }
  return { ...data, games };
}

// W-L-OTL standings (NHL/AHL/CHL), normalized to StandingsTeam with a tap-through routeId.
export async function fetchStandings(id: LeagueId): Promise<StandingsTeam[]> {
  const cfg = leagueById(id);
  const raw = await api<{ teams?: any[] }>(cfg.standingsPath);
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
      : cfg.teamKind === "chl" ? `chl-${cfg.id}-${r.teamId}`
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
    conference: r.conference ?? "Independent",
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
    .sort((a, b) => a.conference.localeCompare(b.conference));
}

// Home hub: league grouping order for the aggregated scoreboard, keyed by game.top.
// FUTURE: make this country-aware — default US = NHL, AHL, NCAA, OHL, WHL, QMJHL (NCAA ahead of CHL);
// default Canada = NHL, AHL, OHL, WHL, QMJHL, NCAA (CHL ahead of NCAA). Eventually user-customizable order.
export const HOME_LEAGUE_ORDER = ["NHL", "AHL", "OHL", "WHL", "QMJHL", "NCAA"];

// Aggregate today's scores across every league into one { games, teamsById } for the Home hub.
// Each league endpoint is independent — a failure in one doesn't sink the rest.
export async function fetchAllScores(): Promise<{ games: ScoreGame[]; teamsById: Record<string, ScoreTeam> }> {
  const paths = ["/scores", "/ahl-scores", "/chl-scores", "/ncaa-scores"];
  const results = await Promise.all(
    paths.map((p) => api<ScoresResponse>(withScoresDate(p)).catch(() => ({ games: [] as ScoreGame[], teamsById: {} as Record<string, ScoreTeam> }))),
  );
  let games = results.flatMap((r) => r.games ?? []);
  let teamsById: Record<string, ScoreTeam> = Object.assign({}, ...results.map((r) => r.teamsById ?? {}));

  // Prototype: for any mockable league with no real games today, inject a mock slate.
  if (MOCK_SCORES_ENABLED) {
    const missing = MOCKABLE_LEAGUES.filter((lg) => !games.some((g) => (g.top ?? "").toUpperCase() === lg));
    if (missing.length) {
      const all = await fetchAllTeams();
      for (const lg of missing) {
        const m = buildMockScores(lg, all);
        games = games.concat(m.games);
        teamsById = { ...teamsById, ...m.teamsById };
      }
    }
  }
  return { games, teamsById };
}

// All teams across every league (for search). `id` is already the /teams/<id> route id per league.
export type TeamDirectoryEntry = { id: string; league: string; name: string; abbr: string; logo?: string; darkLogo?: string; group?: string };
export async function fetchAllTeams(): Promise<TeamDirectoryEntry[]> {
  const raw = await api<{ teams?: TeamDirectoryEntry[] }>("/all-teams");
  return raw.teams ?? [];
}
