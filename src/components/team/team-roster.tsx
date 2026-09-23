import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';

import { NhlCrest } from '@/components/nhl-crest';
import { SegmentedFilter } from '@/components/segmented-filter';
import { StateView } from '@/components/state-view';
import { leagueOf } from '@/lib/api';
import { countryFlag } from '@/lib/country-flags';
import type { MoveConfidence, RosterMove } from '@/lib/ncaa-moves-types';
import { playerRouteId, playerSlug } from '@/lib/player';
import { fetchNcaaMoves, fetchTeamRoster } from '@/lib/team';
import type { RosterPlayer } from '@/lib/team-types';
import { useTheme } from '@/lib/theme';
import { useFollowedMatcher } from '@/lib/use-follows';

// Bump yearly, with the web's NCAA_ROSTER_SEASONS — the college feeds carry two seasons at a time.
const NCAA_SEASONS: { key: string; label: string }[] = [
  { key: '2026-27', label: 'Current' },
  { key: '2025-26', label: 'Last Season' },
];
const CHANGES = 'Changes';

export function TeamRoster({ teamId }: { teamId: string }) {
  const t = useTheme();
  const isNhl = leagueOf(teamId) === 'NHL';
  // College rosters turn over every summer and the feeds keep last season alongside this one, so the
  // reader can hold both up — and, in the offseason, read who arrived and who left instead.
  const isNcaa = leagueOf(teamId) === 'NCAA';
  const [view, setView] = useState(NCAA_SEASONS[0].label);
  const picked = NCAA_SEASONS.find((s) => s.label === view);
  const season = isNcaa && picked && picked !== NCAA_SEASONS[0] ? picked.key : null;
  const showChanges = isNcaa && view === CHANGES;

  const q = useQuery({
    queryKey: ['team-roster', teamId, season],
    queryFn: () => fetchTeamRoster(teamId, season),
    enabled: !showChanges,
  });
  // Fetched only once the reader opens the view, as on the web: most visits never ask for it.
  const movesQ = useQuery({
    queryKey: ['ncaa-moves', teamId],
    queryFn: () => fetchNcaaMoves(teamId),
    enabled: showChanges,
  });

  const picker = isNcaa ? (
    <SegmentedFilter
      options={[...NCAA_SEASONS.map((s) => s.label), CHANGES]}
      value={view}
      onChange={setView}
      pill={t.accent}
      capitalize={false}
    />
  ) : null;
  const frame = (body: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {picker}
      {body}
    </View>
  );

  if (showChanges) {
    if (movesQ.isLoading) return frame(<StateView kind="loading" />);
    if (movesQ.isError) return frame(<StateView kind="error" message="Couldn’t load roster changes." onRetry={() => movesQ.refetch()} />);
    return frame(<ChangesView incoming={movesQ.data?.incoming ?? []} outgoing={movesQ.data?.outgoing ?? []} season={movesQ.data?.season} />);
  }
  if (q.isLoading) return frame(<StateView kind="loading" />);
  if (q.isError) return frame(<StateView kind="error" message="Couldn’t load the roster." onRetry={() => q.refetch()} />);

  const d = q.data;
  const sections = [
    { title: 'Forwards', data: d?.forwards ?? [] },
    { title: 'Defensemen', data: d?.defensemen ?? [] },
    { title: 'Goalies', data: d?.goalies ?? [] },
  ].filter((s) => s.data.length);

  // Framed, not bare: an empty season must still leave the picker on screen or there is no way back.
  if (!sections.length) return frame(<StateView kind="empty" title="No roster" message="Roster isn’t available yet." />);

  // A feed that gives a country and nothing else (the European leagues') would put a lone flag on
  // every hometown line; for those the flag moves up beside the name — it is the whole of what we
  // know — and the hometown line goes. Mirrors countryOnly() in the web's team-roster.
  const all = sections.flatMap((s) => s.data);
  const flagInName = all.every((p) => !p.birthplace) && all.some((p) => p.birthCountry);

  return frame(
    <SectionList
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
      sections={sections}
      keyExtractor={(p, i) => `${p.id}-${i}`}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        d?.estimated || season ? (
          <Text style={{ color: t.subtle, fontSize: 12, marginBottom: 8 }}>
            {d?.estimated
              ? d.incomingOnly
                ? 'Projected — known additions only; returning roster unavailable.'
                : 'Projected roster (returners + known commits) until the official one is posted.'
              : `Showing the ${d?.season ?? season} roster.`}
          </Text>
        ) : null
      }
      renderSectionHeader={({ section }) => (
        <Text style={[styles.section, { color: t.sub }]}>{section.title.toUpperCase()}</Text>
      )}
      // The stored slug links every league the API has seeded; the id forms are the fallback for a
      // row that has no players row yet. The box score reads the same way — the roster had been
      // left on NHL ids only, so a junior with a page went unlinked here and linked there.
      renderItem={({ item }) => <PlayerRow p={item} flagInName={flagInName} routeId={item.playerSlug ?? (isNhl ? playerRouteId(item.id) : playerRouteId(item.nhlId))} />}
    />,
  );
}

const DIRECTION_LABEL: Record<string, string> = {
  commit: 'Commit', transfer_in: 'Transfer in', transfer_out: 'Transfer out',
  departure: 'Departing', pro_signing: 'Signed pro', graduation: 'Graduating',
};
const CONFIDENCE_LABEL: Record<MoveConfidence, string> = {
  confirmed: 'Confirmed', corroborated: 'Corroborated', reported: 'Reported',
};

/**
 * Who arrived and who left. The two web columns become two stacked lists on a phone, which is how
 * they already fall at narrow widths there.
 *
 * The badge is the point of the view: a "reported" move is an early signal from a tracker and may
 * never happen, so it must not look like a settled fact.
 */
function ChangesView({ incoming, outgoing, season }: { incoming: RosterMove[]; outgoing: RosterMove[]; season?: string }) {
  const t = useTheme();
  if (!incoming.length && !outgoing.length) {
    return <StateView kind="empty" title="No changes tracked" message={`Nothing tracked yet for ${season ?? 'this season'}.`} />;
  }
  const list = (title: string, items: RosterMove[]) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.section, { color: t.sub, marginTop: 0 }]}>
        {title.toUpperCase()} <Text style={{ color: t.subtle }}>({items.length})</Text>
      </Text>
      {items.length === 0 ? (
        <Text style={{ color: t.subtle, fontSize: 12 }}>None tracked.</Text>
      ) : (
        items.map((m, i) => <MoveRow key={`${m.playerName}-${i}`} m={m} />)
      )}
    </View>
  );
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
      {list('Incoming', incoming)}
      {list('Departing', outgoing)}
      <Text style={{ color: t.subtle, fontSize: 11, lineHeight: 15 }}>
        Offseason movement from portal and commitment trackers; graduations from last season’s class
        years. Badges reflect confidence — <Text style={{ fontWeight: '700' }}>Reported</Text> items are
        early signals and may change.
      </Text>
    </ScrollView>
  );
}

function MoveRow({ m }: { m: RosterMove }) {
  const t = useTheme();
  const label = DIRECTION_LABEL[m.direction] ?? m.direction;
  // The moves feed carries an NHL id but no stored slug, so the route is built the way the web
  // builds it. Without an id there is no page to link to, and the name stands plain.
  const routeId = m.nhlId ? playerSlug(m.playerName, m.nhlId) : null;
  const name = (
    <Text style={{ color: routeId ? t.accent : t.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
      {m.playerName}
    </Text>
  );
  return (
    <View style={[styles.row, { borderColor: t.border }]}>
      <Text style={{ width: 22, color: t.subtle, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>{m.position ?? ''}</Text>
      <View style={{ flex: 1 }}>
        {routeId ? (
          <Link href={{ pathname: '/players/[playerId]', params: { playerId: routeId } }} asChild>
            <Pressable>{name}</Pressable>
          </Link>
        ) : name}
        <Text style={{ color: t.sub, fontSize: 11 }} numberOfLines={1}>
          {label}{m.otherTeam ? `  ${m.direction === 'transfer_out' ? '→' : '←'} ${m.otherTeam.name}` : ''}
        </Text>
      </View>
      <ConfidenceBadge c={m.confidence} />
    </View>
  );
}

function ConfidenceBadge({ c }: { c: MoveConfidence }) {
  const t = useTheme();
  const tone = c === 'confirmed' ? '#10b981' : c === 'corroborated' ? t.accent : t.sub;
  return (
    <View style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: `${tone}66`, backgroundColor: `${tone}1f`, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 }}>
      <Text style={{ color: tone, fontSize: 10, fontWeight: '700' }}>{CONFIDENCE_LABEL[c]}</Text>
    </View>
  );
}

// Abbreviated position for the name suffix: forwards RW/LW/C; defense RD/LD by handedness; goalies none.
function posAbbr(p: RosterPlayer): string | null {
  const pos = (p.position || '').toUpperCase();
  const hand = (p.shootsCatches || '').toUpperCase();
  if (pos.startsWith('G')) return null;
  if (pos === 'C') return 'C';
  if (pos === 'LW' || pos === 'L') return 'LW';
  if (pos === 'RW' || pos === 'R') return 'RW';
  if (pos === 'LD' || pos === 'RD') return pos;
  if (pos.startsWith('D')) return hand === 'R' ? 'RD' : hand === 'L' ? 'LD' : 'D';
  return pos || null;
}

function PlayerRow({ p, routeId, flagInName }: { p: RosterPlayer; routeId: string | null; flagInName: boolean }) {
  const t = useTheme();
  // One of the reader's own, marked the way the box score marks him: the accent colour and a faint
  // wash, never a star ahead of the name. Not done on the prospects tab, where every row would carry
  // the mark and the mark would say nothing.
  const followed = useFollowedMatcher();
  const mine = !!followed({ name: p.name, playerId: p.id, playerSlug: p.playerSlug });
  const abbr = posAbbr(p);
  const flag = flagInName ? countryFlag(p.birthCountry) : undefined;
  const htwt = [p.height, p.weight ? `${p.weight} lb` : null].filter(Boolean).join(' · ');
  const body = (
    <>
      <Text style={[styles.num, { color: t.subtle }]}>{p.number != null ? p.number : '--'}</Text>
      <View style={{ flex: 1 }}>
        {/* The NHL rights crest sits beside the name, never inside it: a name long enough to
            truncate would otherwise clip the crest instead of itself. A handful of players on a
            junior or college roster carry one, so it earns no column of its own. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={{ color: mine ? t.accent : t.text, fontSize: 15, fontWeight: mine ? '800' : '600', flexShrink: 1 }} numberOfLines={1}>
            {p.name}{abbr ? <Text style={{ color: t.sub, fontWeight: '400' }}> ({abbr})</Text> : null}{flag ? <Text accessibilityLabel={p.birthCountry}> {flag}</Text> : null}
          </Text>
          {p.nhlRights ? <NhlCrest abbr={p.nhlRights} size={15} /> : null}
        </View>
        {p.birthplace ? <Text style={{ color: t.sub, fontSize: 12 }} numberOfLines={1}>{p.birthplace}</Text> : null}
      </View>
      <Text style={{ color: t.sub, fontSize: 13, fontVariant: ['tabular-nums'] }}>{htwt}</Text>
    </>
  );
  const row = [styles.row, { borderColor: t.border }, mine ? { backgroundColor: `${t.accent}14` } : null];
  if (!routeId) return <View style={row}>{body}</View>;
  return (
    <Link href={{ pathname: '/players/[playerId]', params: { playerId: routeId } }} asChild>
      <Pressable style={StyleSheet.flatten(row)}>{body}</Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  num: { width: 30, fontSize: 15, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  meta: { alignItems: 'flex-end', minWidth: 64 },
});
