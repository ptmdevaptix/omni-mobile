import { api } from './api';

// How the people you follow did — the shape /api/follows/summary returns. One day, or the season.

export type SummarySkater = {
  key: string; name: string; club?: string; clubLogo?: string; league?: string;
  gp?: number; g: number; a: number; pts: number; plusMinus?: number; pim: number;
  gameId?: string;
};

export type SummaryGoalie = {
  key: string; name: string; club?: string; clubLogo?: string; league?: string;
  gp?: number; gs?: number; ga: number; sa: number; svPct?: number; so?: number;
  w?: number; l?: number; otl?: number; gaa?: number;
  gameId?: string;
};

export type FollowSummary = {
  scope: 'day' | 'season';
  date?: string;
  season?: string;
  skaters: SummarySkater[];
  goalies: SummaryGoalie[];
  /** Day only: every game a followed person was in has finished. */
  ready: boolean;
  /** Day only: how many of their games are still to come or in progress. */
  pending: number;
};

export function fetchFollowSummary(
  ids: string[],
  orgs: string[],
  scope: 'day' | 'season',
  date?: string,
): Promise<FollowSummary> {
  const q = new URLSearchParams({ scope });
  if (ids.length) q.set('ids', ids.join(','));
  if (orgs.length) q.set('orgs', orgs.join(','));
  if (date && scope === 'day') q.set('date', date);
  return api<FollowSummary>(`/follows/summary?${q.toString()}`);
}
