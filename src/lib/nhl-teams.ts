// Static NHL team name map, keyed by the 3-letter abbreviation the API uses. The standings/scores feeds
// only carry the full "Place Nickname" string, so this lets us show just the place or nickname where a
// compact label reads better. Fall back to the full name if an abbr isn't found (e.g. relocation/rebrand).
export const NHL_TEAM_NAMES: Record<string, { place: string; nickname: string }> = {
  ANA: { place: 'Anaheim', nickname: 'Ducks' },
  BOS: { place: 'Boston', nickname: 'Bruins' },
  BUF: { place: 'Buffalo', nickname: 'Sabres' },
  CGY: { place: 'Calgary', nickname: 'Flames' },
  CAR: { place: 'Carolina', nickname: 'Hurricanes' },
  CHI: { place: 'Chicago', nickname: 'Blackhawks' },
  COL: { place: 'Colorado', nickname: 'Avalanche' },
  CBJ: { place: 'Columbus', nickname: 'Blue Jackets' },
  DAL: { place: 'Dallas', nickname: 'Stars' },
  DET: { place: 'Detroit', nickname: 'Red Wings' },
  EDM: { place: 'Edmonton', nickname: 'Oilers' },
  FLA: { place: 'Florida', nickname: 'Panthers' },
  LAK: { place: 'Los Angeles', nickname: 'Kings' },
  MIN: { place: 'Minnesota', nickname: 'Wild' },
  MTL: { place: 'Montréal', nickname: 'Canadiens' },
  NSH: { place: 'Nashville', nickname: 'Predators' },
  NJD: { place: 'New Jersey', nickname: 'Devils' },
  NYI: { place: 'New York', nickname: 'Islanders' },
  NYR: { place: 'New York', nickname: 'Rangers' },
  OTT: { place: 'Ottawa', nickname: 'Senators' },
  PHI: { place: 'Philadelphia', nickname: 'Flyers' },
  PIT: { place: 'Pittsburgh', nickname: 'Penguins' },
  SJS: { place: 'San Jose', nickname: 'Sharks' },
  SEA: { place: 'Seattle', nickname: 'Kraken' },
  STL: { place: 'St. Louis', nickname: 'Blues' },
  TBL: { place: 'Tampa Bay', nickname: 'Lightning' },
  TOR: { place: 'Toronto', nickname: 'Maple Leafs' },
  UTA: { place: 'Utah', nickname: 'Mammoth' },
  VAN: { place: 'Vancouver', nickname: 'Canucks' },
  VGK: { place: 'Vegas', nickname: 'Golden Knights' },
  WSH: { place: 'Washington', nickname: 'Capitals' },
  WPG: { place: 'Winnipeg', nickname: 'Jets' },
};

export function nhlNickname(abbr: string, fallback: string): string {
  return NHL_TEAM_NAMES[abbr?.toUpperCase()]?.nickname ?? fallback;
}
