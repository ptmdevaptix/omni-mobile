// Thin client over the omni-hockey production API (the same JSON endpoints the web app uses).
// The web app in ../omni-hockey is the single backend/source of truth — this app is just a client.
import Constants from "expo-constants";
import { Platform } from "react-native";

// Production by default. Set EXPO_PUBLIC_API_BASE (e.g. http://localhost:3000/api) before starting Metro
// to point a dev build at a local omni-hockey server — needed to exercise API changes that haven't
// shipped yet. Inlined at bundle time, so changing it requires restarting Metro.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "https://omnihockey.com/api";
export const SITE_ORIGIN = "https://omnihockey.com";

// Some logos are omni-hockey's local overrides served as site-relative paths (e.g. "/team-logos/ohl-20.png").
// Those work in-browser (same origin) but not in the native app — resolve them against the site origin.
export function resolveLogo(url?: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `${SITE_ORIGIN}${url}` : url;
}

// Fetch with a hard timeout so a stalled request eventually rejects (→ React Query error state)
// instead of hanging forever and leaving a loading spinner stuck on screen.
// Identifies app traffic to the API (e.g. "ios/0.1.0"). Google Analytics is a browser script and
// never sees this app, so this header is the cheapest way to tell app usage from web usage —
// read it server-side from the request headers. Carries no user or device identifier.
export const CLIENT_ID = `${Platform.OS}/${Constants.expoConfig?.version ?? "dev"}`;

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...(init?.headers as Record<string, string> | undefined), "X-Omni-Client": CLIENT_ID },
      signal: init?.signal ?? ctrl.signal,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// A /teams/<teamId> id → the correct header endpoint, mirroring the web app's league detection
// (NHL ids are bare abbrs; AHL/CHL/NCAA/USHL are prefixed).
// The CHL scoreboard emits team ids keyed by LEAGUE code ("qmjhl-2"), while team pages, the team
// endpoint and favorites all use the canonical /teams id, keyed by CLIENT code ("chl-lhjmq-2").
// QMJHL is the one where they differ — its client code is lhjmq — and without this a tapped CHL team
// fell through to /team/qmjhl-2 (the NHL endpoint) and 404'd. Normalising here also stops the ★ from
// storing a second, incompatible id for a team already favorited from a team page.
const CHL_CLIENT_CODE: Record<string, string> = { ohl: "ohl", whl: "whl", qmjhl: "lhjmq" };

export function canonicalTeamId(teamId: string): string {
  const m = /^(ohl|whl|qmjhl)-(.+)$/i.exec(teamId);
  return m ? `chl-${CHL_CLIENT_CODE[m[1].toLowerCase()]}-${m[2]}` : teamId;
}

export function teamHeaderPath(rawId: string): string {
  const teamId = canonicalTeamId(rawId);
  if (teamId.startsWith("ahl-")) return `/ahl-team/${teamId.slice(4)}`;
  if (teamId.startsWith("echl-")) return `/echl-team/${teamId.slice(5)}`; // keyed on the club's slug
  if (teamId.startsWith("chl-")) return `/chl-team/${teamId.slice(4)}`;
  if (teamId.startsWith("ncaa-")) return `/ncaa-team/${teamId.slice(5)}`;
  if (teamId.startsWith("ushl-")) return `/ushl-team/${teamId.slice(5)}`;
  // "cjra-bchl-16" → /cjra-team/bchl-16. The league stays in the path because the six are separate
  // HockeyTech clients; the id alone would not say which one to ask.
  if (teamId.startsWith("cjra-")) return `/cjra-team/${teamId.slice(5)}`;
  // Europe: "shl-fbk", "liiga-jyp", "elh-sparta" — the id after the prefix is the club's code or slug.
  if (teamId.startsWith("shl-")) return `/shl-team/${teamId.slice(4)}`;
  if (teamId.startsWith("liiga-")) return `/liiga-team/${teamId.slice(6)}`;
  if (teamId.startsWith("elh-")) return `/elh-team/${teamId.slice(4)}`;
  return `/team/${teamId}`;
}

/**
 * The league a club PLAYS in, for display: "chl-ohl-7" → OHL, "chl-lhjmq-2" → QMJHL,
 * "cjra-ojhl-21" → OJHL. `leagueOf` deliberately answers the BLOCK instead, because that is what
 * decides which tabs a club shows; a header that said "CHL" named a competition nobody plays in.
 */
export function displayLeagueOf(rawId: string): string {
  const teamId = canonicalTeamId(rawId);
  const m = /^(?:chl|cjra)-([a-z]+)-/.exec(teamId);
  if (!m) return leagueOf(teamId);
  return m[1] === 'lhjmq' ? 'QMJHL' : m[1].toUpperCase();
}

export function leagueOf(rawId: string): string {
  const teamId = canonicalTeamId(rawId);
  if (teamId.startsWith("ahl-")) return "AHL";
  if (teamId.startsWith("echl-")) return "ECHL";
  if (teamId.startsWith("chl-")) return "CHL";
  if (teamId.startsWith("ncaa-")) return "NCAA";
  if (teamId.startsWith("ushl-")) return "USHL";
  // The BLOCK, not the individual league — teamTabs and the rest ask this to decide what a club
  // shows, and the answer is the same for all six.
  if (teamId.startsWith("cjra-")) return "CJRA";
  // The MEMBER, not a "EURO" block: games, teams and favorites are tagged by league on the web
  // too, and the Euro pill exists only in the picker.
  if (teamId.startsWith("shl-")) return "SHL";
  if (teamId.startsWith("liiga-")) return "LIIGA";
  if (teamId.startsWith("elh-")) return "ELH";
  return "NHL";
}
