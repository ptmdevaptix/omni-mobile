// Standings per league family, shaped into the shared card contract (lib/standings-cards). Each
// adapter is a port of the web's component of the same name — nhl-standings.tsx, ahl-standings.tsx,
// ht-league-standings.tsx, ncaa-conference-standings.tsx, shl/liiga/elh-standings.tsx — with the
// rendering left to components/standings-card.tsx. The two must not drift: a format change on the
// web (a league's cut, a conference's byes) is the same edit here.
import { api } from './api';
import { leagueById, type LeagueId } from './leagues';
import { NHL_TEAM_NAMES } from './nhl-teams';
import type {
  FormMap, StandingsBadge, StandingsCardGroup, StandingsCardLine, StandingsCardRow, StandingsSeason, StandingsZone, StatColumn,
} from './standings-cards';

export type StandingsFamily = 'nhl' | 'ahl' | 'ht' | 'ncaa' | 'euro';
export type Grouping = 'division' | 'conference' | 'league' | 'wildcard';

/** Which adapter draws a league. The ECHL answers in the HockeyTech shape, so it is `ht`. */
export function standingsFamily(id: LeagueId): StandingsFamily {
  if (id === 'nhl') return 'nhl';
  if (id === 'ahl') return 'ahl';
  const kind = leagueById(id).standingsKind;
  return kind === 'ncaa' ? 'ncaa' : kind === 'euro' ? 'euro' : 'ht';
}

// What every standings route answers with. Rows are left untyped here: each adapter reads the
// fields its feed carries.
export type StandingsPayload = {
  teams?: any[];
  form?: FormMap;
  seasons?: StandingsSeason[];
  seasonId?: string | null;
  /** SHL: the feed's own bands. */
  groupings?: { description: string; first: number; last: number }[];
  /** Liiga / Extraliga: the feed's cut ranks — [direct, playIn, safe]. */
  lines?: number[];
  error?: string;
};

/** Every route accepts `?season=<id>` and answers with the seasons it offers; null = its default. */
export async function fetchStandingsPayload(id: LeagueId, seasonId: string | null): Promise<StandingsPayload> {
  const path = leagueById(id).standingsPath;
  return api<StandingsPayload>(seasonId ? `${path}?season=${encodeURIComponent(seasonId)}` : path);
}

export type ViewSpec = { views: Grouping[]; defaultView: Grouping };
export const VIEW_LABEL: Record<Grouping, string> = { division: 'Division', conference: 'Conference', league: 'League', wildcard: 'Playoffs' };

/** The groupings a league offers, and the one it opens on (the view its playoff rule fits). */
export function standingsViews(id: LeagueId): ViewSpec {
  switch (standingsFamily(id)) {
    case 'nhl': return { views: ['division', 'wildcard', 'conference', 'league'], defaultView: 'division' };
    case 'ahl': return { views: ['division', 'conference', 'league'], defaultView: 'division' };
    case 'ht': {
      const cfg = HT_CONFIGS[id];
      const views: Grouping[] = cfg?.hasDivisions ? ['division', 'conference', 'league'] : ['conference', 'league'];
      return { views, defaultView: cfg?.cut?.per ?? (cfg?.hasDivisions ? 'division' : 'conference') };
    }
    default: return { views: ['league'], defaultView: 'league' };
  }
}

/** The league's playoff rule, in a sentence, under the cards. */
export function standingsNote(id: LeagueId): string | undefined {
  switch (standingsFamily(id)) {
    case 'nhl': return NHL_NOTE;
    case 'ahl': return AHL_NOTE;
    case 'ht': return HT_CONFIGS[id]?.playoffNote;
    case 'euro': return EURO_NOTE[id];
    default: return undefined;
  }
}

export type BuildOptions = {
  /** The rail color beside each card's title — the league's pill color. */
  rail?: string;
  /** Page id → the club's place, from the team directory: how a non-NHL row is named. */
  placeById: ReadonlyMap<string, string | undefined>;
};

export function buildStandingsGroups(id: LeagueId, payload: StandingsPayload, view: Grouping, opts: BuildOptions): StandingsCardGroup[] {
  const teams = payload.teams ?? [];
  if (!teams.length) return [];
  switch (standingsFamily(id)) {
    case 'nhl': return nhlGroups(teams, view, payload.form, opts);
    case 'ahl': return ahlGroups(teams, view, payload.form, opts);
    case 'ht': return htGroups(id, teams, view, payload.form, opts);
    case 'ncaa': return ncaaGroups(teams, payload.form, opts);
    case 'euro': return euroGroups(id, payload, opts);
  }
}

// ── NHL ───────────────────────────────────────────────────────────────────────

type NhlTeam = {
  name: string; abbr: string; logo: string; darkLogo?: string;
  division: string; conference: string; clinch: string | null;
  gp: number; w: number; l: number; otl: number; pts: number;
  rw: number; row: number; sow: number; sol: number;
  homeW: number; homeL: number; homeOtl: number; awayW: number; awayL: number; awayOtl: number;
  gf: number; ga: number; diff: number; l10W: number; l10L: number; l10Otl: number;
  streakCode: string; streakCount: number;
  divisionSequence: number; wildcardSequence: number; conferenceSequence: number; leagueSequence: number;
};

const NHL_CONF_DIVISIONS: Record<string, string[]> = { Eastern: ['Atlantic', 'Metropolitan'], Western: ['Central', 'Pacific'] };

const NHL_STAT_COLUMNS: StatColumn[] = [
  { key: 'w', label: 'W', title: 'Wins' }, { key: 'l', label: 'L', title: 'Losses' }, { key: 'otl', label: 'OTL', title: 'Overtime losses' },
  { key: 'rw', label: 'RW', title: 'Regulation wins' }, { key: 'row', label: 'ROW', title: 'Regulation + overtime wins' },
  { key: 'sow', label: 'SOW', title: 'Shootout wins' }, { key: 'sol', label: 'SOL', title: 'Shootout losses' },
  { key: 'gf', label: 'GF', title: 'Goals for' }, { key: 'ga', label: 'GA', title: 'Goals against' }, { key: 'diff', label: 'Diff', title: 'Goal differential' },
  { key: 'home', label: 'Home', title: 'Home record' }, { key: 'away', label: 'Away', title: 'Away record' }, { key: 'l10', label: 'L10', title: 'Last ten games' },
];

const NHL_NOTE = 'The top 3 teams in each division qualify automatically; the next 2 in each conference by points, regardless of division, take the wild cards — 16 teams total.';

/** Clinch letters → badge: x berth, y division, z conference, p Presidents' Trophy, e eliminated. */
function nhlBadge(clinch: string | null): StandingsBadge | undefined {
  switch ((clinch ?? '').toLowerCase()) {
    case 'e': return { label: 'E', kind: 'out', title: 'Eliminated from playoff contention' };
    case 'p': return { label: 'P', kind: 'title', title: "Presidents' Trophy — best record in the league" };
    case 'z': return { label: 'Z', kind: 'title', title: 'Clinched the conference' };
    case 'y': return { label: 'Y', kind: 'title', title: 'Clinched the division' };
    case 'x': return { label: 'X', kind: 'in', title: 'Clinched a playoff berth' };
    default: return undefined;
  }
}

function nhlRow(t: NhlTeam, form?: FormMap): StandingsCardRow {
  const wc = t.wildcardSequence;
  return {
    id: t.abbr.toLowerCase(),
    // The NHL is the one league named by nickname (lib/team-name). The static table, never a split.
    name: NHL_TEAM_NAMES[t.abbr.toUpperCase()]?.nickname ?? t.name,
    abbr: t.abbr, logo: t.logo, darkLogo: t.darkLogo,
    gp: t.gp, record: `${t.w}-${t.l}-${t.otl}`, pts: t.pts,
    form: form?.[t.abbr],
    streak: t.streakCount ? `${t.streakCode}${t.streakCount}` : undefined,
    // A wild-card holder is marked as one wherever it appears; the clinch letter gives way to it
    // (it is in the playoffs either way), but an elimination still shows.
    badge: t.clinch === 'e' ? nhlBadge(t.clinch) : wc === 1 || wc === 2 ? { label: `WC${wc}`, kind: 'in', title: 'Holds a wild card' } : nhlBadge(t.clinch),
    stats: {
      w: t.w, l: t.l, otl: t.otl, rw: t.rw, row: t.row, sow: t.sow, sol: t.sol, gf: t.gf, ga: t.ga, diff: t.diff,
      home: `${t.homeW}-${t.homeL}-${t.homeOtl}`, away: `${t.awayW}-${t.awayL}-${t.awayOtl}`, l10: `${t.l10W}-${t.l10L}-${t.l10Otl}`,
      // The league's own wild-card and division ranks, read by the zones rather than shown.
      wc: t.wildcardSequence, div: t.divisionSequence,
    },
  };
}

/**
 * The wild-card order for a conference. The feed ranks it once the season is under way; before
 * opening night the field is zero for everyone, so the same set — fourth in a division and below —
 * is ordered by conference rank instead, and the card is populated rather than empty for a week.
 */
function wildCardOrder(teams: NhlTeam[], conf: string): NhlTeam[] {
  const ranked = teams.filter((t) => t.conference === conf && t.wildcardSequence >= 1);
  if (ranked.length) return ranked.sort((a, b) => a.wildcardSequence - b.wildcardSequence);
  return teams
    .filter((t) => t.conference === conf && t.divisionSequence > 3)
    .sort((a, b) => a.conferenceSequence - b.conferenceSequence)
    .map((t, i) => ({ ...t, wildcardSequence: i + 1 }));
}

function nhlGroups(input: NhlTeam[], view: Grouping, form: FormMap | undefined, opts: BuildOptions): StandingsCardGroup[] {
  const common = { statColumns: NHL_STAT_COLUMNS, recordFormat: 'W-L-OTL', railColor: opts.rail, recent: 'form' as const };
  const wcOf = (r: StandingsCardRow) => Number(r.stats?.wc ?? 0);
  // Green for a division's top three, amber for the conference's two wild cards — in every view.
  const zone = (r: StandingsCardRow): StandingsZone => Number(r.stats?.div ?? 99) <= 3 ? 'in' : wcOf(r) === 1 || wcOf(r) === 2 ? 'bubble' : 'out';
  const legend = [{ zone: 'in' as const, label: 'Division top 3' }, { zone: 'bubble' as const, label: 'Wild card' }];
  // With the feed's wild-card ranks filled in where it left them blank.
  const withWc = new Map<string, number>();
  for (const conf of Object.keys(NHL_CONF_DIVISIONS)) for (const t of wildCardOrder(input, conf)) withWc.set(t.abbr, t.wildcardSequence);
  const teams = input.map((t) => ({ ...t, wildcardSequence: withWc.get(t.abbr) ?? 0 }));
  const row = (t: NhlTeam) => nhlRow(t, form);
  const byDivision = (a: NhlTeam, b: NhlTeam) => a.divisionSequence - b.divisionSequence;

  if (view === 'division') {
    const out: StandingsCardGroup[] = [];
    for (const [conf, divs] of Object.entries(NHL_CONF_DIVISIONS)) {
      for (const div of divs) {
        out.push({
          key: div, title: div, subtitle: conf,
          rows: teams.filter((t) => t.division === div).sort(byDivision).map(row),
          lines: [{ after: 3, label: 'Division top 3 — automatic' }],
          zoneOf: (_rank, r) => zone(r), legend, ...common,
        });
      }
    }
    return out;
  }
  if (view === 'wildcard') {
    const out: StandingsCardGroup[] = [];
    for (const [conf, divs] of Object.entries(NHL_CONF_DIVISIONS)) {
      for (const div of divs) {
        out.push({
          key: `wc-${div}`, title: div, subtitle: `${conf} · Top 3 automatic`,
          rows: teams.filter((t) => t.division === div && t.divisionSequence <= 3).sort(byDivision).map(row),
          zoneOf: () => 'in', ...common,
        });
      }
      out.push({
        key: `wc-${conf}`, title: `${conf} Wild Card`, subtitle: 'The next 2 by points, regardless of division',
        rows: wildCardOrder(teams, conf).map(row),
        lines: [{ after: 2, label: 'Wild-card line', tone: 'bubble' }],
        zoneOf: (rank): StandingsZone => rank <= 2 ? 'bubble' : 'out',
        legend: [{ zone: 'bubble', label: 'Wild card' }], ...common,
      });
    }
    return out;
  }
  if (view === 'conference') {
    return Object.keys(NHL_CONF_DIVISIONS).map((conf) => ({
      key: conf, title: `${conf} Conference`,
      // No line: the conference order is not how the league seeds, so the rail marks the qualifiers
      // and no cut is drawn.
      rows: teams.filter((t) => t.conference === conf).sort((a, b) => a.conferenceSequence - b.conferenceSequence).map(row),
      zoneOf: (_rank, r) => zone(r), legend, ...common,
    }));
  }
  return [{ key: 'league', title: 'National Hockey League', rows: [...teams].sort((a, b) => a.leagueSequence - b.leagueSequence).map(row), zoneOf: (_rank, r) => zone(r), legend, ...common }];
}

// ── AHL ───────────────────────────────────────────────────────────────────────

type AhlTeam = {
  teamId: string; name: string; abbr: string; logo: string | null; division: string; conference: string; clinch: string | null;
  rank: number; gp: number; w: number; l: number; otl: number; sol: number; pts: number; rw: number; row: number; gf: number; ga: number; diff: number; streak?: string;
};

const AHL_CONF_DIVISIONS: Record<string, string[]> = {
  'Eastern Conference': ['Atlantic Division', 'North Division'],
  'Western Conference': ['Central Division', 'Pacific Division'],
};
export const AHL_PLAYOFF_SPOTS: Record<string, { qualify: number; bye: number }> = {
  'Atlantic Division': { qualify: 6, bye: 2 }, 'North Division': { qualify: 5, bye: 3 },
  'Central Division': { qualify: 5, bye: 3 }, 'Pacific Division': { qualify: 7, bye: 1 },
};
const AHL_STAT_COLUMNS: StatColumn[] = [
  { key: 'w', label: 'W', title: 'Wins' }, { key: 'l', label: 'L', title: 'Losses' }, { key: 'otl', label: 'OTL', title: 'Overtime losses' },
  { key: 'sol', label: 'SOL', title: 'Shootout losses' }, { key: 'rw', label: 'RW', title: 'Regulation wins' }, { key: 'row', label: 'ROW', title: 'Regulation + overtime wins' },
  { key: 'gf', label: 'GF', title: 'Goals for' }, { key: 'ga', label: 'GA', title: 'Goals against' }, { key: 'diff', label: 'Diff', title: 'Goal differential' },
];
const AHL_NOTE = 'The top 6 teams in the Atlantic, top 5 in the North, top 5 in the Central, and top 7 in the Pacific qualify for the Calder Cup Playoffs — 23 teams total. The top 2 in the Atlantic, top 3 in the North, top 3 in the Central, and 1st in the Pacific receive first-round byes (9 teams). First round is best-of-3, second and third rounds are best-of-5, Conference Finals and Calder Cup Finals are best-of-7.';

/** A bye that is mathematically clinched: no chaser can reach the club's points with every game left. */
function computeByeTeams(all: AhlTeam[]): Set<string> {
  const out = new Set<string>();
  const AHL_GAMES = 72;
  for (const div of Object.keys(AHL_PLAYOFF_SPOTS)) {
    const byeSpots = AHL_PLAYOFF_SPOTS[div].bye;
    const byRank = all.filter((t) => t.division === div).sort((a, b) => a.rank - b.rank);
    const chasers = byRank.slice(byeSpots);
    if (!chasers.length) continue;
    const maxChaserPts = Math.max(...chasers.map((c) => c.pts + (AHL_GAMES - c.gp) * 2));
    for (const t of byRank.slice(0, byeSpots)) if (t.clinch && t.clinch !== 'e' && t.pts > maxChaserPts) out.add(t.teamId);
  }
  return out;
}

/** Standings order: points, then regulation wins, then ROW, then goal difference. */
const byPtsRwRow = <T extends { pts: number; rw: number; row: number; diff: number; name: string }>(a: T, b: T) =>
  b.pts - a.pts || b.rw - a.rw || b.row - a.row || b.diff - a.diff || a.name.localeCompare(b.name);

function ahlGroups(teams: AhlTeam[], view: Grouping, form: FormMap | undefined, opts: BuildOptions): StandingsCardGroup[] {
  const byes = computeByeTeams(teams);
  const common = { statColumns: AHL_STAT_COLUMNS, recordFormat: 'W-L-OTL-SOL', railColor: opts.rail, recent: 'form' as const };
  const row = (t: AhlTeam): StandingsCardRow => {
    const c = (t.clinch ?? '').toLowerCase();
    const id = `ahl-${t.teamId}`;
    const badge: StandingsBadge | undefined =
      c === 'e' ? { label: 'E', kind: 'out', title: 'Eliminated from playoff contention' }
      : byes.has(t.teamId) ? { label: 'Bye', kind: 'title', title: 'Clinched a first-round bye' }
      : c ? { label: 'X', kind: 'in', title: 'Clinched a playoff berth' } : undefined;
    return {
      id, name: opts.placeById.get(id) || t.name, abbr: t.abbr, logo: t.logo ?? undefined,
      gp: t.gp, record: `${t.w}-${t.l}-${t.otl}-${t.sol}`, pts: t.pts, form: form?.[t.teamId], streak: t.streak, badge,
      stats: { w: t.w, l: t.l, otl: t.otl, sol: t.sol, rw: t.rw, row: t.row, gf: t.gf, ga: t.ga, diff: t.diff },
    };
  };
  if (view === 'division') {
    const out: StandingsCardGroup[] = [];
    for (const [conf, divs] of Object.entries(AHL_CONF_DIVISIONS)) {
      for (const div of divs) {
        const spots = AHL_PLAYOFF_SPOTS[div];
        const rows = teams.filter((t) => t.division === div).sort(byPtsRwRow);
        if (!rows.length) continue;
        // Green on top, amber beneath, as on every league: the byes green, the first-round field amber.
        out.push({
          key: div, title: div.replace(/ Division$/, ''),
          subtitle: spots ? `${conf.replace(/ Conference$/, '')} · Top ${spots.qualify} qualify, ${spots.bye === 1 ? '1st gets' : `top ${spots.bye} get`} a bye` : conf,
          rows: rows.map(row),
          lines: spots ? [{ after: spots.bye, label: 'Bye line' }, { after: spots.qualify, label: 'Playoff line' }] : undefined,
          zoneOf: (rank): StandingsZone => !spots ? 'out' : rank <= spots.bye ? 'in' : rank <= spots.qualify ? 'bubble' : 'out',
          legend: spots ? [{ zone: 'in', label: 'First-round bye' }, { zone: 'bubble', label: 'First round' }] : undefined,
          ...common,
        });
      }
    }
    return out;
  }
  if (view === 'conference') {
    return Object.keys(AHL_CONF_DIVISIONS).map((conf) => ({
      key: conf, title: conf, rows: teams.filter((t) => t.conference === conf).sort(byPtsRwRow).map(row), ...common,
    }));
  }
  return [{ key: 'league', title: 'American Hockey League', rows: [...teams].sort(byPtsRwRow).map(row), ...common }];
}

// ── HockeyTech leagues (and the ECHL, whose route answers in the same shape) ──

type HtTeam = {
  teamId: string; name: string; abbr: string; logoMain: string; logo50: string; pageId?: string;
  division: string; conference: string; clinch: string | null; rank: number;
  gp: number; w: number; l: number; otl: number; sol: number; sow: number; otw: number; pts: number; rw: number; row: number; gf: number; ga: number; diff: number; streak?: string;
};

type HtConfig = {
  label: string;
  /** False where the feed's conference IS the finest group (QMJHL, USHL, five of the Jr A six). */
  hasDivisions: boolean;
  /** The playoff format: how many qualify and at what level; `playIn` = a further band that plays in. */
  cut?: { per: Grouping; top: number; playIn?: number };
  playoffNote: string;
  /** The ECHL has no schedule feed behind it, so its last column stays the streak the scrape gives. */
  streakOnly?: boolean;
};

const HT_CONFIGS: Partial<Record<LeagueId, HtConfig>> = {
  ohl: { label: 'Ontario Hockey League', hasDivisions: true, cut: { per: 'division', top: 4 }, playoffNote: 'The top 4 teams in each division qualify for the OHL Playoffs — 16 teams total.' },
  whl: { label: 'Western Hockey League', hasDivisions: true, cut: { per: 'division', top: 4 }, playoffNote: 'The top 4 teams in each division qualify for the WHL Playoffs — 16 teams total.' },
  qmjhl: { label: 'Quebec Maritimes Junior Hockey League', hasDivisions: false, cut: { per: 'conference', top: 8 }, playoffNote: 'The top 8 teams in each conference qualify for the QMJHL Playoffs — 16 teams total.' },
  ushl: { label: 'United States Hockey League', hasDivisions: false, cut: { per: 'conference', top: 6 }, playoffNote: 'The top 6 teams in each conference qualify for the Clark Cup Playoffs — 12 teams total.' },
  echl: { label: 'ECHL', hasDivisions: true, cut: { per: 'division', top: 4 }, playoffNote: 'The top 4 teams in each division qualify for the Kelly Cup Playoffs — 16 teams total.', streakOnly: true },
  // Canadian Junior A — each rule is that league's own; three of the six seed league-wide.
  bchl: { label: 'British Columbia Hockey League', hasDivisions: true, cut: { per: 'division', top: 4 }, playoffNote: 'The top 4 teams in each of the four divisions qualify for the Rogers BCHL Cup Playoffs — 16 of 20 teams.' },
  ajhl: { label: 'Alberta Junior Hockey League', hasDivisions: false, cut: { per: 'league', top: 6, playIn: 10 }, playoffNote: 'The top 10 teams league-wide qualify for the Inter Pipeline Cup Playoffs, with seeds 7–10 meeting in a play-in round — 10 of 12 teams.' },
  sjhl: { label: 'Saskatchewan Junior Hockey League', hasDivisions: false, cut: { per: 'league', top: 8 }, playoffNote: 'The top 8 teams league-wide qualify for the Canterra Seeds Cup Playoffs, regardless of division — 8 of 12 teams.' },
  mjhl: { label: 'Manitoba Junior Hockey League', hasDivisions: false, cut: { per: 'conference', top: 4 }, playoffNote: 'The top 4 teams in each division qualify for the Turnbull Cup Playoffs, reseeded league-wide after the first round — 8 of 13 teams.' },
  ojhl: { label: 'Ontario Junior Hockey League', hasDivisions: false, cut: { per: 'conference', top: 8 }, playoffNote: 'The top 8 teams in each conference qualify for the Buckland Cup Playoffs — 16 of 24 teams.' },
  cchl: { label: 'Central Canada Hockey League', hasDivisions: false, cut: { per: 'league', top: 8 }, playoffNote: 'The top 8 teams league-wide qualify for the Bogart Cup Playoffs — the two divisions are for scheduling only.' },
};

/** Clinch letters → badge: x clinched, y division, z conference, p first overall, e eliminated. */
function htBadge(clinch: string | null): StandingsBadge | undefined {
  const c = (clinch ?? '').toLowerCase();
  if (!c) return undefined;
  if (c.includes('e')) return { label: 'E', kind: 'out', title: 'Eliminated from playoff contention' };
  if (c.includes('p')) return { label: 'P', kind: 'title', title: 'Clinched first overall' };
  if (c.includes('z')) return { label: 'Z', kind: 'title', title: 'Clinched the conference' };
  if (c.includes('y')) return { label: 'Y', kind: 'title', title: 'Clinched the division' };
  if (c.includes('x')) return { label: 'X', kind: 'in', title: 'Clinched a playoff berth' };
  return { label: c.toUpperCase(), kind: 'in' };
}

function htGroups(id: LeagueId, teams: HtTeam[], view: Grouping, form: FormMap | undefined, opts: BuildOptions): StandingsCardGroup[] {
  const cfg = HT_CONFIGS[id];
  if (!cfg) return [];
  const cut = cfg.cut && cfg.cut.per === view ? cfg.cut : undefined;
  const lines: StandingsCardLine[] | undefined = cut ? [
    { after: cut.top, label: 'Playoff line' },
    ...(cut.playIn ? [{ after: cut.playIn, label: 'Play-in line' }] : []),
  ] : undefined;
  const zoneOf = cut ? (rank: number): StandingsZone => rank <= cut.top ? 'in' : cut.playIn && rank <= cut.playIn ? 'bubble' : 'out' : undefined;
  const legend = cut ? [
    { zone: 'in' as const, label: cut.playIn ? 'Bye to the playoffs' : 'Playoff position' },
    ...(cut.playIn ? [{ zone: 'bubble' as const, label: 'Play-in' }] : []),
  ] : undefined;
  const subtitle = cut ? `Top ${cut.top} qualify${cut.playIn ? ` · ${cut.top + 1}–${cut.playIn} play in` : ''}` : undefined;
  const common = { lines, zoneOf, legend, statColumns: AHL_STAT_COLUMNS, recordFormat: 'W-L-OTL-SOL', railColor: opts.rail, recent: (cfg.streakOnly ? 'streak' : 'form') as 'streak' | 'form' };
  const row = (t: HtTeam): StandingsCardRow => {
    const pageId = t.pageId ?? `${leagueById(id).teamKind === 'chl' ? `chl-${id}` : leagueById(id).teamKind === 'cjra' ? `cjra-${id}` : id}-${t.teamId}`;
    return {
      id: pageId, name: opts.placeById.get(pageId) || t.name, abbr: t.abbr, logo: t.logoMain || t.logo50,
      gp: t.gp, record: `${t.w}-${t.l}-${t.otl}${t.sol ? `-${t.sol}` : ''}`, pts: t.pts,
      form: form?.[t.teamId], streak: t.streak, badge: htBadge(t.clinch),
      stats: { w: t.w, l: t.l, otl: t.otl, sol: t.sol, rw: t.rw, row: t.row, gf: t.gf, ga: t.ga, diff: t.diff },
    };
  };
  if (view === 'league') return [{ key: 'league', title: cfg.label, subtitle, rows: [...teams].sort(byPtsRwRow).map(row), ...common }];
  // Groups in the order the feed lists them (its conference/division order is the league's own).
  const keyOf = (t: HtTeam) => view === 'division' ? `${t.conference}|${t.division}` : t.conference;
  const seen = new Map<string, HtTeam[]>();
  for (const t of teams) {
    const k = keyOf(t);
    if (!seen.has(k)) seen.set(k, []);
    seen.get(k)!.push(t);
  }
  return [...seen.entries()].map(([k, rows]) => {
    const first = rows[0];
    const title = view === 'division' ? first.division.replace(/ Division$/i, '') : first.conference;
    const parent = view === 'division' && first.conference && first.conference !== first.division ? first.conference.replace(/ Conference$/i, '') : '';
    return { key: k, title, subtitle: [parent, subtitle].filter(Boolean).join(' · ') || undefined, rows: [...rows].sort(byPtsRwRow).map(row), ...common };
  });
}

// ── NCAA ──────────────────────────────────────────────────────────────────────

type NcaaTeam = {
  name: string; abbr: string; seo: string; logo: string; conference: string;
  cW: number; cL: number; cT: number; cPts: number; cGP: number; cGF: number; cGA: number;
  oW: number; oL: number; oT: number; oGP: number; oGF: number; oGA: number;
};

const NCAA_STAT_COLUMNS: StatColumn[] = [
  { key: 'conf', label: 'Conf', title: 'Conference record (W-L-T)' }, { key: 'pct', label: 'Pct', title: 'Conference winning percentage' },
  { key: 'overall', label: 'Overall', title: 'Overall record (W-L-T)' }, { key: 'oPct', label: 'Pct', title: 'Overall winning percentage' },
  { key: 'nonconf', label: 'Non-conf', title: 'Non-conference record (W-L-T)' },
  { key: 'oGF', label: 'GF', title: 'Overall goals for' }, { key: 'oGA', label: 'GA', title: 'Overall goals against' },
  { key: 'cGF', label: 'Conf GF', title: 'Conference goals for' }, { key: 'cGA', label: 'Conf GA', title: 'Conference goals against' },
];
const NCAA_INDEPENDENT_COLUMNS: StatColumn[] = [
  { key: 'overall', label: 'Overall', title: 'Overall record (W-L-T)' }, { key: 'pct', label: 'Pct', title: 'Overall winning percentage' },
  { key: 'oGF', label: 'GF', title: 'Overall goals for' }, { key: 'oGA', label: 'GA', title: 'Overall goals against' },
];
/** Each conference's tournament format: `bye` seeds skip the first round, `qualify` is the last seed in. */
const NCAA_FORMATS: Record<string, { bye: number; qualify?: number }> = {
  'Atlantic Hockey': { bye: 6 }, 'Big Ten': { bye: 1 }, CCHA: { bye: 0, qualify: 8 }, 'ECAC Hockey': { bye: 4 }, 'Hockey East': { bye: 5 }, NCHC: { bye: 0 },
};
const NCAA_EXCLUDED_SEO = new Set(['assumption']);
const NCAA_INDEPENDENTS = 'Independents';

/** Winning percentage with a tie as half a win, ".750" — how college hockey states it. */
function winPct(w: number, l: number, t: number): string {
  const gp = w + l + t;
  if (!gp) return '.000';
  const v = (w + t / 2) / gp;
  return v >= 1 ? '1.000' : v.toFixed(3).replace(/^0/, '');
}

function ncaaGroups(input: NcaaTeam[], form: FormMap | undefined, opts: BuildOptions): StandingsCardGroup[] {
  const teams = input.filter((t) => !NCAA_EXCLUDED_SEO.has(t.seo ?? ''));
  const byConf = new Map<string, NcaaTeam[]>();
  for (const t of teams) {
    const c = t.conference ?? NCAA_INDEPENDENTS;
    if (!byConf.has(c)) byConf.set(c, []);
    byConf.get(c)!.push(t);
  }
  const byStandings = (a: NcaaTeam, b: NcaaTeam) =>
    b.cPts - a.cPts || parseFloat(winPct(b.cW, b.cL, b.cT)) - parseFloat(winPct(a.cW, a.cL, a.cT)) || b.oW - a.oW || a.oL - b.oL || a.name.localeCompare(b.name);
  const byOverall = (a: NcaaTeam, b: NcaaTeam) =>
    parseFloat(winPct(b.oW, b.oL, b.oT)) - parseFloat(winPct(a.oW, a.oL, a.oT)) || b.oW - a.oW || a.name.localeCompare(b.name);
  const row = (t: NcaaTeam): StandingsCardRow => {
    const id = `ncaa-${t.seo}`;
    return {
      id, name: opts.placeById.get(id) || t.name, abbr: t.abbr, logo: t.logo,
      gp: t.cGP, record: `${t.cW}-${t.cL}-${t.cT}`, pts: t.cPts, pct: winPct(t.cW, t.cL, t.cT), form: form?.[t.seo],
      stats: {
        conf: `${t.cW}-${t.cL}-${t.cT}`, pct: winPct(t.cW, t.cL, t.cT), overall: `${t.oW}-${t.oL}-${t.oT}`, oPct: winPct(t.oW, t.oL, t.oT),
        // Non-conference = overall less conference; the feed carries both, never the difference.
        nonconf: `${Math.max(0, t.oW - t.cW)}-${Math.max(0, t.oL - t.cL)}-${Math.max(0, t.oT - t.cT)}`,
        oGF: t.oGF, oGA: t.oGA, cGF: t.cGF, cGA: t.cGA,
      },
    };
  };
  // Alphabetical, Independents always last — a residual bucket, not a conference.
  const order = [...byConf.keys()].sort((a, b) => (a === NCAA_INDEPENDENTS ? 1 : 0) - (b === NCAA_INDEPENDENTS ? 1 : 0) || a.localeCompare(b));
  return order.map((conf) => {
    const fmt = NCAA_FORMATS[conf];
    const list = byConf.get(conf)!;
    const size = list.length;
    const qualify = fmt?.qualify ?? size;
    const lines: StandingsCardLine[] = fmt ? [
      ...(fmt.bye > 0 ? [{ after: fmt.bye, label: 'Bye line' }] : []),
      ...(qualify < size ? [{ after: qualify, label: 'Tournament line' }] : []),
    ] : [];
    // Green on top, amber beneath: the byes green and the first-round field amber; a conference
    // with no byes marks its field green.
    const zoneOf = fmt
      ? (rank: number): StandingsZone => fmt.bye > 0 ? (rank <= fmt.bye ? 'in' : rank <= qualify ? 'bubble' : 'out') : qualify < size ? (rank <= qualify ? 'in' : 'out') : 'out'
      : undefined;
    const legend = fmt ? [
      ...(fmt.bye > 0 ? [{ zone: 'in' as const, label: 'First-round bye' }, { zone: 'bubble' as const, label: 'First round' }] : []),
      ...(fmt.bye === 0 && qualify < size ? [{ zone: 'in' as const, label: 'Tournament' }] : []),
    ] : [];
    const independent = conf === NCAA_INDEPENDENTS;
    const subtitle = independent ? 'No conference schedule' : fmt ? (fmt.bye > 0 ? `Top ${fmt.bye} bye` : qualify < size ? `Top ${qualify} qualify` : 'Everyone qualifies') : 'Conference record';
    return {
      key: conf, title: conf, subtitle,
      lines: lines.length ? lines : undefined, zoneOf, legend: legend.length ? legend : undefined, railColor: opts.rail,
      // The overall record sits beside the conference one. Independents have no conference schedule,
      // so their one record IS the overall: no points, no conference columns.
      recordFormat: independent ? 'W-L-T (overall)' : 'W-L-T (conference)',
      recordLabel: independent ? 'Overall' : 'Conf',
      compactColumns: independent ? [] : [{ key: 'overall', label: 'Overall', title: 'Overall record (W-L-T)' }],
      recent: 'form' as const,
      rows: [...list].sort(independent ? byOverall : byStandings).map((t) => {
        const r = row(t);
        if (!independent) return r;
        const overall = winPct(t.oW, t.oL, t.oT);
        return { ...r, record: String(r.stats?.overall ?? r.record), gp: t.oGP, pct: overall, stats: { ...r.stats, pct: overall } };
      }),
      noPoints: independent,
      statColumns: independent ? NCAA_INDEPENDENT_COLUMNS : NCAA_STAT_COLUMNS,
    };
  });
}

// ── Europe: one card, the league's own bands ──────────────────────────────────

const EURO_STAT_COLUMNS: StatColumn[] = [
  { key: 'w', label: 'W', title: 'Regulation wins' }, { key: 'otw', label: 'OTW', title: 'Overtime and shootout wins' },
  { key: 'l', label: 'L', title: 'Regulation losses' }, { key: 'otl', label: 'OTL', title: 'Overtime and shootout losses' },
  { key: 'gf', label: 'GF', title: 'Goals for' }, { key: 'ga', label: 'GA', title: 'Goals against' }, { key: 'diff', label: 'Diff', title: 'Goal differential' },
];
const EURO_NOTE: Partial<Record<LeagueId, string>> = {
  shl: "A regulation win is worth 3 points, an overtime or shootout win 2, and an overtime or shootout loss 1. The top 6 go straight to the SM playoffs; 7th–10th meet in a best-of-three play-in for the last two places. 13th and 14th play a relegation qualifier against HockeyAllsvenskan's best.",
  liiga: 'A regulation win is worth 3 points, an overtime or shootout win 2, and an overtime or shootout loss 1. The top group goes straight to the quarterfinals, the next plays in for the remaining places, and the bottom plays out against relegation.',
  elh: 'A regulation win is worth 3 points, an overtime or shootout win 2, and an overtime or shootout loss 1. The top 4 go straight to the quarterfinals; 5th–12th play the pre-playoff (best of five) for the other four places. 13th is done; 14th plays the relegation series against the second tier’s champion.',
};
const SHL_FALLBACK_BANDS = [
  { description: 'Playoff', first: 1, last: 6 }, { description: 'Playin', first: 7, last: 10 },
  { description: 'MissedPlayoff', first: 11, last: 12 }, { description: 'QualificationDown', first: 13, last: 14 },
];
const SHL_ZONE: Record<string, StandingsZone> = { Playoff: 'in', Playin: 'bubble', MissedPlayoff: 'out', QualificationDown: 'drop' };
/** The rail beside a European card wears the country's flag color, as on the web (flagBadgeColors). */
const EURO_RAIL: Partial<Record<LeagueId, string>> = { shl: '#006AA7', liiga: '#003580', elh: '#11457E' };
const EURO_TITLE: Partial<Record<LeagueId, string>> = { shl: 'Swedish Hockey League', liiga: 'Liiga', elh: 'Czech Extraliga' };

function euroGroups(id: LeagueId, payload: StandingsPayload, opts: BuildOptions): StandingsCardGroup[] {
  const teams = (payload.teams ?? []) as HtTeam[];
  const size = teams.length;
  let zoneOf: (rank: number) => StandingsZone;
  let lines: StandingsCardLine[];
  let subtitle: string;
  let legend: { zone: StandingsZone; label: string }[];
  if (id === 'shl') {
    const bands = payload.groupings?.length ? payload.groupings : SHL_FALLBACK_BANDS;
    zoneOf = (rank) => SHL_ZONE[bands.find((b) => rank >= b.first && rank <= b.last)?.description ?? ''] ?? 'out';
    const playoffEnd = bands.find((b) => b.description === 'Playoff')?.last ?? 6;
    const playinEnd = bands.find((b) => b.description === 'Playin')?.last ?? 10;
    const dropStart = bands.find((b) => b.description === 'QualificationDown')?.first ?? 13;
    lines = [{ after: playoffEnd, label: 'Playoff line' }, { after: playinEnd, label: 'Play-in line' }, { after: dropStart - 1, label: 'Relegation qualifier' }];
    subtitle = `Top ${playoffEnd} qualify · ${playoffEnd + 1}–${playinEnd} play in`;
    legend = [{ zone: 'in', label: 'SM playoffs' }, { zone: 'bubble', label: 'Play-in (best of three)' }, { zone: 'drop', label: 'Relegation qualifier' }];
  } else {
    const [direct = 0, playIn = 0, safe = 0] = payload.lines ?? [];
    zoneOf = (rank) => direct && rank <= direct ? 'in' : playIn && rank <= playIn ? 'bubble' : safe && rank > safe && safe < size ? 'drop' : 'out';
    const elh = id === 'elh';
    lines = [
      ...(direct ? [{ after: direct, label: 'Straight to the quarterfinals' }] : []),
      ...(playIn ? [{ after: playIn, label: elh ? 'Pre-playoff line' : 'Play-in line' }] : []),
      ...(safe && safe < size ? [{ after: safe, label: elh ? 'Relegation series' : 'Playout line' }] : []),
    ];
    subtitle = direct && playIn ? `Top ${direct} straight in · ${direct + 1}–${playIn} ${elh ? 'pre-playoff' : 'play in'}` : 'League table';
    legend = [
      { zone: 'in', label: 'Quarterfinals' }, { zone: 'bubble', label: elh ? 'Pre-playoff' : 'Play-in' },
      ...(safe && safe < size ? [{ zone: 'drop' as const, label: elh ? 'Relegation series' : 'Playout' }] : []),
    ];
  }
  const rows = [...teams].sort((a, b) => a.rank - b.rank).map((t): StandingsCardRow => {
    const pageId = t.pageId ?? `${id}-${String(t.teamId).toLowerCase()}`;
    return {
      id: pageId, name: opts.placeById.get(pageId) || t.name, abbr: t.abbr, logo: t.logoMain,
      gp: t.gp,
      // The league's own convention: wins, overtime wins, overtime losses, losses.
      record: `${t.w}-${t.otw}-${t.otl}-${t.l}`, pts: t.pts, form: payload.form?.[t.teamId],
      stats: { w: t.w, otw: t.otw, l: t.l, otl: t.otl, gf: t.gf, ga: t.ga, diff: t.diff },
    };
  });
  return [{
    key: id, title: EURO_TITLE[id] ?? leagueById(id).name, subtitle, railColor: EURO_RAIL[id] ?? opts.rail,
    recordFormat: 'W-OTW-OTL-L', recordLabel: 'W-OTW-OTL-L', recent: 'form', pointsPerGame: 3,
    rows, lines, zoneOf, statColumns: EURO_STAT_COLUMNS, legend,
  }];
}
