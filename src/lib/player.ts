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
