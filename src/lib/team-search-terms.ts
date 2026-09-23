import { foldAccents } from './team-name';

/**
 * What a team can be found by, beyond its displayed name.
 *
 * Three sources, in increasing order of effort:
 *
 *   1. The team ID. It is already in the data and already carries the long form of many names —
 *      `ncaa-rensselaer` is RPI, `ncaa-rochester-inst` is RIT, `ncaa-massachusetts` is UMass,
 *      `ncaa-minn-st-mankato` is Minnesota State. Matching it costs nothing and fixed most of the
 *      cases that prompted this.
 *
 *   2. Expanded abbreviations. The stored names abbreviate — "Penn St. Nittany Lions",
 *      "Western Mich. Broncos", "Boston Univ. Terriers" — so "penn state", "western michigan" and
 *      "boston university" matched nothing. This is systematic, not per-team, and a list of
 *      thirty hand-written aliases would have been the wrong shape for it.
 *
 *   3. A curated alias list, for what neither of those can reach: a nickname nobody writes down
 *      ("habs"), or a name with no textual relationship to the stored one ("connecticut" for UConn).
 */

/**
 * Abbreviations as they appear in team names, and what they may stand for.
 *
 * "St." is deliberately mapped to BOTH — it is Saint in "St. Cloud" and State in "Penn St.", and
 * both appear in one name ("St. Cloud St. Huskies"). Rather than decide by position, every
 * expansion is generated and the query is matched against all of them, so both readings work.
 */
const EXPANSIONS: Record<string, string[]> = {
  "st.": ["state", "saint"],
  st: ["state", "saint"],
  "mich.": ["michigan"],
  "minn.": ["minnesota"],
  "univ.": ["university"],
  "col.": ["college"],
  "int'l": ["international"],
};

/**
 * Names that no amount of expansion reaches. Keyed by team id, values are extra search terms.
 *
 * Deliberately short. Everything derivable is derived above; this is only for the cases where the
 * two names genuinely share no text.
 */
const ALIASES: Record<string, string[]> = {
  // NCAA — the school's name against the athletic brand.
  "ncaa-uconn": ["connecticut"],
  "ncaa-neb-omaha": ["nebraska omaha", "nebraska"],
  "ncaa-miami-oh": ["miami ohio"],
  "ncaa-rensselaer": ["rensselaer polytechnic"],
  "ncaa-rochester-inst": ["rochester institute of technology"],
  "ncaa-st-thomas-mn": ["saint thomas"],
  "ncaa-massachusetts": ["umass amherst"],
  "ncaa-arizona-st": ["arizona state sun devils"],
  "ncaa-army": ["west point"],
  "ncaa-brown": ["brown university"],
  // NHL — nicknames a fan types and no feed records.
  mtl: ["habs", "canadiens de montreal"],
  tbl: ["bolts"],
  njd: ["devils"],
  cbj: ["jackets"],
  vgk: ["knights"],
  tor: ["leafs"],
  nyr: ["broadway blueshirts"],
  wpg: ["jets"],
};

const clean = (s: string) => foldAccents(s).toLowerCase();

/**
 * The single normalisation both sides go through.
 *
 * Both sides is the point: the haystack kept its periods while the query had them stripped, so
 * "st cloud state" failed to match the variant "st. cloud state" that had been generated for it.
 * A term and a query that are normalised differently will always disagree somewhere.
 */
const fold = (s: string) =>
  clean(s).replace(/[.()'’]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Every string this team should be findable by, as one lowercase haystack.
 *
 * Joined rather than returned as a list because the caller only ever asks "does the query appear
 * anywhere" — and a single `includes` over one string beats a loop over eight.
 */
export function teamSearchTerms(team: { id: string; name: string; abbr: string }): string {
  const parts = new Set<string>();
  const add = (s: string) => { const c = fold(s); if (c) parts.add(c); };

  add(team.name);
  add(team.abbr);
  add(team.id.replace(/-/g, " "));

  /**
   * Every reading of the abbreviations, expanded per POSITION rather than per word.
   *
   * "St. Cloud St. Huskies" is Saint Cloud State: the two "St."s mean different things in one name.
   * Expanding all occurrences together only ever produced "state cloud state" and "saint cloud
   * saint", so the one reading a person would type was the one not generated.
   */
  const words = clean(team.name).replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
  let variants: string[][] = [[]];
  for (const w of words) {
    const options = EXPANSIONS[w] ? [w, ...EXPANSIONS[w]] : [w];
    // Cap the fan-out. Three abbreviations in one name would be 27 readings for no extra recall;
    // no team name in any of these leagues has more than two.
    variants = variants.length * options.length > 24
      ? variants.map((v) => [...v, options[0]])
      : variants.flatMap((v) => options.map((o) => [...v, o]));
  }
  for (const v of variants) add(v.join(" "));

  for (const a of ALIASES[team.id] ?? []) add(a);
  return [...parts].join(" | ");
}

/** Does this team match the query? Case- and accent-insensitive, punctuation-tolerant. */
export function teamMatches(team: { id: string; name: string; abbr: string }, query: string): boolean {
  const q = fold(query);
  if (!q) return false;
  return teamSearchTerms(team).includes(q);
}
