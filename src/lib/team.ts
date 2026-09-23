import { api, leagueOf, teamHeaderPath } from './api';
import type { RosterMovesResponse } from '@/lib/ncaa-moves-types';
import type { RosterResponse, ScheduleGame, TeamHomeData, TeamOrganization, TeamStatsResponse } from './team-types';

export type TeamTab = 'home' | 'schedule' | 'roster' | 'stats' | 'prospects' | 'news';

// Which sub-tabs a team shows. NHL adds Prospects; everyone else gets home/schedule/roster/stats.
//
// USHL gets everything except News. It was roster/stats only until 2026-08-25, on the belief that this
// mirrored the web — it didn't; the web has always shown USHL the full set, and /ushl-team/{id}/home
// and /schedule both return real data (62 games for Chicago Steel). News stays off because the scanner
// has found 9 USHL articles in total, so the tab would be empty for nearly every team. Revisit if
// USHL coverage picks up.
export function teamTabs(teamId: string): TeamTab[] {
  const league = leagueOf(teamId);
  // ECHL and Europe: Home (the table and the games either side of today, from /home), schedule and
  // roster. No stats tab — neither the ECHL nor the three European leagues publish a per-club stats
  // feed — and no news, which the scanner does not cover for these clubs.
  if (league === 'ECHL' || league === 'SHL' || league === 'LIIGA' || league === 'ELH') return ['home', 'schedule', 'roster'];
  if (league === 'USHL') return ['home', 'schedule', 'roster', 'stats'];
  // Canadian Jr A: everything except News. Not a judgement about coverage — /cjra-team/<id>/news does
  // not exist on the API and returns the 404 HTML page, so the tab would error rather than sit empty.
  if (league === 'CJRA') return ['home', 'schedule', 'roster', 'stats'];
  if (league === 'NHL') return ['home', 'schedule', 'roster', 'stats', 'prospects', 'news'];
  return ['home', 'schedule', 'roster', 'stats', 'news'];
}

export const TAB_LABEL: Record<TeamTab, string> = {
  home: 'Home', schedule: 'Schedule', roster: 'Roster', stats: 'Stats', prospects: 'Prospects', news: 'News',
};

// Sub-resource path per league (e.g. /team/fla/roster, /ahl-team/440/roster, /ncaa-team/air-force/roster).
function subPath(teamId: string, sub: string): string {
  return `${teamHeaderPath(teamId)}/${sub}`;
}

/**
 * The club's colours and its affiliates — neither is on the per-league header endpoints, and both
 * are the same answer for every league, so they come from the one registry route.
 */
export type TeamLookup = {
  id: string; abbr: string; league: string; name: string; location?: string; nickname?: string;
  logo?: string; darkLogo?: string;
  colors?: { primary?: string; secondary?: string };
  affiliates?: {
    nhl?: AffiliateRef; ahl?: AffiliateRef; echl?: AffiliateRef[];
  };
};
export type AffiliateRef = { id: string; href?: string; name: string; location?: string; logo?: string };

export const fetchTeamLookup = (id: string) =>
  api<{ teams?: Record<string, TeamLookup> }>(`/teams/lookup?ids=${encodeURIComponent(id)}`).then((r) => r.teams?.[id]);

export const fetchTeamHome = (id: string) => api<TeamHomeData>(subPath(id, 'home'));
// A season is sent only when the reader picked one; without it the route serves its own default,
// which is the current season for every league.
export const fetchTeamRoster = (id: string, season?: string | null) =>
  api<RosterResponse>(subPath(id, 'roster') + (season ? `?season=${encodeURIComponent(season)}` : ''));

/** NCAA roster changes — who arrived, who left. Fetched only when the reader opens the view. */
export const fetchNcaaMoves = (id: string, season?: string | null) =>
  api<RosterMovesResponse>(subPath(id, 'moves') + (season ? `?season=${encodeURIComponent(season)}` : ''));
export const fetchTeamStats = (id: string) => api<TeamStatsResponse>(subPath(id, 'stats'));
export const fetchTeamOrg = (id: string) => api<TeamOrganization>(subPath(id, 'organization'));
export const fetchTeamSchedule = (id: string) =>
  api<{ schedule?: ScheduleGame[] }>(subPath(id, 'schedule')).then((r) => r.schedule ?? []);
