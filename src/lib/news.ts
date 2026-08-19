import { api } from './api';

export type NewsTeamTag = { id: string; abbr: string; name: string; logo?: string; darkLogo?: string };
export type NewsItem = {
  id: number;
  title: string;
  url: string;
  excerpt?: string;
  publishedAt?: string;
  imageUrl?: string | null;
  source?: string;
  category?: string;
  leagueTags?: string[];
  teamTags?: NewsTeamTag[];
};

export const fetchNews = (limit = 30) =>
  api<{ items?: NewsItem[] }>(`/news?limit=${limit}`).then((r) =>
    (r.items ?? []).map((it) => ({ ...it, title: (it.title ?? '').trim() })), // some feeds prepend whitespace
  );

// League scope for a team's news, derived from its route id (bigger yield than the mixed feed).
function newsScope(teamId: string): { league?: string; sub?: string } {
  if (teamId.startsWith('ahl-')) return { league: 'AHL' };
  if (teamId.startsWith('chl-ohl-')) return { league: 'CHL', sub: 'OHL' };
  if (teamId.startsWith('chl-whl-')) return { league: 'CHL', sub: 'WHL' };
  if (teamId.startsWith('chl-qmjhl-')) return { league: 'CHL', sub: 'QMJHL' };
  if (teamId.startsWith('ncaa-')) return { league: 'NCAA' };
  if (teamId.startsWith('ushl-')) return {};
  return { league: 'NHL' };
}

// Recent news for a single team: scope to its league, then keep only articles tagged with this team.
export async function fetchTeamNews(teamId: string, limit = 40): Promise<NewsItem[]> {
  const { league, sub } = newsScope(teamId);
  const qs = new URLSearchParams({ limit: String(limit) });
  if (league) qs.set('league', league);
  if (sub) qs.set('sub', sub);
  const r = await api<{ items?: NewsItem[] }>(`/news?${qs.toString()}`);
  return (r.items ?? [])
    .map((it) => ({ ...it, title: (it.title ?? '').trim() }))
    .filter((a) => (a.teamTags ?? []).some((tag) => tag.id === teamId));
}

// "3h ago", "2d ago", or a short date for older items.
export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
