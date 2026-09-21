import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { canSlide, ContractTimeline, contractPlayedOut, contractTimeline, nhlGamesForSlide } from '@/components/contract-timeline';
import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { useFavorites } from '@/lib/favorites';
import { fetchPlayer, seasonLabel } from '@/lib/player';
import type { PlayerContract, PlayerDetail, PlayerSeasonStatRow, PlayerStatLine } from '@/lib/player-types';
import { useTheme } from '@/lib/theme';

export default function PlayerScreen() {
  const t = useTheme();
  const { playerId } = useLocalSearchParams<{ playerId: string }>();
  const q = useQuery({ queryKey: ['player', playerId], queryFn: () => fetchPlayer(playerId) });
  const p = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: p?.fullName || 'Player' }} />
      {q.isLoading ? (
        <StateView kind="loading" />
      ) : q.isError || !p || p.error || !p.fullName ? (
        <StateView kind="empty" title="Player unavailable" message="Full player pages are available for NHL players for now." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28, gap: 12 }}>
          <Hero p={p} />
          {p.currentSeason ? <SeasonCard title="Current Season" line={p.currentSeason} goalie={p.isGoalie} /> : null}
          <BioCard p={p} />
          <ContractCard p={p} />
          <CareerSection rows={p.seasonTotals ?? []} goalie={p.isGoalie} primaryLeague={(p.league ?? '').toUpperCase()} totals={p.careerTotals} />
        </ScrollView>
      )}
    </View>
  );
}

function Hero({ p }: { p: PlayerDetail }) {
  const t = useTheme();
  const { isFavoritePlayer, togglePlayer } = useFavorites();
  const on = isFavoritePlayer(p.id);
  const teamId = p.teamHref?.startsWith('/teams/') ? p.teamHref.slice('/teams/'.length) : undefined;
  return (
    <View style={styles.hero}>
      {p.headshot ? <Image source={{ uri: p.headshot }} style={styles.headshot} contentFit="cover" /> : <View style={[styles.headshot, { backgroundColor: t.card }]} />}
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }} numberOfLines={1}>{p.fullName}</Text>
        {/* Number, position and the physicals as ONE line.
            Height, weight and handedness are two or three characters each; as three labelled rows in
            the card below they spent a full width apiece saying very little — "R" on its own beside
            "Shoots" reads as a rendering fault rather than a fact. They belong with the number and
            the position, which is the line a reader takes in as one anyway.
            Two lines allowed: it fits on one phone-width line for most players, and a long club or a
            goalie's "Catches" wraps rather than truncating — a clipped "Shoo…" would be worse than a
            second line. Built from what is known, so a junior with no listed weight gets no gap. */}
        <Text style={{ color: t.sub, fontSize: 14, marginTop: 2, lineHeight: 19 }} numberOfLines={2}>
          {[
            p.number != null ? `#${p.number}` : null,
            p.position,
            p.height || null,
            p.weight != null ? `${p.weight} lb` : null,
            p.shootsCatches ? `${p.isGoalie ? 'Catches' : 'Shoots'}: ${p.shootsCatches}` : null,
          ].filter(Boolean).join(' · ')}
        </Text>
        {/* The club he PLAYS for. `teamHref` rather than a path built from the abbreviation: the
            Marlies' abbreviation is TOR, and /teams/tor is the Maple Leafs. A club we do not carry —
            an SHL side, say — is named without a link rather than pointed at a page that isn't. */}
        {p.teamName ? (
          teamId ? (
            <Link href={{ pathname: '/teams/[teamId]', params: { teamId } }} asChild>
              <Pressable style={styles.clubRow}>
                <TeamLogo uri={p.teamLogo} size={20} />
                <Text style={{ color: t.accent, fontSize: 14, fontWeight: '600' }}>{p.teamName}</Text>
              </Pressable>
            </Link>
          ) : (
            <View style={styles.clubRow}>
              <TeamLogo uri={p.teamLogo} size={20} />
              <Text style={{ color: t.sub, fontSize: 14, fontWeight: '600' }}>{p.teamName}</Text>
            </View>
          )
        ) : null}
      </View>
      <Pressable onPress={() => togglePlayer(p.id)} hitSlop={10} accessibilityLabel={on ? 'Remove favorite' : 'Add favorite'}>
        <SymbolView name={on ? 'star.fill' : 'star'} tintColor={on ? '#f5a623' : t.subtle} size={26} />
      </Pressable>
    </View>
  );
}

function SeasonCard({ title, line, goalie }: { title: string; line: PlayerStatLine; goalie: boolean }) {
  const t = useTheme();
  const stats: [string, string][] = goalie
    ? [['GP', String(line.gamesPlayed ?? 0)], ['W-L', `${line.wins ?? 0}-${line.losses ?? 0}`], ['GAA', (line.goalsAgainstAvg ?? 0).toFixed(2)], ['SV%', (line.savePctg ?? 0).toFixed(3).replace(/^0/, '')], ['SO', String(line.shutouts ?? 0)]]
    : [['GP', String(line.gamesPlayed ?? 0)], ['G', String(line.goals ?? 0)], ['A', String(line.assists ?? 0)], ['PTS', String(line.points ?? 0)], ['+/-', String(line.plusMinus ?? 0)], ['PIM', String(line.pim ?? 0)]];
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.section, { color: t.sub }]}>{title.toUpperCase()}</Text>
      <View style={styles.statRow}>
        {stats.map(([label, val]) => (
          <View key={label} style={{ alignItems: 'center', gap: 2 }}>
            <Text style={{ color: t.sub, fontSize: 11, fontWeight: '700' }}>{label}</Text>
            <Text style={{ color: t.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{val}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * "Free Agent (UFA)" said the same thing twice and abbreviated the half that carries the meaning:
 * the difference between unrestricted and restricted is whether his old club can match an offer,
 * which is the entire question about a player in this state.
 *
 * Anything cap-space writes that is not one of these two is shown verbatim — the field is not a
 * closed set, and an unfamiliar status is worth showing as-is rather than flattening into whichever
 * of the two it least resembles.
 */
const STATUS_WORDS: Record<string, string> = {
  UFA: 'Unrestricted Free Agent',
  RFA: 'Restricted Free Agent',
};

/**
 * Is he between contracts?
 *
 * Anything cap-space does not list as signed, plus a signed deal whose last season has already been
 * played — cap-space is not always quick to move a player across, and either way there is no season
 * left to draw. The exception is a signed deal with NO expiry year: that is a contract we failed to
 * read rather than one that ran out, and calling him a free agent would invent the answer.
 */
function isFreeAgent(c: PlayerContract): boolean {
  if (c.status !== 'signed') return true;
  if (c.expiryYear == null) return false;
  return contractPlayedOut(c);
}

function contractStatusLabel(c: PlayerContract): string {
  const raw = (c.expiryStatus ?? (c.status === 'rfa' ? 'RFA' : 'UFA')).toUpperCase();
  return STATUS_WORDS[raw] ?? raw;
}

// Cap hit + term/expiry in one field, e.g. "$1.07M/yr · 2 yrs · RFA '29".
function contractSummary(c: PlayerContract): string {
  const yr = c.yearsRemaining;
  const term = c.status !== 'signed'
    ? contractStatusLabel(c)
    : `${yr === 0 ? 'Final yr' : `${yr} yr${yr === 1 ? '' : 's'}`}${c.expiryStatus && c.expiryYear ? ` · ${c.expiryStatus} '${String(c.expiryYear).slice(2)}` : ''}`;
  return [c.capHitLabel ? `${c.capHitLabel}/yr` : '', term].filter(Boolean).join(' · ');
}

// "1998-10-30" → "Oct 30, 1998". Parsed at noon so a negative UTC offset cannot roll the date back
// a day — a birthday is a calendar fact, not an instant.
function fmtBirthDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function BioCard({ p }: { p: PlayerDetail }) {
  const t = useTheme();
  const timeline = p.contract ? contractTimeline(p.contract) : null;
  const born = [fmtBirthDate(p.birthDate), p.age != null ? `(${p.age})` : null].filter(Boolean).join(' ');
  const draftLabel = p.draft?.year
    ? `${p.draft.year}${p.draft.teamAbbrev ? ` · ${p.draft.teamAbbrev}` : ''}${p.draft.overallPick ? ` · #${p.draft.overallPick}` : ''}`
    : null;
  /**
   * "Undrafted" only when we actually know he went undrafted.
   *
   * The NHL publishes draft status for players in its own system; for a junior we have never seen
   * there, the absence of a draft record says nothing about him. A row reading "Draft — Undrafted"
   * is worse than no row, because a reader takes it as an assertion about the PLAYER rather than
   * about our data — and on a junior roster nearly everyone is in that state.
   */
  const draft = draftLabel ?? (p.draftStatusKnown === false ? undefined : 'Undrafted');
  const rows: [string, string | undefined][] = [
    ['Born', born || undefined],
    // birthplace already ends in the country ("Calgary, AB, CAN"), so appending birthCountry gave
    // "Calgary, AB, CAN, CAN". The country alone is the fallback for players we have no city for.
    // The word is the honest one: sources record a birthplace or a hometown without saying which.
    ['Hometown', p.birthplace || p.birthCountry || undefined],
    ['Draft', draft],
    /**
     * Who HOLDS him, when that is not who he plays for.
     *
     * The club under his name is now the one he actually plays for, which for a prospect is his
     * college or junior team — so the NHL club that drafted or signed him would otherwise vanish from
     * the page entirely. Shown only when the two differ: for an NHL player it would repeat the line
     * above it. (The web puts this as a crest beside the name; a labelled row is the version that
     * needs no decoding.)
     */
    ...(p.nhlTeam && p.nhlTeam !== p.teamAbbrev
      ? [['NHL rights', p.nhlTeam] as [string, string]]
      : []),
    /**
     * Only a FREE AGENT's status belongs here.
     *
     * A contract is its own section now, and a player between deals has no contract to put in it —
     * what he has is a state, which is a fact about him like his birthplace, so it stays in the bio
     * where the other facts about him are. The contract section is then never an empty shell saying
     * he has none.
     *
     * "Signed, expiry unknown" is deliberately NOT a free agent: that is a contract we failed to
     * read, and it goes to the contract section as a sentence.
     */
    ...(p.contract && isFreeAgent(p.contract)
      ? [['Status', contractStatusLabel(p.contract)] as [string, string]]
      : []),
  ];

  const shown = rows.filter(([, v]) => v);
  // A heading over nothing looks broken. For a junior we hold nothing but a name and a position —
  // no birth date, no birthplace, and no "Undrafted" to pad it — there is no card to draw.
  if (!shown.length) return null;

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.section, { color: t.sub }]}>PLAYER INFO</Text>
      {shown.map(([label, val]) => (
        <View key={label} style={styles.bioRow}>
          <Text style={{ color: t.sub, fontSize: 14 }}>{label}</Text>
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{val}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The contract, on its own.
 *
 * It outgrew the bio card: a strip of eight season boxes under a list of one-line facts made the
 * card read as two unrelated things stacked, and the money is what a reader comes to a player page
 * for as often as the birthplace.
 *
 * Nothing at all for a free agent. There is no contract to show, and a section headed CONTRACT
 * saying "Unrestricted Free Agent" is a heading contradicting its own content — his status lives in
 * PLAYER INFO instead.
 */
function ContractCard({ p }: { p: PlayerDetail }) {
  const t = useTheme();
  const c = p.contract;
  if (!c || isFreeAgent(c)) return null;
  const timeline = contractTimeline(c);
  // Only for a player the rule can still reach — see canSlide.
  const slides = canSlide(c, nhlGamesForSlide(p.seasonTotals), p.birthDate);

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      {/* The heading carries it, because an entry-level deal changes what every box below means. */}
      <Text style={[styles.section, { color: t.sub }]}>{c.entryLevel ? 'CONTRACT (ENTRY LEVEL)' : 'CONTRACT'}</Text>
      {timeline ? (
        <ContractTimeline contract={c} />
      ) : (
        // Signed, and we could not read the term. A sentence is all there is to say.
        <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{contractSummary(c)}</Text>
      )}
      {/* Why the heading matters. There is no hover on a phone to hide this behind, and an ELC's
          dates are the one thing on this card that can move without anyone signing anything. */}
      {slides ? (
        <Text style={{ color: t.sub, fontSize: 11, lineHeight: 15, marginTop: 8 }}>
          Slides a year forward if he plays fewer than 10 NHL games this season.
        </Text>
      ) : null}
      <Text style={{ color: t.subtle, fontSize: 10, marginTop: 10 }}>Contract data via {c.source ?? 'cap-space.com'}</Text>
    </View>
  );
}

/**
 * Career, split the way the web splits it: the player's own league in the first tab, everything else
 * in the second.
 *
 * One table mixing them read as noise — Makar's NHL seasons interleaved with bantam AA, minor midget
 * and a world championship, all in the same type. The league someone came to read is the default, and
 * the rest is one tap away rather than gone.
 *
 * A player with no other leagues gets no tabs at all: a lone tab is a label pretending to be a
 * control.
 */
function CareerSection({ rows, goalie, primaryLeague, totals }: {
  rows: PlayerSeasonStatRow[]; goalie: boolean; primaryLeague: string; totals?: PlayerStatLine;
}) {
  const t = useTheme();
  const [tab, setTab] = useState<'primary' | 'other'>('primary');

  // Regular season only, newest first. `sequence` orders two stints within one season — a player
  // traded in February has a row for each club, and they are not interchangeable.
  const reg = rows
    .filter((r) => r.gameType === 2)
    .sort((a, b) => b.season - a.season || (a.sequence ?? 0) - (b.sequence ?? 0));
  const primaryRows = reg.filter((r) => r.leagueAbbrev === primaryLeague);
  const otherRows = reg.filter((r) => r.leagueAbbrev !== primaryLeague);

  const tabs = [
    ...(primaryRows.length ? [{ key: 'primary' as const, label: primaryLeague || 'Career' }] : []),
    ...(otherRows.length ? [{ key: 'other' as const, label: 'Other' }] : []),
  ];
  if (!tabs.length) return null;
  const active = tabs.some((x) => x.key === tab) ? tab : tabs[0].key;
  const shown = active === 'primary' ? primaryRows : otherRows;

  const cols = goalie ? ['GP', 'W-L', 'GAA', 'SV%'] : ['GP', 'G', 'A', 'PTS'];

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.section, { color: t.sub }]}>CAREER — REGULAR SEASON</Text>

      {tabs.length > 1 && (
        <View style={[styles.tabs, { borderColor: t.border }]}>
          {tabs.map((x) => {
            const on = x.key === active;
            return (
              <Pressable
                key={x.key}
                onPress={() => setTab(x.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                // An underline rather than a pill: these sit directly on the table they filter, and a
                // filled pill would compete with the numbers under it for the eye.
                style={[styles.tab, { borderBottomColor: on ? t.accent : 'transparent' }]}
              >
                <Text style={{ color: on ? t.text : t.sub, fontSize: 13, fontWeight: on ? '800' : '600' }}>{x.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={[styles.crow, { borderColor: t.border }]}>
        <Text style={[styles.cseason, { color: t.sub, fontWeight: '700' }]}>Season</Text>
        <Text style={[styles.cteam, { color: t.sub, fontWeight: '700' }]}>Team</Text>
        {cols.map((c) => <Text key={c} style={[styles.cstat, { color: t.sub, fontWeight: '700' }]}>{c}</Text>)}
      </View>

      {shown.map((r, i) => (
        <View key={`${r.season}-${r.sequence ?? i}-${r.teamName}`} style={[styles.crow, { borderColor: t.border }]}>
          <Text style={[styles.cseason, { color: t.text }]}>{seasonLabel(r.season)}</Text>
          <TeamCell row={r} />
          <StatCells line={r} goalie={goalie} />
        </View>
      ))}

      {/* Career totals close the player's OWN league only. Summing a column across the NHL, a world
          championship and bantam AA would produce a number that describes nobody. */}
      {active === 'primary' && totals ? (
        <View style={[styles.crow, { borderColor: t.border, borderBottomWidth: 0 }]}>
          <Text style={[styles.cseason, { color: t.sub, fontWeight: '800' }]}>Total</Text>
          <Text style={[styles.cteam, { color: t.sub, fontWeight: '800' }]} numberOfLines={1}>{primaryLeague}</Text>
          <StatCells line={totals} goalie={goalie} bold />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The club, with its crest where we have one.
 *
 * NHL rows carry an abbreviation and a logo; a junior or European row usually carries neither, so it
 * falls back to the club's name, which is the only thing that identifies it. The League column the
 * web shows on a wide screen is dropped here for the same reason the web drops it on a narrow one —
 * at this width the team name is doing that work already.
 */
function TeamCell({ row }: { row: PlayerSeasonStatRow }) {
  const t = useTheme();
  const label = row.teamAbbrev || row.teamName;
  const inner = (
    <View style={styles.cteamInner}>
      {row.teamLogo ? <TeamLogo uri={row.teamLogo} size={18} /> : null}
      <Text style={{ flexShrink: 1, color: t.text, fontSize: 13 }} numberOfLines={1}>{label}</Text>
    </View>
  );
  const teamId = row.teamHref?.startsWith('/teams/') ? row.teamHref.slice('/teams/'.length) : null;
  if (!teamId) return <View style={styles.cteam}>{inner}</View>;
  return (
    <View style={styles.cteam}>
      <Link href={{ pathname: '/teams/[teamId]', params: { teamId } }} asChild>
        <Pressable>{inner}</Pressable>
      </Link>
    </View>
  );
}

function StatCells({ line, goalie, bold }: { line: PlayerStatLine; goalie: boolean; bold?: boolean }) {
  const t = useTheme();
  const weight = bold ? ('800' as const) : undefined;
  const cell = (v: string, strong?: boolean) => (
    <Text style={[styles.cstat, { color: t.text, fontWeight: strong ? '700' : weight }]}>{v}</Text>
  );
  const dash = (v: number | undefined | null) => (v == null ? '—' : String(v));
  return goalie ? (
    <>
      {cell(dash(line.gamesPlayed))}
      {cell(`${line.wins ?? 0}-${line.losses ?? 0}`)}
      {cell(line.goalsAgainstAvg != null ? line.goalsAgainstAvg.toFixed(2) : '—')}
      {cell(line.savePctg != null ? line.savePctg.toFixed(3).replace(/^0/, '') : '—')}
    </>
  ) : (
    <>
      {cell(dash(line.gamesPlayed))}
      {cell(dash(line.goals))}
      {cell(dash(line.assists))}
      {cell(dash(line.points), true)}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  headshot: { width: 76, height: 76, borderRadius: 38 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 2 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 8 },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 2 },
  bioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  crow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  cseason: { width: 64, fontSize: 13, fontVariant: ['tabular-nums'] },
  cteam: { flex: 1, paddingHorizontal: 6 },
  cteamInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabs: { flexDirection: 'row', gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  tab: { paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 2, marginBottom: -StyleSheet.hairlineWidth },
  cstat: { width: 44, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'] },
});
