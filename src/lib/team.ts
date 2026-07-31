import { api, leagueOf, teamHeaderPath } from './api';
import type { RosterResponse, ScheduleGame, TeamHomeData, TeamOrganization, TeamStatsResponse } from './team-types';

export type TeamTab = 'home' | 'schedule' | 'roster' | 'stats' | 'prospects';

// Which sub-tabs a team shows, mirroring the web's teamTabs(): USHL is roster/stats only; NHL adds
// Prospects; everyone else gets home/schedule/roster/stats.
export function teamTabs(teamId: string): TeamTab[] {
  const league = leagueOf(teamId);
  if (league === 'USHL') return ['roster', 'stats'];
  if (league === 'NHL') return ['home', 'schedule', 'roster', 'stats', 'prospects'];
  return ['home', 'schedule', 'roster', 'stats'];
}

export const TAB_LABEL: Record<TeamTab, string> = {
  home: 'Home', schedule: 'Schedule', roster: 'Roster', stats: 'Stats', prospects: 'Prospects',
};

// Sub-resource path per league (e.g. /team/fla/roster, /ahl-team/440/roster, /ncaa-team/air-force/roster).
function subPath(teamId: string, sub: string): string {
  return `${teamHeaderPath(teamId)}/${sub}`;
}

export const fetchTeamHome = (id: string) => api<TeamHomeData>(subPath(id, 'home'));
export const fetchTeamRoster = (id: string) => api<RosterResponse>(subPath(id, 'roster'));
export const fetchTeamStats = (id: string) => api<TeamStatsResponse>(subPath(id, 'stats'));
export const fetchTeamOrg = (id: string) => api<TeamOrganization>(subPath(id, 'organization'));
export const fetchTeamSchedule = (id: string) =>
  api<{ schedule?: ScheduleGame[] }>(subPath(id, 'schedule')).then((r) => r.schedule ?? []);
