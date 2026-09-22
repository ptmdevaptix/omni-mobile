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
