// How a club is NAMED, everywhere in the app. Mirrors lib/normalize.ts and components/team-card-row.tsx
// on the web; the two must not drift.
//
// A team's name is two fields — its place and its nickname — and the rule for which to show is:
//   NHL         → the nickname ("Islanders", "Avalanche")
//   every other → the place ("Hamilton", "Princeton", "Kelowna", "Örebro")
//   mini cards  → the abbreviation, every league (handled by the caller)
// A club whose nickname IS its place (HV71, USNTDP, "Örebro Hockey" filed as place "Örebro") shows
// the one name, never "HV71 HV71". A joined name is never split to recover either field: "Detroit
// Red Wings" and "San Jose Sharks" break at different words. Where only the joined name is known,
// it is shown whole.

const LETTER_FOLD: Record<string, string> = {
  ø: 'o', Ø: 'O', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE', ß: 'ss', ł: 'l', Ł: 'L', đ: 'd', Đ: 'D', ð: 'd', Ð: 'D', þ: 'th', Þ: 'TH', ı: 'i',
};

export function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[øØæÆœŒßłŁđĐðÐþÞı]/g, (c) => LETTER_FOLD[c] ?? c);
}

/** A club name as a lookup key: folded, lowercased, punctuation dropped, spaces collapsed. */
export function normTeamName(s?: string | null): string {
  return foldAccents(s ?? '').toLowerCase().replace(/[.'’]/g, '').replace(/\s+/g, ' ').trim();
}

/** A club's full name from its two fields — the ONLY way a full name is built. */
export function composeTeamName(place?: string | null, nickname?: string | null): string {
  const p = (place ?? '').trim(), n = (nickname ?? '').trim();
  if (!n) return p;
  if (!p) return n;
  const pk = normTeamName(p), nk = normTeamName(n);
  if (pk === nk || pk.includes(nk)) return p;
  return `${p} ${n}`;
}

export type NamedTeam = { location?: string | null; nickname?: string | null; name?: string | null; abbr?: string | null };

/**
 * The name a card or a table row shows for a club, by league. `name` (a joined full name) and the
 * abbreviation are fallbacks for a feed that gave neither field.
 */
export function teamDisplayName(team: NamedTeam, nhl: boolean): string {
  const place = (team.location ?? '').trim(), nick = (team.nickname ?? '').trim();
  const first = nhl ? nick || place : place || nick;
  return first || (team.name ?? '').trim() || (team.abbr ?? '').trim();
}


/**
 * What to call a club when the full name will not fit and the rule above cannot help.
 *
 * Keyed by the team's page id. These are editorial, not data: Wilkes-Barre/Scranton's place IS the
 * pair of cities in every feed and in our own registry, so there is nothing to derive a shorter one
 * from, and splitting a joined name is forbidden for good reason elsewhere. The full name is
 * untouched — this only decides what a narrow space falls back to.
 */
const SHORT_NAME_OVERRIDES: Record<string, string> = {
  'ahl-316': 'Wilkes-Barre',   // Wilkes-Barre/Scranton Penguins
};

/** The short name for a club: the override if it has one, else the rule. */
export function shortTeamName(teamId: string, team: NamedTeam, nhl: boolean): string {
  return SHORT_NAME_OVERRIDES[(teamId ?? '').toLowerCase()] ?? teamDisplayName(team, nhl);
}
