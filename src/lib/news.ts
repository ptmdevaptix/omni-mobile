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
