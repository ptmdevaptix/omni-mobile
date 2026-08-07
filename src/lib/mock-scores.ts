// TEMPORARY prototype data. The AHL/CHL/NCAA score feeds are empty in the offseason, so we synthesize a
// slate of same-league matchups to design against. Flip MOCK_SCORES_ENABLED to false (or delete this file
// + its two call sites in leagues.ts) once real active games are flowing.
import type { GameDetail, GDTeam, GoalInfo, PeriodScore, ScoringPeriod } from './game-detail-types';
import type { TeamDirectoryEntry } from './leagues';
import type { ScoreGame, ScoresResponse, ScoreTeam } from './types';

export const MOCK_SCORES_ENABLED = false;
export const MOCKABLE_LEAGUES = ['AHL', 'OHL', 'WHL', 'QMJHL', 'NCAA'];

export function isMockableLeague(label: string): boolean {
  return MOCK_SCORES_ENABLED && MOCKABLE_LEAGUES.includes(label);
}

// Derive nickname/place from a "Place Nickname" (or "School Mascot") full name. Naive last-word split —
// good enough for a prototype; two-word mascots (e.g. "Sun Devils") land slightly off.
function nickOf(name: string): string { const p = name.trim().split(/\s+/); return p.length > 1 ? p[p.length - 1] : name; }
function placeOf(name: string): string { const p = name.trim().split(/\s+/); return p.length > 1 ? p.slice(0, -1).join(' ') : name; }

function toScoreTeam(t: TeamDirectoryEntry): ScoreTeam {
  return { name: t.name, abbr: t.abbr, logo: t.logo, nickname: nickOf(t.name), location: placeOf(t.name) };
}

// Build ~8-10 deterministic same-league games (mix of FINAL / UPCOMING / LIVE) from the team directory.
export function buildMockScores(leagueLabel: string, allTeams: TeamDirectoryEntry[]): ScoresResponse {
  const pool = allTeams.filter((t) => t.league === leagueLabel);
  const teamsById: Record<string, ScoreTeam> = {};
  const games: ScoreGame[] = [];
  const count = Math.min(10, Math.floor(pool.length / 2));

  for (let i = 0; i < count; i++) {
    const away = pool[i * 2];
    const home = pool[i * 2 + 1];
    if (!away || !home) break;
    teamsById[away.id] = toScoreTeam(away);
    teamsById[home.id] = toScoreTeam(home);

    const mode = i % 3; // 0 FINAL, 1 UPCOMING, 2 LIVE
    const status = mode === 0 ? 'FINAL' : mode === 1 ? 'UPCOMING' : 'LIVE';
    const played = status !== 'UPCOMING';
    games.push({
      id: `mock-${leagueLabel.toLowerCase()}-${i}`,
      top: leagueLabel,
      awayTeamId: away.id,
      homeTeamId: home.id,
      status,
      statusLabel: status === 'FINAL' ? 'Final' : status === 'LIVE' ? '2nd · 08:14' : '7:00 PM',
      awayScore: played ? 1 + ((i * 3) % 5) : undefined,
      homeScore: played ? 2 + ((i * 2) % 4) : undefined,
    });
  }
  return { games, teamsById };
}

// --- Sample game DETAIL (temporary) ------------------------------------------
// A mock game id encodes its state by index parity (i%3: 0 FINAL, 1 UPCOMING, 2 LIVE), matching the card.
// Uses the same team pairing as buildMockScores so the detail matches the card; players are fake.
const FAKE_NAMES = [
  'A. Novak', 'R. Bergeron', 'T. Lindholm', 'J. Okafor', 'M. Suzuki', 'D. Petrov', 'C. Whitfield', 'L. Marchetti',
  'S. Dubois', 'K. Halonen', 'E. Rinaldi', 'B. Chen', 'P. Andersson', 'N. Volkov', 'G. Moreau', 'F. Kaskinen',
];
const fakeName = (seed: number) => FAKE_NAMES[Math.abs(Math.round(seed)) % FAKE_NAMES.length];

// Deterministic fake W-L-OTL so the sample scoreboard shows a plausible record (no real one this season).
function fakeRecord(name: string): string {
  let s = 0;
  for (let k = 0; k < name.length; k++) s += name.charCodeAt(k);
  return `${18 + (s % 22)}-${8 + (s % 16)}-${s % 6}`;
}
function gdTeam(entry: TeamDirectoryEntry, score?: number): GDTeam {
  return { name: placeOf(entry.name), nickname: nickOf(entry.name), abbr: entry.abbr, logo: entry.logo, score, record: fakeRecord(entry.name) };
}

function genScoring(awayAbbr: string, homeAbbr: string, aTot: number, hTot: number, maxPeriod: number, seed: number, isLive: boolean) {
  const seq: ('A' | 'H')[] = [];
  let ai = 0, hi = 0;
  const total = aTot + hTot;
  for (let k = 0; k < total; k++) { const away = hi >= hTot || (ai < aTot && k % 2 === 0); seq.push(away ? 'A' : 'H'); away ? ai++ : hi++; }

  const labels = ['1st Period', '2nd Period', '3rd Period'];
  const buckets: GoalInfo[][] = [[], [], []];
  const ps = Array.from({ length: maxPeriod }, () => ({ a: 0, h: 0 }));
  let a = 0, h = 0;
  seq.forEach((s, k) => {
    if (s === 'A') a++; else h++;
    const p = total ? Math.min(maxPeriod - 1, Math.floor((k / total) * maxPeriod)) : 0;
    const min = 3 + ((k * 4 + seed) % 15);
    const sec = 7 + ((k * 13) % 50);
    buckets[p].push({
      time: `${min}:${String(sec).padStart(2, '0')}`,
      teamAbbr: s === 'A' ? awayAbbr : homeAbbr,
      scorer: fakeName(seed * 3 + k),
      goalType: k % 5 === 0 ? 'PP' : undefined,
      assists: k % 3 === 0 ? [{ name: fakeName(seed * 5 + k + 1) }] : [{ name: fakeName(seed * 5 + k + 1) }, { name: fakeName(seed * 7 + k + 2) }],
      awayScore: a, homeScore: h,
    });
    if (s === 'A') ps[p].a++; else ps[p].h++;
  });

  const periods: ScoringPeriod[] = [];
  for (let p = 0; p < maxPeriod; p++) periods.push({ label: labels[p], goals: buckets[p] });
  const periodScores: PeriodScore[] = [];
  for (let p = 0; p < maxPeriod; p++) periodScores.push({ label: String(p + 1), away: ps[p].a, home: ps[p].h });
  if (isLive) periodScores.push({ label: '3', away: null, home: null });
  return { periods, periodScores };
}

export function buildMockGameDetail(gameId: string, allTeams: TeamDirectoryEntry[]): GameDetail | null {
  const m = /^mock-([a-z]+)-(\d+)$/.exec(gameId);
  if (!m) return null;
  const league = m[1].toUpperCase();
  const i = parseInt(m[2], 10);
  const pool = allTeams.filter((tm) => tm.league === league);
  const a = pool[i * 2];
  const h = pool[i * 2 + 1];
  if (!a || !h) return null;

  const mode = i % 3;
  const aTot = 1 + ((i * 3) % 5);
  const hTot = 2 + ((i * 2) % 4);
  const venue = `${placeOf(h.name)} Arena`;

  if (mode === 1) {
    return {
      league, status: 'UPCOMING', statusLabel: '7:00 PM ET', venue, venueLocation: placeOf(h.name), network: 'Sample TV',
      awayTeam: gdTeam(a), homeTeam: gdTeam(h), scoring: [], penalties: [],
      preview: `The ${nickOf(a.name)} visit the ${nickOf(h.name)} tonight. ${nickOf(h.name)} look to protect home ice, while the ${nickOf(a.name)} aim to keep their road momentum going. Key matchup up front and a goaltending duel expected. (Sample preview.)`,
    };
  }

  const isLive = mode === 2;
  const { periods, periodScores } = genScoring(a.abbr, h.abbr, aTot, hTot, isLive ? 2 : 3, i + 1, isLive);
  return {
    league, status: isLive ? 'LIVE' : 'FINAL', statusLabel: isLive ? '2nd · 08:14' : 'Final',
    venue, venueLocation: placeOf(h.name), network: 'Sample TV',
    awayTeam: gdTeam(a, aTot), homeTeam: gdTeam(h, hTot), periodScores, scoring: periods,
    penalties: [
      { label: '1st Period', penalties: [
        { time: '05:12', teamAbbr: a.abbr, player: fakeName(i + 1), description: 'Tripping', duration: 2 },
        { time: '14:03', teamAbbr: h.abbr, player: fakeName(i + 2), description: 'Hooking', duration: 2 },
      ] },
      { label: '2nd Period', penalties: [
        { time: '11:47', teamAbbr: a.abbr, player: fakeName(i + 3), description: 'Slashing', duration: 2 },
      ] },
    ],
    threeStars: isLive ? undefined : [
      { star: 1, name: fakeName(i), teamAbbr: hTot >= aTot ? h.abbr : a.abbr, goals: 2, assists: 1, points: 3 },
      { star: 2, name: fakeName(i + 4), teamAbbr: a.abbr, goals: 1, assists: 1, points: 2 },
      { star: 3, name: fakeName(i + 8), teamAbbr: h.abbr, goals: 0, assists: 2, points: 2 },
    ],
  };
}
