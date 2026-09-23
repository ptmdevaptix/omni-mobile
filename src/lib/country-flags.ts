// Country identifiers → flag emoji. Ported from omni-hockey lib/country-flags.ts; the two must not drift.
// Accepts ISO 3166-1 alpha-2 (the SHL sends "CZ") and alpha-3 (the NHL, Liiga and the Extraliga send
// "CZE"), full country names, and a hometown string whose last part is a province, state or country.

const FLAGS: Record<string, string> = {
  // ISO alpha-2
  US: '🇺🇸', CA: '🇨🇦', SE: '🇸🇪', FI: '🇫🇮', CZ: '🇨🇿', DE: '🇩🇪', RU: '🇷🇺', SK: '🇸🇰', CH: '🇨🇭', LV: '🇱🇻',
  DK: '🇩🇰', NO: '🇳🇴', AT: '🇦🇹', FR: '🇫🇷', GB: '🇬🇧', BY: '🇧🇾', SI: '🇸🇮', LT: '🇱🇹', KZ: '🇰🇿', UA: '🇺🇦',
  AU: '🇦🇺', JP: '🇯🇵', KR: '🇰🇷', NL: '🇳🇱', IT: '🇮🇹', PL: '🇵🇱', HU: '🇭🇺', HR: '🇭🇷', EE: '🇪🇪', IE: '🇮🇪',
  // ISO alpha-3
  USA: '🇺🇸', CAN: '🇨🇦', SWE: '🇸🇪', FIN: '🇫🇮', CZE: '🇨🇿', DEU: '🇩🇪', GER: '🇩🇪', RUS: '🇷🇺', SVK: '🇸🇰',
  CHE: '🇨🇭', SUI: '🇨🇭', LVA: '🇱🇻', LAT: '🇱🇻', DNK: '🇩🇰', DEN: '🇩🇰', NOR: '🇳🇴', AUT: '🇦🇹', FRA: '🇫🇷',
  GBR: '🇬🇧', BLR: '🇧🇾', SVN: '🇸🇮', LTU: '🇱🇹', KAZ: '🇰🇿', UKR: '🇺🇦', AUS: '🇦🇺', JPN: '🇯🇵', KOR: '🇰🇷',
  NLD: '🇳🇱', ITA: '🇮🇹', POL: '🇵🇱', HUN: '🇭🇺', HRV: '🇭🇷', EST: '🇪🇪', IRL: '🇮🇪',
  BGR: '🇧🇬', BUL: '🇧🇬', ROU: '🇷🇴', SRB: '🇷🇸', BEL: '🇧🇪',
};

const COUNTRY_NAMES: Record<string, string> = {
  canada: '🇨🇦', 'united states': '🇺🇸', usa: '🇺🇸', sweden: '🇸🇪', finland: '🇫🇮', czechia: '🇨🇿',
  'czech republic': '🇨🇿', germany: '🇩🇪', russia: '🇷🇺', slovakia: '🇸🇰', switzerland: '🇨🇭', latvia: '🇱🇻',
  denmark: '🇩🇰', norway: '🇳🇴', austria: '🇦🇹', france: '🇫🇷', belarus: '🇧🇾', slovenia: '🇸🇮', lithuania: '🇱🇹',
  kazakhstan: '🇰🇿', ukraine: '🇺🇦', australia: '🇦🇺', japan: '🇯🇵', 'south korea': '🇰🇷', netherlands: '🇳🇱',
  italy: '🇮🇹', poland: '🇵🇱', hungary: '🇭🇺', croatia: '🇭🇷', estonia: '🇪🇪', ireland: '🇮🇪', 'united kingdom': '🇬🇧',
};

// Province/state codes that imply a country (a hometown's last part).
const PROVINCE_COUNTRY: Record<string, string> = Object.fromEntries([
  ...['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'].map((p) => [p, '🇨🇦']),
  ...['AK', 'AL', 'AZ', 'CA', 'CO', 'CT', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MT',
      'NC', 'ND', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV']
    .map((s) => [s, '🇺🇸']),
]);

/**
 * The country a league belongs to, for the clubs we have no crest for. Mirrors lib/league-country.ts
 * on the web: only leagues whose clubs are all in ONE country — the NHL and the AHL span two, so a
 * flag would be wrong for them, and they are also the leagues whose crests we already have.
 */
const LEAGUE_COUNTRY: Record<string, string> = {
  SHL: 'SWE', HOCKEYALLSVENSKAN: 'SWE', ALLSVENSKAN: 'SWE', HOCKEYETTAN: 'SWE',
  LIIGA: 'FIN', MESTIS: 'FIN',
  KHL: 'RUS', VHL: 'RUS', MHL: 'RUS',
  DEL: 'DEU', DEL2: 'DEU',
  NL: 'CHE', SL: 'CHE', 'NATIONAL LEAGUE': 'CHE', 'SWISS LEAGUE': 'CHE',
  EXTRALIGA: 'CZE', ELH: 'CZE', CHANCE: 'CZE',
  TIPOS: 'SVK', ICEHL: 'AUT', METAL: 'DNK', EIHL: 'GBR',
};

/** ISO country code for a league, or undefined when it spans more than one. */
export function leagueCountry(league?: string | null): string | undefined {
  return LEAGUE_COUNTRY[(league ?? '').trim().toUpperCase()];
}

/** A flag for a country code or name, else from the hometown's last part ("Pickering, ON" → Canada). */
export function countryFlag(country?: string | null, birthplace?: string | null): string | undefined {
  if (country) {
    const upper = country.trim().toUpperCase();
    if (FLAGS[upper]) return FLAGS[upper];
    const lower = country.trim().toLowerCase();
    if (COUNTRY_NAMES[lower]) return COUNTRY_NAMES[lower];
  }
  if (birthplace) {
    const last = birthplace.split(',').map((s) => s.trim()).pop();
    if (last) {
      const upper = last.toUpperCase();
      if (PROVINCE_COUNTRY[upper]) return PROVINCE_COUNTRY[upper];
      const lower = last.toLowerCase();
      if (COUNTRY_NAMES[lower]) return COUNTRY_NAMES[lower];
      if (FLAGS[upper]) return FLAGS[upper];
    }
  }
  return undefined;
}


/**
 * A country's flag as two or three bands, for a league that has no crest of its own. Ported from the
 * web's league-country: a two-colour flag reads A-B-A so it still fills three bands, a three-colour
 * one reads A-B-C. Only the colours — the shapes differ and a band is honest about being a hint.
 */
const FLAG_COLORS: Record<string, string[]> = {
  SWE: ['#006AA7', '#FECC02'],
  FIN: ['#003580', '#FFFFFF'],
  NOR: ['#BA0C2F', '#FFFFFF', '#00205B'],
  DNK: ['#C8102E', '#FFFFFF'],
  ISL: ['#02529C', '#FFFFFF', '#DC1E35'],
  CZE: ['#11457E', '#FFFFFF', '#D7141A'],
  SVK: ['#0B4EA2', '#FFFFFF', '#EE1C25'],
  DEU: ['#000000', '#DD0000', '#FFCE00'],
  CHE: ['#DA291C', '#FFFFFF'],
  AUT: ['#ED2939', '#FFFFFF'],
  RUS: ['#0039A6', '#FFFFFF', '#D52B1E'],
  LVA: ['#9E3039', '#FFFFFF'],
  POL: ['#DC143C', '#FFFFFF'],
  HUN: ['#CE2939', '#FFFFFF', '#477050'],
  FRA: ['#0055A4', '#FFFFFF', '#EF4135'],
  GBR: ['#012169', '#FFFFFF', '#C8102E'],
  ITA: ['#008C45', '#FFFFFF', '#CD212A'],
  SVN: ['#005DA4', '#FFFFFF', '#ED1C24'],
  BLR: ['#C8313E', '#FFFFFF', '#4AA657'],
  UKR: ['#0057B7', '#FFD700'],
};

export function flagBadgeColors(code?: string | null): [string, string, string] | undefined {
  const c = FLAG_COLORS[(code ?? '').toUpperCase()];
  if (!c || c.length < 2) return undefined;
  return [c[0], c[1], c[2] ?? c[0]];
}
