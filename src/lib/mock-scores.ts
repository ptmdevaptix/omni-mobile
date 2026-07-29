// TEMPORARY prototype data. The AHL/CHL/NCAA score feeds are empty in the offseason, so we synthesize a
// slate of same-league matchups to design against. Flip MOCK_SCORES_ENABLED to false (or delete this file
// + its two call sites in leagues.ts) once real active games are flowing.
import type { TeamDirectoryEntry } from './leagues';
import type { ScoreGame, ScoresResponse, ScoreTeam } from './types';

export const MOCK_SCORES_ENABLED = true;
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
