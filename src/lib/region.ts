// Coarse "where is this user" detection, used only to decide league display order (see
// HOME_LEAGUE_ORDER / orderedLeagues in ./leagues). Mirrors the web app's lib/region.ts so the two
// clients order leagues identically for the same person.
//
// Detection is best-effort and deliberately dependency-free:
//   • The device's locale region ("en-US" → US) is the strongest signal and reflects the user's own
//     Settings choice, so it wins when present.
//   • IANA timezone is the fallback. It separates the US from Canada cleanly, since Canada has its
//     own zone names — exactly the split this needs.
//   • A traveller or VPN user gets the "wrong" ordering, which is cosmetic.
//
// Adding expo-localization would give a first-class regionCode, but it's a native module — a rebuild
// for a cosmetic ordering hint isn't worth it while Intl already answers the question.

export type Region = 'US' | 'INTL';

// INTL is the pre-existing ordering, so anyone we can't place sees no reshuffle.
export const DEFAULT_REGION: Region = 'INTL';

// Canonical US zones. Multi-segment families (Indiana/Kentucky/North_Dakota) and the legacy "US/*"
// aliases are matched by prefix below rather than enumerated here.
const US_TIMEZONES = new Set([
  'America/New_York', 'America/Detroit', 'America/Chicago', 'America/Menominee',
  'America/Denver', 'America/Boise', 'America/Phoenix', 'America/Shiprock',
  'America/Los_Angeles', 'America/Anchorage', 'America/Juneau', 'America/Sitka',
  'America/Metlakatla', 'America/Yakutat', 'America/Nome', 'America/Adak',
  'Pacific/Honolulu', 'Navajo',
]);

const US_TIMEZONE_PREFIXES = ['US/', 'America/Indiana/', 'America/Kentucky/', 'America/North_Dakota/'];

export function regionForTimeZone(tz: string | undefined | null): Region {
  if (!tz) return DEFAULT_REGION;
  if (US_TIMEZONES.has(tz)) return 'US';
  if (US_TIMEZONE_PREFIXES.some((p) => tz.startsWith(p))) return 'US';
  return DEFAULT_REGION;
}

// "en-US" / "en_US" → "US". Returns null when the tag carries no region subtag ("en").
export function regionCodeFromLocale(locale: string | undefined | null): string | null {
  if (!locale) return null;
  const parts = locale.replace(/_/g, '-').split('-');
  const code = parts.find((p) => /^[A-Za-z]{2}$/.test(p) && p !== parts[0]);
  return code ? code.toUpperCase() : null;
}

let cached: Region | null = null;

// Device region, resolved once per launch. Locale first, timezone as backstop.
export function detectRegion(): Region {
  if (cached) return cached;
  let region: Region = DEFAULT_REGION;
  try {
    const opts = Intl.DateTimeFormat().resolvedOptions();
    const fromLocale = regionCodeFromLocale(opts.locale);
    region = fromLocale === 'US' ? 'US' : fromLocale ? DEFAULT_REGION : regionForTimeZone(opts.timeZone);
  } catch {
    // Intl unavailable — keep the default rather than guessing.
  }
  cached = region;
  return region;
}
