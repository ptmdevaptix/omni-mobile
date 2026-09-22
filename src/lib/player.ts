import { api } from './api';
import type { PlayerDetail, PlayerSearchResult } from './player-types';

// Player detail — the API accepts "nhl-{id}", a bare id, or a "name-id" slug (it parses the trailing id).
export const fetchPlayer = (playerId: string) => api<PlayerDetail>(`/player/${playerId}`);

export const searchPlayers = (q: string) =>
  api<{ players?: PlayerSearchResult[] }>(`/search/players?q=${encodeURIComponent(q)}`).then((r) => r.players ?? []);

// 20252026 → "2025-26"
export function seasonLabel(season?: number): string {
  if (!season) return '';
  const str = String(season);
  if (str.length !== 8) return str;
  return `${str.slice(0, 4)}-${str.slice(6)}`;
}

// A roster/leader player id → the /players/[playerId] route id, or null if we can't link (no NHL identity).
export function playerRouteId(nhlId?: string | number | null): string | null {
  if (nhlId == null || nhlId === '') return null;
  return `nhl-${nhlId}`;
}

// Mirrors omni-hockey lib/player-slug.ts: "firstname-lastname-{id}", accents stripped.
export function slugifyName(name: string): string {
  return (name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function playerSlug(name: string, id: string | number): string {
  return `${slugifyName(name) || 'player'}-${id}`;
}

/**
 * The ONE key a player is starred under, whatever route brought the reader to his page.
 *
 * Search stars the slug. A roster or box-score row for an NHL player links "nhl-{id}", and the page
 * used to star THAT — so the same player starred from search and from his own page became two
 * entries, and the page's star read "off" for a player the reader had already starred. The web has
 * no such problem because it redirects every id spelling to the stored slug before rendering; the
 * app has no redirect, so it agrees on the key here instead.
 *
 * The stored slug wins. The NHL path returns none (its rows are not minted), so it is derived the way
 * the web's redirect derives it — the same string, so a star placed on either client names the same
 * player.
 */
export function canonicalPlayerKey(p: Pick<PlayerDetail, 'id' | 'slug' | 'fullName' | 'sourceId'>): string {
  if (p.slug) return p.slug;
  const trailing = p.sourceId || String(p.id ?? '').replace(/^nhl-/, '');
  return playerSlug(p.fullName, trailing);
}
