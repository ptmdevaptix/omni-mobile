// The standings CARD contract — one card per group (a division, a conference, a whole league), each
// with a compact default and the full column set behind "All stats". Mirrors the web's
// components/standings-cards.tsx types; the adapters in lib/standings-data.ts fill them per league,
// and the component in components/standings-card.tsx draws what it is told. It knows nothing about
// wild cards or relegation.

export type FormResult = 'W' | 'L' | 'OTL' | 'T';
/** Last results per team key (abbr for the NHL, teamId for HockeyTech/AHL/Europe, seo for the NCAA). */
export type FormMap = Record<string, FormResult[]>;

/** Where a rank sits: the rail at the card's left edge. `bye` is a playoff place that skips a round. */
export type StandingsZone = 'bye' | 'in' | 'bubble' | 'out' | 'drop';

export type StandingsBadge = { label: string; kind: 'in' | 'out' | 'title'; title?: string };

export type StandingsCardRow = {
  /** Stable key, and the `/teams/{id}` page id. */
  id: string;
  /** The name shown in the compact table — a place, or the NHL's nickname (lib/team-name rule). */
  name: string;
  /** Shown in place of the name when All stats is on: the columns need the room. */
  abbr: string;
  logo?: string;
  darkLogo?: string;
  gp: number;
  /** "W-L-OTL", or whatever the league's convention is — printed as given. */
  record: string;
  pts: number;
  /** Last results, oldest first; at most five are drawn, as the "Last 5" ticks. */
  form?: FormResult[];
  /** "W3" / "L2" — shown in the last column where a feed gives a streak but no recent results. */
  streak?: string;
  badge?: StandingsBadge;
  /** The Pct cell, ready to print, where a league's own definition beats points ÷ available. */
  pct?: string;
  /** Values for the "All stats" columns, keyed by StandingsCardGroup.statColumns[].key. */
  stats?: Record<string, number | string>;
  /** The club whose page this is (the team page's mini table). */
  us?: boolean;
};

export type StandingsCardLine = {
  /** Drawn under this 1-based rank. */
  after: number;
  label?: string;
  /** Match the rail above the line instead of the order-based color — amber under the wild cards. */
  tone?: 'bubble';
};

export type StatColumn = { key: string; label: string; title?: string };

export type StandingsCardGroup = {
  key: string;
  title: string;
  subtitle?: string;
  /** The rail color beside the title — a league's, or a country's. */
  railColor?: string;
  rows: StandingsCardRow[];
  lines?: StandingsCardLine[];
  /** The zone a row sits in, by its rank in this card — and by the row itself, for a rule that is
   *  not positional (an NHL wild-card holder sitting 4th in its division is still in). */
  zoneOf?: (rank: number, row: StandingsCardRow) => StandingsZone;
  /** No points column at all — NCAA Independents. */
  noPoints?: boolean;
  statColumns?: StatColumn[];
  /** What the record column's dashes mean — "W-L-OTL", or the SHL's "W-OTW-OTL-L". */
  recordFormat?: string;
  /** The record column's header, where "Record" is ambiguous — "Conf" beside an Overall column. */
  recordLabel?: string;
  /** Columns the compact table shows beside the record, from `stats` — the NCAA's overall record. */
  compactColumns?: StatColumn[];
  /** The last column: the last-five ticks or the feed's streak. Decided from the rows when absent. */
  recent?: 'form' | 'streak';
  /** The most points one game can pay: 2 in the NHL, 3 in the SHL. */
  pointsPerGame?: number;
  legend?: { zone: StandingsZone; label: string }[];
};

export type StandingsSeason = { id: string; name: string };

/** "2025-26 Regular Season" → "2025-26"; anything already short passes through. */
export function shortSeasonName(name: string): string {
  const m = /(\d{4})\s*[-–]\s*(\d{2,4})/.exec(name);
  if (!m) return name;
  return `${m[1]}-${m[2].slice(-2)}`;
}

/** Points as a share of the points available: ".750" — the same idea as the NHL's PCT column. */
export function pointsPct(pts: number, gp: number, perGame: number): string {
  if (!gp || !perGame) return '—';
  const v = pts / (gp * perGame);
  return v >= 1 ? '1.000' : v.toFixed(3).replace(/^0/, '');
}

export type SortKey = 'rank' | 'name' | 'gp' | 'pts' | 'pct' | `stat:${string}`;

/** The bands — rail, cut lines, legend — are a statement about the STANDINGS order, so they stay
 *  only while the rows are in it: by rank, by points, or by points percentage. */
export const isBanded = (k: SortKey) => k === 'rank' || k === 'pts' || k === 'pct';

/** Rows in the chosen order, each with its standings index (the rank it keeps whatever the sort). */
export function sortRows(group: StandingsCardGroup, sortKey: SortKey, desc: boolean): { r: StandingsCardRow; i: number }[] {
  const perGame = group.pointsPerGame ?? 2;
  const sortValue = (r: StandingsCardRow, i: number): number | string => {
    if (sortKey === 'rank') return i;
    if (sortKey === 'name') return r.name.toLowerCase();
    if (sortKey === 'gp') return r.gp;
    if (sortKey === 'pts') return r.pts;
    if (sortKey === 'pct') return r.pct != null ? parseFloat(r.pct) || 0 : r.gp ? r.pts / (r.gp * perGame) : -1;
    const v = r.stats?.[sortKey.slice(5)];
    // A percentage stored as text (".685") sorts as the number it is; a record ("17-7-3") as text.
    if (typeof v === 'string' && /^\.?\d+(\.\d+)?$/.test(v)) return parseFloat(v);
    return typeof v === 'number' ? v : typeof v === 'string' ? v.toLowerCase() : -Infinity;
  };
  return group.rows.map((r, i) => ({ r, i, v: sortValue(r, i) })).sort((a, b) => {
    if (sortKey === 'rank') return a.i - b.i;
    const c = typeof a.v === 'string' || typeof b.v === 'string' ? String(a.v).localeCompare(String(b.v)) : (a.v as number) - (b.v as number);
    // Ties fall back to the standings order, so a re-sort never shuffles equal rows at random.
    return (desc ? -c : c) || a.i - b.i;
  });
}
