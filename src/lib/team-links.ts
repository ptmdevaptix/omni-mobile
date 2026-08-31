import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

/**
 * Official club links, from the teams registry via /api/team-links.
 *
 *   [ { linkType: "web", url: "https://www.nhl.com/sabres" },
 *     { linkType: "x",   url: "https://x.com/BuffaloSabres" } ]
 *
 * Array, not an object: the order is the display order, and a new type (instagram, tiktok, youtube)
 * is a seeder change rather than a schema migration plus an API field plus a UI branch.
 *
 * URLs are stored whole, including for X — nothing has to remember which values are identifiers that
 * need a prefix rebuilt around them. The "@handle" shown is derived from the URL at render time.
 *
 * Mirrors lib/team-link-types.ts in the web repo; the two must not drift.
 */
export type TeamLink = { linkType: string; url: string };

const TYPE_ORDER = ['web', 'x', 'instagram', 'facebook', 'youtube', 'tiktok'];

const hostOf = (url: string) => url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] ?? url;

/** What to call a link in the UI. Handle-based services derive theirs from the URL's last segment. */
export function teamLinkLabel(link: TeamLink): string {
  // First PATH segment, not the last segment of the whole string: on a bare profile root like
  // "https://x.com/" the latter yields the host, which passes a handle-shaped test and renders "@x.com".
  const handle = () => {
    try {
      const seg = new URL(link.url).pathname.split('/').filter(Boolean)[0] ?? '';
      return /^[A-Za-z0-9_.]{1,30}$/.test(seg) ? `@${seg}` : hostOf(link.url);
    } catch {
      return hostOf(link.url);
    }
  };
  switch (link.linkType) {
    case 'web': return 'Official site';
    case 'x':
    case 'instagram':
    case 'tiktok': return handle();
    case 'facebook': return 'Facebook';
    case 'youtube': return 'YouTube';
    default: return hostOf(link.url);
  }
}

/** Drop anything malformed. The database constrains this, but never render a bad href. */
function clean(raw: unknown): TeamLink[] {
  if (!Array.isArray(raw)) return [];
  const out: TeamLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { linkType, url } = item as Record<string, unknown>;
    if (typeof linkType !== 'string' || typeof url !== 'string') continue;
    if (!/^https:\/\//.test(url)) continue;
    out.push({ linkType, url });
  }
  return out.sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a.linkType), bi = TYPE_ORDER.indexOf(b.linkType);
    return (ai === -1 ? TYPE_ORDER.length : ai) - (bi === -1 ? TYPE_ORDER.length : bi);
  });
}

/**
 * ONE request for every league, not a field on each of the five per-league team endpoints — those
 * parallel implementations are where this project's repeat bugs come from.
 *
 * It looks like an extra round trip but is one per SESSION, not per team page: React Query holds it
 * for the day, so every team screen after the first reads it from cache.
 */
export function useTeamLinks(teamId: string): TeamLink[] {
  const q = useQuery({
    queryKey: ['team-links'],
    queryFn: () => api<{ links: Record<string, unknown> }>('/team-links'),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    // A team header must never fail because its links did not load.
    retry: 1,
  });
  return clean(q.data?.links?.[teamId.toLowerCase()]);
}
