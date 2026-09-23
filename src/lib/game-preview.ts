import { api } from './api';
import type { ScheduleGame } from './team-types';

// The matchup preview's payload, mirroring omni-hockey's /api/game/{id}/preview route.

export type SeriesGame = {
  date: string;
  awayAbbr: string;
  homeAbbr: string;
  awayScore: number;
  homeScore: number;
  overtime?: string;
};

export type PreviewLeader = { name: string; value: string; raw: number; headshot?: string };
export type LeaderSet = {
  points: PreviewLeader[];
  goals: PreviewLeader[];
  assists: PreviewLeader[];
  toi: PreviewLeader[];
  goalie: PreviewLeader[];
};

export type PreviewTeamStats = {
  gf: number; ga: number; gp: number;
  sf: number; sa: number;
  ppPct: number; pkPct: number;
};

export type GamePreviewData = {
  seasonSeries: SeriesGame[];
  awayLast5: ScheduleGame[];
  homeLast5: ScheduleGame[];
  awayLeaders: LeaderSet;
  homeLeaders: LeaderSet;
  awayStats: PreviewTeamStats;
  homeStats: PreviewTeamStats;
  error?: string;
};

/**
 * The leagues whose feeds can answer a matchup preview — the route's own list. Asking for any other
 * prefix gets a 400, so the screen does not ask.
 */
const SUPPORTED = new Set([
  'nhl', 'ahl', 'ncaa', 'ohl', 'whl', 'qmjhl', 'ushl', 'mc',
  'ajhl', 'bchl', 'cchl', 'mjhl', 'ojhl', 'sjhl',
]);

export function previewSupported(gameId: string): boolean {
  return SUPPORTED.has(gameId.split('-')[0]?.toLowerCase() ?? '');
}

export const fetchGamePreview = (gameId: string) => api<GamePreviewData>(`/game/${gameId}/preview`);

/**
 * Who is ahead in the season series, by points rather than wins: an overtime loss is worth one, so
 * two clubs can split four games and still not be level. Ported from the web component.
 */
export function seriesSummary(games: SeriesGame[], awayAbbr: string, homeAbbr: string): string | null {
  if (!games.length) return null;
  let awayW = 0, homeW = 0, awayPts = 0, homePts = 0;
  for (const g of games) {
    const awayTeamIsAway = g.awayAbbr === awayAbbr;
    const teamScore = awayTeamIsAway ? g.awayScore : g.homeScore;
    const oppScore = awayTeamIsAway ? g.homeScore : g.awayScore;
    if (teamScore > oppScore) {
      awayW++; awayPts += 2;
      if (g.overtime) homePts += 1;
    } else {
      homeW++; homePts += 2;
      if (g.overtime) awayPts += 1;
    }
  }
  if (awayPts === homePts) return `Series tied ${awayW}–${homeW}`;
  const awayAhead = awayPts > homePts;
  return `${awayAhead ? awayAbbr : homeAbbr} leads ${awayAhead ? awayW : homeW}–${awayAhead ? homeW : awayW}`;
}
