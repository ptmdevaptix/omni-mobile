import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlayerContract, ContractSeason } from '@/lib/player-types';
import { useTheme } from '@/lib/theme';

/** "26-27" from a season START year. */
const seasonLabel = (startYear: number) =>
  `${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;

/**
 * The season now under way. The NHL league year flips on July 1.
 *
 * Computed here rather than read off the contract: `yearsRemaining` was fixed when the crawl stored
 * the row, and those rows are served from cache for a week at a time, so a strip built from it keeps
 * drawing last season's first box. Anchoring on today and ending on `expiryYear` self-corrects.
 */
function currentSeasonStartYear(now = new Date()): number {
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

/**
 * Cap hit carrying its own units: 12500000 → "$12.5M", 9150000 → "$9.15M", 775000 → "$775K".
 *
 * Currency and scale ride on the number rather than sitting in a caption, so a box read on its own
 * says what it is. Trailing zeros are trimmed ("$8M", not "$8.00M").
 */
function aavLabel(capHit: number): string {
  if (capHit < 1_000_000) return `$${Math.round(capHit / 1000)}K`;
  const m = capHit / 1_000_000;
  return `$${(m >= 10 ? m.toFixed(1) : m.toFixed(2)).replace(/\.?0+$/, '')}M`;
}

type Cell = { season: string; value: string; clause?: string; expiry?: true };

/**
 * How protected a season is, as the box's own fill. Four tiers, because that is how many distinct
 * answers the question has:
 *
 *   solid green      no clause — the player can be traded anywhere
 *   green stripes    M-NTC, a modified no-trade: he can block SOME destinations, which is protection
 *                    with a hole in it, so the fill has one too
 *   orange stripes   a full NTC, or a modified NMC — no ordinary trade, but not untouchable
 *   solid orange     NMC, a full no-movement clause: no trade, no waivers, no minors
 *
 * Green to orange carries the direction and the stripe carries "partial", so the two dimensions read
 * independently rather than as four unrelated colours to memorise.
 *
 * Matching is on whole tokens, not substrings. cap-space writes the cell as a comma-separated list
 * and every one of these strings contains another: "M-NMC" contains "NMC", "M-NTC" contains "NTC",
 * and Draisaitl's cell reads "NMC, M-NTC". A `.includes('NTC')` test calls all of them a no-trade.
 * The strongest token present wins — a season carrying both is in practice an NMC season.
 *
 * Vocabulary confirmed against 50 players: "", "M-NTC", "NMC", "NTC", "M-NMC", "NMC, M-NTC".
 */
type ClauseTier = 'clear' | 'm-ntc' | 'ntc' | 'nmc';

const tokensOf = (clause?: string) =>
  (clause ?? '').toUpperCase().split(',').map((t) => t.trim()).filter(Boolean);

function clauseTier(clause: string | undefined): ClauseTier {
  const tokens = tokensOf(clause);
  if (tokens.includes('NMC')) return 'nmc';
  if (tokens.includes('M-NMC') || tokens.includes('NTC')) return 'ntc';
  if (tokens.includes('M-NTC')) return 'm-ntc';
  return 'clear';
}

/**
 * What the hint says, built from the ACTUAL tokens rather than from the colour tier.
 *
 * The tier deliberately groups a full NTC with a modified NMC — they answer "can he be moved" the
 * same way. The words must not follow it there: Oettinger's last two seasons are M-NMC, and calling
 * them "No-trade clause" states the wrong clause about a real contract.
 */
const CLAUSE_WORDS: Record<string, string> = {
  NMC: 'No-movement clause — cannot be traded, waived or sent down',
  'M-NMC': 'Modified no-movement clause — partial protection from trade, waivers and demotion',
  NTC: 'No-trade clause — cannot be traded',
  'M-NTC': 'Modified no-trade clause — can block some destinations',
};

function clauseDescription(clause: string | undefined): string {
  const tokens = tokensOf(clause);
  const known = tokens.map((t) => CLAUSE_WORDS[t]).filter(Boolean);
  if (!known.length) return tokens.length ? tokens.join(', ') : 'No trade protection';
  // Draisaitl carries "NMC, M-NTC" on one season. Both are true of him, so both are said.
  return known.join(' · ');
}

// The same two hues the web uses (--clause-clear / --clause-locked), lightened for dark mode the
// same way, so a green box means the same thing on a phone as on the site.
const clauseHue = (tier: ClauseTier, dark: boolean) =>
  tier === 'clear' || tier === 'm-ntc'
    ? (dark ? [142, 58, 46] : [142, 62, 36])
    : (dark ? [26, 92, 56] : [26, 90, 45]);

const hsla = ([h, s, l]: number[], a: number) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

// One box, matching the row gap below.
const BOX = 60;
const GAP = 4;

/**
 * How many boxes to a row, given the width the strip actually has.
 *
 * Once a break IS needed the rows are BALANCED, which costs nothing: the row count is already fixed
 * by `fit`, so spreading evenly over those same rows never adds one. Ten boxes with room for eight
 * go 5/5 rather than 8/2, which would strand the expiry box beside one other and read as a separate
 * thing.
 */
function boxesPerRow(total: number, fit: number): number {
  const rows = Math.ceil(total / Math.max(1, Math.min(fit, total)));
  return Math.ceil(total / rows);
}

/**
 * Has this deal already finished? The caller must tell two silences apart: a contract we could not
 * DRAW (signed, but no figures published) still reads as a contract, while one whose last season has
 * been played reads as a status.
 */
export function contractPlayedOut(contract: PlayerContract): boolean {
  return contract.expiryYear != null && contract.expiryYear <= currentSeasonStartYear();
}

/** Age on September 15 of the season under way — the date the CBA measures this against. */
function ageOnSept15(birthDate: string, startYear = currentSeasonStartYear()): number | null {
  const b = new Date(`${birthDate}T12:00:00`);
  if (isNaN(b.getTime())) return null;
  const ref = new Date(Date.UTC(startYear, 8, 15));
  let age = ref.getUTCFullYear() - b.getUTCFullYear();
  const m = ref.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

/**
 * The games figure the slide test compares against: the most a player has played in ANY ONE season,
 * counting the regular season and the playoffs together.
 *
 * Per season, not per career, because that is the rule. A term slides when the player does not reach
 * ten games in a season, so 8 then 7 then 2 slides three times — a career total would call that 17
 * and say the contract had started. It is the largest single season that decides: once he reaches ten
 * in one, the first year of the deal is burned and nothing can slide it afterwards.
 *
 * Playoffs count. Porter Martone played nine regular-season games and ten in the playoffs, which is
 * nineteen by the rule that matters and the reason `careerTotals` — regular season only — was the
 * wrong source.
 *
 * Undefined when we hold no season history at all, which is not the same as zero: a player we have
 * never seen play gets no claim made about him, while an empty history IS zero, because we looked.
 */
export function nhlGamesForSlide(
  seasonTotals?: { season: number; leagueAbbrev: string; gameType: number; gamesPlayed?: number }[],
): number | undefined {
  if (!seasonTotals) return undefined;
  const bySeason = new Map<number, number>();
  for (const r of seasonTotals) {
    if (r.leagueAbbrev !== 'NHL' || (r.gameType !== 2 && r.gameType !== 3)) continue;
    bySeason.set(r.season, (bySeason.get(r.season) ?? 0) + (r.gamesPlayed ?? 0));
  }
  return bySeason.size ? Math.max(...bySeason.values()) : 0;
}

/**
 * Can this entry-level deal still slide?
 *
 * Sliding is not a property of ELCs in general. It applies to a player of 18 or 19 who does not reach
 * TEN NHL games: his whole term shifts forward a year. Matthew Schaefer is on an entry-level contract
 * at 19 with 82 games behind him, so telling a reader his dates might move is simply false.
 *
 * Both conditions are required, and both must be KNOWN — without a birth date or a games figure the
 * card says nothing beyond "entry level". A claim about dates moving is worth making only when we can
 * stand behind it.
 *
 * Ten games means ten in a SINGLE season, playoffs included — see nhlGamesForSlide.
 *
 * The age test is the one that eventually ends it for everyone: a player who is 20 on September 15
 * has his entry-level deal start that year whether he has played a game or not.
 */
export function canSlide(contract: PlayerContract, nhlGamesPlayed?: number, birthDate?: string): boolean {
  if (!contract.entryLevel || !birthDate || nhlGamesPlayed == null) return false;
  const age = ageOnSept15(birthDate);
  return age != null && age < 20 && nhlGamesPlayed < 10;
}

/**
 * The boxes the strip would draw, or null when there is nothing to draw — a pending free agent with
 * no term, or a deal whose last season has already been played.
 */
export function contractTimeline(contract: PlayerContract): { cells: Cell[] } | null {
  const { expiryYear, capHit, capHitLabel, expiryStatus, seasons } = contract;
  if (contract.status !== 'signed' || expiryYear == null) return null;

  const start = currentSeasonStartYear();

  /**
   * One box per season, at THAT season's cap hit.
   *
   * A commitment is not one number repeated. Makar is on $9M through 2026-27 and $20.4M for the
   * eight years after that — two deals, both signed, and drawing the extension's figure across the
   * whole strip said he earns $20.4M today, a year before it starts.
   *
   * The fallback covers a row stored before the per-season parse existed: one cap hit repeated to
   * the expiry, which is exactly the old behaviour, and corrects itself when the crawl re-reads him.
   */
  const upcoming: ContractSeason[] = seasons?.length
    ? seasons.filter((s) => s.startYear >= start && s.startYear < expiryYear)
    : Array.from({ length: Math.min(Math.max(expiryYear - start, 0), 10) }, (_, i) => ({
        startYear: start + i,
        capHit: capHit ?? 0,
      }));
  if (upcoming.length === 0) return null;
  /**
   * No money anywhere means there is nothing to draw. A handful of cap-space pages carry a current
   * contract with no season table at all — Alex Nylander's is one — so we know he is signed for two
   * more years and know no figure. A strip of boxes reading "—" says less than a sentence does and
   * looks like a rendering fault; the caller falls back to the text summary.
   */
  if (!upcoming.some((s) => s.capHit) && capHit == null) return null;

  const cells: Cell[] = upcoming.map((s) => ({
    season: seasonLabel(s.startYear),
    value: s.capHit ? aavLabel(s.capHit) : capHitLabel ?? '—',
    clause: s.clause,
  }));
  cells.push({ season: seasonLabel(expiryYear), value: expiryStatus ?? 'FA', expiry: true });

  return { cells };
}

/**
 * One season's box.
 *
 * Nothing marks the CURRENT season, deliberately: the first box IS this season and the label above
 * it says which, so an outline there only crowded that label. The fill is left free to carry the one
 * thing no other part of the box can say.
 */
function SeasonBox({ cell, onPress }: { cell: Cell; onPress?: () => void }) {
  const t = useTheme();
  const dark = t.mode === 'dark';

  if (cell.expiry) {
    const accent = dark ? 'rgba(232,187,70,' : 'rgba(32,138,239,';
    return (
      <View style={[styles.box, { backgroundColor: `${accent}0.15)`, borderColor: `${accent}0.4)` }]}>
        <Text style={[styles.value, { color: t.accent }]} numberOfLines={1} adjustsFontSizeToFit>{cell.value}</Text>
      </View>
    );
  }

  const tier = clauseTier(cell.clause);
  const hue = clauseHue(tier, dark);
  const border = { borderColor: hsla(hue, tier === 'clear' ? 0.45 : tier === 'nmc' ? 0.65 : 0.55) };
  const label = clauseDescription(cell.clause);
  const solid = tier === 'clear' || tier === 'nmc';

  const face = solid ? (
    <View style={[styles.box, border, { backgroundColor: hsla(hue, tier === 'clear' ? 0.2 : 0.38) }]}>
      <Text style={[styles.value, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit>{cell.value}</Text>
    </View>
  ) : (
    /**
     * Diagonal banding for the MODIFIED tiers, drawn as a gradient with hard stops because React
     * Native has no repeating-linear-gradient and the app carries no SVG renderer. Corner to corner
     * gives the diagonal; doubled stops make each colour change a line rather than a fade.
     */
    <LinearGradient
      colors={STRIPE_STOPS.map((_, i) => hsla(hue, i % 2 === 0 ? 0.4 : 0.13)) as unknown as readonly [string, string, ...string[]]}
      locations={STRIPE_STOPS as unknown as readonly [number, number, ...number[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.box, border]}
    >
      <Text style={[styles.value, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit>{cell.value}</Text>
    </LinearGradient>
  );

  // The web explains a fill on hover. A phone has no hover, so the box is a button that says it
  // instead — and the same sentence is what VoiceOver reads, which the tooltip never managed.
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${cell.season}, ${cell.value}. ${label}`}>
      {face}
    </Pressable>
  );
}

// Six bands across the box: doubled locations so each step is a hard edge, not a gradient.
const STRIPE_STOPS = [0, 0.166, 0.166, 0.333, 0.333, 0.5, 0.5, 0.666, 0.666, 0.833, 0.833, 1];

/**
 * A contract as a row of seasons rather than a sentence.
 *
 * "$9.15M/yr · 4 yrs · UFA '30" makes the reader do the arithmetic to answer the question they
 * actually have — which summers this player is committed for, what he costs in each, and when he
 * hits the market. One box per season answers it by shape, and the closing box in the accent colour
 * is the summer he is available.
 */
export function ContractTimeline({ contract }: { contract: PlayerContract }) {
  const t = useTheme();
  const timeline = contractTimeline(contract);
  // Measured, not assumed: the strip is as wide as the card it lands in, and that differs between a
  // phone and an iPad. Until the first layout pass it lays out five wide, which is the narrow case.
  const [fit, setFit] = useState<number | null>(null);
  const [explained, setExplained] = useState<string | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w) setFit(Math.max(1, Math.floor((w + GAP) / (BOX + GAP))));
  };

  if (!timeline) return null;
  const { cells } = timeline;
  const perRow = boxesPerRow(cells.length, fit ?? 5);
  // Fixed-width boxes, not fractions of the row: McDavid's two years stretched across a whole card
  // read as a longer commitment than they are. As wide as the deal is long, and a box means the same
  // thing on every player's page.
  const rowWidth = perRow * BOX + (perRow - 1) * GAP;

  return (
    <View onLayout={onLayout}>
      <View style={[styles.grid, { width: rowWidth }]}>
        {cells.map((c) => (
          <View key={c.season} style={{ width: BOX }}>
            {/* Same type as a field label beside it — 10px, the same muted colour, the same
                letter-spacing — so the season headings line up with the bio labels rather than
                reading as a different, smaller kind of label. */}
            <Text style={[styles.season, { color: t.sub }]} numberOfLines={1}>{c.season}</Text>
            <SeasonBox cell={c} onPress={() => setExplained((cur) => (cur === c.season ? null : clauseDescription(c.clause)))} />
          </View>
        ))}
      </View>
      {explained ? <Text style={[styles.explain, { color: t.sub }]}>{explained}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  season: { fontSize: 10, letterSpacing: 0.3, textAlign: 'center', marginBottom: 2, fontVariant: ['tabular-nums'] },
  box: { borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 5, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  explain: { fontSize: 11, marginTop: 6, lineHeight: 15 },
});
