import { api } from './api';
import type { GameDetail, GameDetailResponse } from './game-detail-types';

// Game detail for any league — gameId is the same prefixed id used in scores (e.g. "nhl-2026020001").
// Returns null (not undefined) when there's no detail — React Query forbids an undefined queryFn result.
/**
 * `bypassEdge`: a token that makes this one request unlike any cached at the edge, so it reaches the
 * server — used for the first load after a notification is tapped (see the game screen), when the
 * edge's copy of a live game can predate the goal the alert was about.
 */
export async function fetchGameDetail(gameId: string, bypassEdge?: string): Promise<GameDetail | null> {
  const r = await api<GameDetailResponse>(`/game/${gameId}${bypassEdge ? `?t=${encodeURIComponent(bypassEdge)}` : ''}`);
  return r.detail ?? null;
}
