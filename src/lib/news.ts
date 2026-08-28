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

// Recent news for a single team.
//
// This used to fetch a page of the team's *league* and keep the articles carrying its tag, which
// made a quiet club's one article disappear as soon as its league published enough to push it out of
// the window. The API now answers per-team directly, holding an article for a fortnight regardless
// of anyone else's publishing volume, so there is no league scope and no client-side filter here.
export async function fetchTeamNews(teamId: string, limit = 10): Promise<NewsItem[]> {
  const r = await api<{ items?: NewsItem[] }>(
    `/news?team=${encodeURIComponent(teamId)}&limit=${limit}`,
  );
  // Some feeds prepend whitespace to the title.
  return (r.items ?? []).map((it) => ({ ...it, title: (it.title ?? '').trim() }));
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
