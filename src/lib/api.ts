// Thin client over the omni-hockey production API (the same JSON endpoints the web app uses).
// The web app in ../omni-hockey is the single backend/source of truth — this app is just a client.

export const API_BASE = "https://omnihockey.com/api";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return (await res.json()) as T;
}

// A /teams/<teamId> id → the correct header endpoint, mirroring the web app's league detection
// (NHL ids are bare abbrs; AHL/CHL/NCAA/USHL are prefixed).
export function teamHeaderPath(teamId: string): string {
  if (teamId.startsWith("ahl-")) return `/ahl-team/${teamId.slice(4)}`;
  if (teamId.startsWith("chl-")) return `/chl-team/${teamId.slice(4)}`;
  if (teamId.startsWith("ncaa-")) return `/ncaa-team/${teamId.slice(5)}`;
  if (teamId.startsWith("ushl-")) return `/ushl-team/${teamId.slice(5)}`;
  return `/team/${teamId}`;
}

export function leagueOf(teamId: string): string {
  if (teamId.startsWith("ahl-")) return "AHL";
  if (teamId.startsWith("chl-")) return "CHL";
  if (teamId.startsWith("ncaa-")) return "NCAA";
  if (teamId.startsWith("ushl-")) return "USHL";
  return "NHL";
}
