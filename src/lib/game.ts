import { api } from './api';
import type { GameDetail, GameDetailResponse } from './game-detail-types';
import { fetchAllTeams } from './leagues';
import { buildMockGameDetail } from './mock-scores';

// Game detail for any league — gameId is the same prefixed id used in scores (e.g. "nhl-2026020001").
// Returns null (not undefined) when there's no detail — React Query forbids an undefined queryFn result.
export async function fetchGameDetail(gameId: string): Promise<GameDetail | null> {
  // Prototype: mock games get a sample detail matching their state (see mock-scores.ts).
  if (gameId.startsWith('mock-')) return buildMockGameDetail(gameId, await fetchAllTeams());
  const r = await api<GameDetailResponse>(`/game/${gameId}`);
  return r.detail ?? null;
}
