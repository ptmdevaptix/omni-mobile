// League leaderboards, one shape for every feed. The web has a component per feed family (nhl-stats,
// ahl-stats, ht-stats for HockeyTech and Europe, ncaa-stats), each reading its own payload; the app
// normalizes the five dialects here so one table draws them all. Mirrors those components' row
// types, column sets and season rules — the two must not drift.
import { api } from './api';
import { leagueById, type LeagueId } from './leagues';
import type { StandingsSeason } from './standings-cards';

export type SkaterRow = {
  key: string;
  name: string;
  /** The club's abbreviation, crest and page, where the feed gives them. */
  team: string; teamId?: string; teamName?: string; teamLogo?: string; teamDarkLogo?: string;
  /** The NHL id, for a row that links to a player page. */
  nhlId?: number;
  /** The feed's league code ("ohl", "lhjmq", "shl"): the Lg column and the per-league rate floor. */
  league: string;
  position?: string;
  conference?: string;
  gp: number; goals: number; assists: number; points: number; pointsPerGame: number; plusMinus: number;
  pim?: number; toiPerGame?: number; ppGoals: number; shGoals: number; shots: number; shootingPct: number;
  faceoffWins?: number; faceoffLosses?: number; faceoffPct?: number;
};

export type GoalieRow = {
  key: string;
  name: string;
  team: string; teamId?: string; teamName?: string; teamLogo?: string; teamDarkLogo?: string;
  nhlId?: number;
  league: string;
  conference?: string;
  gp: number; gs?: number; wins: number; losses: number; ot?: number;
  gaa: number; sa?: number; ga?: number; sv?: number;
  /** A decimal (.920), whatever the feed wrote. */
  svPct: number; so: number;
};

export type StatsMeta = {
  league: string;
  season?: string;
  seasons: StandingsSeason[];
  isPriorSeason?: boolean;
  hasFaceoffs: boolean;
  hasGoalieSA: boolean;
  hasPim: boolean;
  hasToi: boolean;
  hasGs: boolean;
  hasOt: boolean;
};

export type LeagueStats = { skaters: SkaterRow[]; goalies: GoalieRow[]; meta: StatsMeta };

// Fallbacks only: the live floor is a share of the season played (lib/stat-qualifiers). These apply
// when the season length is unknown — an empty board, or a feed reporting no games yet.
export const MIN_GP: Record<'skater' | 'goalie', Record<string, number>> = {
  skater: { nhl: 25, ahl: 25, ncaa: 20, default: 25 },
  goalie: { nhl: 20, ahl: 10, ncaa: 5, default: 10 },
};

/** The league label a combined board's Lg column prints for a feed code. */
export const LEAGUE_CODE_LABEL: Record<string, string> = { lhjmq: 'QMJHL' };
export const leagueCodeLabel = (code: string) => LEAGUE_CODE_LABEL[code.toLowerCase()] ?? code.toUpperCase();

type Family = 'nhl' | 'ahl' | 'ht' | 'ncaa' | 'none';
// Crests the stats feeds do not carry, from the same sources the rest of the app draws them from.
const nhlLogo = (abbr: string) => `https://assets.nhle.com/logos/nhl/svg/${abbr}_light.svg`;
const nhlDarkLogo = (abbr: string) => `https://assets.nhle.com/logos/nhl/svg/${abbr}_dark.svg`;
const ncaaLogo = (seo: string) => `https://i.turner.ncaa.com/sites/default/files/images/logos/schools/bgl/${seo}.svg`;
function family(id: LeagueId): Family {
  if (id === 'nhl') return 'nhl';
  if (id === 'ahl') return 'ahl';
  if (id === 'ncaa') return 'ncaa';
  return leagueById(id).statsPath ? 'ht' : 'none';
}

/** True for a league with no leader boards at all (the ECHL publishes no stats feed). */
export const hasStats = (id: LeagueId) => family(id) !== 'none';

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * One league's boards for a season. `season` is the route's own choice when null; the routes take
 * the season NAME ("2025-26") — ids differ per HockeyTech client — except the NCAA's, which takes
 * the start year. The caller passes whichever the switch chose, by the meta's `seasons`.
 */
export async function fetchLeagueStats(id: LeagueId, season: string | null): Promise<LeagueStats> {
  const fam = family(id);
  const cfg = leagueById(id);
  const q = season ? `season=${encodeURIComponent(season)}` : '';
  if (fam === 'none') throw new Error(`No stats feed for ${cfg.label}`);

  if (fam === 'nhl') {
    const [s, g] = await Promise.all([
      api<any>(`/nhl-stats?type=skaters${q ? `&${q}` : ''}`),
      api<any>(`/nhl-stats?type=goalies${q ? `&${q}` : ''}`),
    ]);
    const skaters: SkaterRow[] = (s.skaters ?? []).map((r: any): SkaterRow => ({
      key: `nhl-${r.playerId}`, name: r.name, team: r.team, teamLogo: nhlLogo(r.team), teamDarkLogo: nhlDarkLogo(r.team), nhlId: r.playerId, league: 'nhl', position: r.position,
      gp: num(r.gp), goals: num(r.goals), assists: num(r.assists), points: num(r.points), pointsPerGame: num(r.pointsPerGame), plusMinus: num(r.plusMinus),
      pim: num(r.pim), toiPerGame: num(r.toiPerGame), ppGoals: num(r.ppGoals), shGoals: num(r.shGoals), shots: num(r.shots), shootingPct: num(r.shootingPct),
      // The NHL writes the faceoff percentage as a decimal (.520); every other feed as a percent.
      faceoffWins: num(r.faceoffWins), faceoffLosses: num(r.faceoffLosses), faceoffPct: num(r.faceoffWinPct) * 100,
    }));
    const goalies: GoalieRow[] = (g.goalies ?? []).map((r: any): GoalieRow => ({
      key: `nhl-${r.playerId}`, name: r.name, team: r.team, teamLogo: nhlLogo(r.team), teamDarkLogo: nhlDarkLogo(r.team), nhlId: r.playerId, league: 'nhl',
      gp: num(r.gp), gs: num(r.gs), wins: num(r.wins), losses: num(r.losses), ot: num(r.otLosses),
      gaa: num(r.gaa), sa: num(r.shotsAgainst), ga: num(r.goalsAgainst), sv: num(r.saves), svPct: num(r.savePct), so: num(r.shutouts),
    }));
    return { skaters, goalies, meta: { league: 'nhl', season: s.season, seasons: s.seasons ?? [], isPriorSeason: s.isPriorSeason, hasFaceoffs: true, hasGoalieSA: true, hasPim: true, hasToi: true, hasGs: true, hasOt: true } };
  }

  if (fam === 'ahl') {
    const d = await api<any>(`/ahl-stats${q ? `?${q}` : ''}`);
    return {
      skaters: (d.skaters ?? []).map((r: any): SkaterRow => ({
        key: `ahl-${r.playerId}`, name: r.name, team: r.team, teamId: r.teamId, teamName: r.teamName, teamLogo: r.teamId ? `https://assets.leaguestat.com/ahl/logos/50x50/${r.teamId}.png` : undefined,
        league: 'ahl', position: r.position,
        gp: num(r.gp), goals: num(r.goals), assists: num(r.assists), points: num(r.points), pointsPerGame: num(r.pointsPerGame), plusMinus: num(r.plusMinus),
        pim: num(r.pim), ppGoals: num(r.ppGoals), shGoals: num(r.shGoals), shots: num(r.shots), shootingPct: num(r.shootingPct),
      })),
      goalies: (d.goalies ?? []).map((r: any): GoalieRow => ({
        key: `ahl-${r.playerId}`, name: r.name, team: r.team, teamId: r.teamId, teamName: r.teamName, teamLogo: r.teamId ? `https://assets.leaguestat.com/ahl/logos/50x50/${r.teamId}.png` : undefined,
        league: 'ahl', gp: num(r.gp), wins: num(r.wins), losses: num(r.losses), ot: num(r.ot), gaa: num(r.gaa), sa: num(r.sa), ga: num(r.ga), sv: num(r.sv), svPct: num(r.svPct), so: num(r.so),
      })),
      meta: { league: 'ahl', season: d.season, seasons: d.seasons ?? [], isPriorSeason: d.isPriorSeason, hasFaceoffs: false, hasGoalieSA: true, hasPim: true, hasToi: false, hasGs: false, hasOt: true },
    };
  }

  if (fam === 'ncaa') {
    const d = await api<any>(`/ncaa-stats${q ? `?${q}` : ''}`);
    return {
      skaters: (d.skaters ?? []).map((r: any, i: number): SkaterRow => ({
        key: `ncaa-${r.teamSeo}-${r.name}-${i}`, name: r.name, team: r.team, teamId: r.teamSeo, teamName: r.team, teamLogo: r.teamSeo ? ncaaLogo(r.teamSeo) : undefined, league: 'ncaa', conference: r.conference,
        gp: num(r.gp), goals: num(r.goals), assists: num(r.assists), points: num(r.points), pointsPerGame: num(r.pointsPerGame), plusMinus: num(r.plusMinus),
        ppGoals: num(r.ppGoals), shGoals: num(r.shGoals), shots: num(r.shots), shootingPct: num(r.shootingPct),
        faceoffWins: num(r.faceoffWins), faceoffLosses: num(r.faceoffLosses), faceoffPct: num(r.faceoffPct),
      })),
      goalies: (d.goalies ?? []).map((r: any, i: number): GoalieRow => ({
        key: `ncaa-${r.teamSeo}-${r.name}-${i}`, name: r.name, team: r.team, teamId: r.teamSeo, teamName: r.team, teamLogo: r.teamSeo ? ncaaLogo(r.teamSeo) : undefined, league: 'ncaa', conference: r.conference,
        gp: num(r.gp), wins: num(r.wins), losses: num(r.losses), gaa: num(r.gaa), sa: num(r.sa), ga: num(r.ga), sv: num(r.sv), svPct: num(r.svPct), so: num(r.so),
      })),
      meta: { league: 'ncaa', season: d.season, seasons: d.seasons ?? [], isPriorSeason: d.isPriorSeason, hasFaceoffs: true, hasGoalieSA: true, hasPim: false, hasToi: false, hasGs: false, hasOt: false },
    };
  }

  // HockeyTech and Europe: the same shape, the meta nested, capability flags from the feed.
  const d = await api<any>(`${cfg.statsPath}${q ? `?${q}` : ''}`);
  if (d.error) throw new Error(String(d.error));
  const m = d.meta ?? {};
  const code = String(m.league ?? id).toLowerCase();
  const logoFor = (r: any) => r.teamLogo ?? (r.teamId && r.leagueStatCode ? `https://assets.leaguestat.com/${r.leagueStatCode}/logos/${r.teamId}.png` : undefined);
  return {
    skaters: (d.skaters ?? []).map((r: any): SkaterRow => ({
      key: `${r.leagueStatCode ?? code}-${r.playerId}`, name: r.name, team: r.team, teamId: r.teamId, teamName: r.teamName, teamLogo: logoFor(r),
      league: String(r.leagueStatCode ?? code).toLowerCase(), position: r.position,
      gp: num(r.gp), goals: num(r.goals), assists: num(r.assists), points: num(r.points), pointsPerGame: num(r.pointsPerGame), plusMinus: num(r.plusMinus),
      pim: num(r.pim), ppGoals: num(r.ppGoals), shGoals: num(r.shGoals), shots: num(r.shots), shootingPct: num(r.shootingPct),
      faceoffWins: num(r.faceoffWins), faceoffLosses: num(r.faceoffLosses), faceoffPct: num(r.faceoffPct),
    })),
    goalies: (d.goalies ?? []).map((r: any): GoalieRow => ({
      key: `${r.leagueStatCode ?? code}-${r.playerId}`, name: r.name, team: r.team, teamId: r.teamId, teamName: r.teamName, teamLogo: logoFor(r),
      league: String(r.leagueStatCode ?? code).toLowerCase(),
      gp: num(r.gp), wins: num(r.wins), losses: num(r.losses), ot: num(r.ot), gaa: num(r.gaa), sa: num(r.sa), ga: num(r.ga), sv: num(r.sv), svPct: num(r.svPct), so: num(r.so),
    })),
    meta: { league: code, season: m.season, seasons: m.seasons ?? [], isPriorSeason: m.isPriorSeason, hasFaceoffs: !!m.hasFaceoffs, hasGoalieSA: m.hasGoalieSA !== false, hasPim: true, hasToi: false, hasGs: false, hasOt: true },
  };
}

/** What the season switch should send a league for a chosen season: the NCAA takes the id, the rest the name. */
export function seasonParam(id: LeagueId, s: StandingsSeason): string {
  return family(id) === 'ncaa' ? s.id : s.name;
}

/**
 * Which leagues belong in a combined board. The leagues in a block do not start together, and each
 * league's route falls back to last season until its own begins; combining those wholesale ranks a
 * finished season against a league a week into its schedule. So once ANY league in the block has
 * started, the combined view is the started ones; until any has, it stays last season for all.
 */
export function combinedSeasons(boards: readonly LeagueStats[]): { boards: LeagueStats[]; partial: boolean; allPrior: boolean } {
  const started = boards.filter((b) => !b.meta.isPriorSeason);
  if (started.length === 0) return { boards: [...boards], partial: false, allPrior: true };
  return { boards: started, partial: started.length < boards.length, allPrior: false };
}

/** Several leagues' boards as one: rows concatenated, a column only every league can fill. */
export function combineBoards(boards: readonly LeagueStats[]): LeagueStats {
  const all = boards.length > 0;
  return {
    skaters: boards.flatMap((b) => b.skaters),
    goalies: boards.flatMap((b) => b.goalies),
    meta: {
      league: 'combined',
      seasons: [],
      hasFaceoffs: all && boards.every((b) => b.meta.hasFaceoffs),
      hasGoalieSA: all && boards.every((b) => b.meta.hasGoalieSA),
      hasPim: all && boards.every((b) => b.meta.hasPim),
      hasToi: all && boards.every((b) => b.meta.hasToi),
      hasGs: all && boards.every((b) => b.meta.hasGs),
      hasOt: all && boards.every((b) => b.meta.hasOt),
    },
  };
}
