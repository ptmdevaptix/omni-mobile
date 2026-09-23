import { useQuery } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SegmentedFilter } from '@/components/segmented-filter';
import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { useFavorites } from '@/lib/favorites';
import { dayKey } from '@/lib/format';
import { fetchFollowSummary, type SummaryGoalie, type SummarySkater } from '@/lib/follow-summary';
import { useTheme } from '@/lib/theme';

/**
 * How everyone you follow did — the page a notification at the end of the day points at.
 *
 * Shaped like the player table on a game page, because that is the thing it is: a box score, for a
 * lineup nobody else has. Skaters and goalies are separate tables; they answer different questions
 * and sharing columns between them would serve neither.
 *
 * Day by default, since that is what the notification is about. The season switch answers the other
 * question a follower has — not "what happened tonight" but "how is he doing".
 */
export default function SummaryScreen() {
  const t = useTheme();
  const { favoritePlayers, prospectFollows, loaded } = useFavorites();
  const [scope, setScope] = useState<'Today' | 'Season'>('Today');
  const orgs = prospectFollows.map((f) => f.team);
  const today = dayKey();

  const q = useQuery({
    queryKey: ['follow-summary', scope, favoritePlayers.join(','), orgs.join(','), today],
    queryFn: () => fetchFollowSummary(favoritePlayers, orgs, scope === 'Season' ? 'season' : 'day', today),
    enabled: loaded && (favoritePlayers.length > 0 || orgs.length > 0),
    staleTime: 5 * 60_000,
  });
  const d = q.data;
  const season = scope === 'Season';

  if (loaded && !favoritePlayers.length && !orgs.length) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <Stack.Screen options={{ title: 'My Players' }} />
        <StateView kind="empty" title="Nobody followed yet" message="Star a player, or follow a team's prospects, and their nights land here." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: 'My Players' }} />
      <SegmentedFilter options={['Today', 'Season']} value={scope} onChange={(v) => setScope(v as 'Today' | 'Season')} pill={t.accent} capitalize={false} />

      {q.isLoading ? (
        <StateView kind="loading" />
      ) : q.isError ? (
        <StateView kind="error" message="Couldn’t load your players." onRetry={() => q.refetch()} />
      ) : !d || (!d.skaters.length && !d.goalies.length) ? (
        <StateView
          kind="empty"
          title={season ? 'No season stats yet' : 'Nobody played today'}
          message={season ? 'Once your players have games on record, their totals appear here.' : 'When one of your players is in a lineup, his night shows up here.'}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28, gap: 12 }}>
          {/* The day is not over until their last game is. Saying so beats a table that quietly
              grows while the reader is looking at it. */}
          {!season && d.pending > 0 ? (
            <Text style={{ color: t.subtle, fontSize: 12 }}>
              {d.pending} {d.pending === 1 ? 'game' : 'games'} still to finish — this fills in as they do.
            </Text>
          ) : null}

          {d.skaters.length ? <SkaterTable rows={d.skaters} season={season} /> : null}
          {d.goalies.length ? <GoalieTable rows={d.goalies} season={season} /> : null}
        </ScrollView>
      )}
    </View>
  );
}

function NameCell({ name, club, clubLogo, league, gameId }: {
  name: string; club?: string; clubLogo?: string; league?: string; gameId?: string;
}) {
  const t = useTheme();
  const body = (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TeamLogo uri={clubLogo} size={22} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{name}</Text>
        <Text style={{ color: t.subtle, fontSize: 10.5 }} numberOfLines={1}>
          {[league, club].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
  if (!gameId) return body;
  return (
    <Link href={{ pathname: '/games/[gameId]', params: { gameId } }} asChild>
      <Pressable style={{ flex: 1 }}>{body}</Pressable>
    </Link>
  );
}

function Card({ title, note, head, children }: { title: string; note?: string; head: React.ReactNode; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={[styles.section, { color: t.sub }]}>{title}</Text>
        {note ? <Text style={{ color: t.subtle, fontSize: 10 }}>{note}</Text> : null}
      </View>
      <View style={[styles.headRow, { borderBottomColor: t.border }]}>{head}</View>
      {children}
    </View>
  );
}

const Num = ({ v, w = 30, strong }: { v?: number | string | null; w?: number; strong?: boolean }) => {
  const t = useTheme();
  return (
    <Text style={{ width: w, textAlign: 'right', fontSize: 13, color: strong ? t.text : t.sub, fontWeight: strong ? '800' : '400', fontVariant: ['tabular-nums'] }}>
      {v === undefined || v === null || v === '' ? '–' : v}
    </Text>
  );
};

const Head = ({ label, w = 30 }: { label: string; w?: number }) => {
  const t = useTheme();
  return <Text style={{ width: w, textAlign: 'right', fontSize: 10, fontWeight: '700', letterSpacing: 0.3, color: t.sub }}>{label}</Text>;
};

function SkaterTable({ rows, season }: { rows: SummarySkater[]; season: boolean }) {
  const t = useTheme();
  const plus = (v?: number) => (v === undefined ? undefined : v > 0 ? `+${v}` : String(v));
  return (
    <Card
      title="SKATERS"
      note={season ? 'Season totals' : undefined}
      head={<>
        <View style={{ flex: 1 }} />
        {season ? <Head label="GP" /> : null}
        <Head label="G" /><Head label="A" /><Head label="P" /><Head label="+/-" /><Head label="PIM" />
      </>}
    >
      {rows.map((r) => (
        <View key={r.key} style={[styles.row, { borderBottomColor: t.border }]}>
          <NameCell name={r.name} club={r.club} clubLogo={r.clubLogo} league={r.league} gameId={r.gameId} />
          {season ? <Num v={r.gp} /> : null}
          <Num v={r.g} strong={r.g > 0} />
          <Num v={r.a} strong={r.a > 0} />
          <Num v={r.pts} strong={r.pts > 0} />
          <Num v={plus(r.plusMinus)} />
          <Num v={r.pim} />
        </View>
      ))}
    </Card>
  );
}

function GoalieTable({ rows, season }: { rows: SummaryGoalie[]; season: boolean }) {
  const t = useTheme();
  const pct = (v?: number) => (v === undefined ? undefined : v.toFixed(3).replace(/^0/, ''));
  return (
    <Card
      title="GOALIES"
      note={season ? 'Season totals' : undefined}
      head={<>
        <View style={{ flex: 1 }} />
        {season ? <><Head label="GP" /><Head label="W" w={26} /><Head label="L" w={26} /><Head label="OTL" w={30} /><Head label="SO" w={26} /><Head label="GAA" w={38} /><Head label="SV%" w={40} /></>
                : <><Head label="SA" /><Head label="GA" /><Head label="SV%" w={40} /></>}
      </>}
    >
      {rows.map((r) => (
        <View key={r.key} style={[styles.row, { borderBottomColor: t.border }]}>
          <NameCell name={r.name} club={r.club} clubLogo={r.clubLogo} league={r.league} gameId={r.gameId} />
          {season ? (
            <>
              <Num v={r.gp} /><Num v={r.w} w={26} /><Num v={r.l} w={26} /><Num v={r.otl} w={30} />
              <Num v={r.so} w={26} /><Num v={r.gaa?.toFixed(2)} w={38} /><Num v={pct(r.svPct)} w={40} strong />
            </>
          ) : (
            <><Num v={r.sa} /><Num v={r.ga} /><Num v={pct(r.svPct)} w={40} strong /></>
          )}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
