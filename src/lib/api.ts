// Thin client over the omni-hockey production API (the same JSON endpoints the web app uses).
// The web app in ../omni-hockey is the single backend/source of truth — this app is just a client.

export const API_BASE = "https://omnihockey.com/api";
export const SITE_ORIGIN = "https://omnihockey.com";

// Some logos are omni-hockey's local overrides served as site-relative paths (e.g. "/team-logos/ohl-20.png").
// Those work in-browser (same origin) but not in the native app — resolve them against the site origin.
export function resolveLogo(url?: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `${SITE_ORIGIN}${url}` : url;
}

// Fetch with a hard timeout so a stalled request eventually rejects (→ React Query error state)
// instead of hanging forever and leaving a loading spinner stuck on screen.
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: init?.signal ?? ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
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
