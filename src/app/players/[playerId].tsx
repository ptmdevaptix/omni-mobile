import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { useFavorites } from '@/lib/favorites';
import { fetchPlayer, seasonLabel } from '@/lib/player';
import type { PlayerDetail, PlayerSeasonStatRow, PlayerStatLine } from '@/lib/player-types';
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
          <CareerCard rows={p.seasonTotals ?? []} goalie={p.isGoalie} />
        </ScrollView>
      )}
    </View>
  );
}

function Hero({ p }: { p: PlayerDetail }) {
  const t = useTheme();
  const { isFavoritePlayer, togglePlayer } = useFavorites();
  const on = isFavoritePlayer(p.id);
  return (
    <View style={styles.hero}>
      {p.headshot ? <Image source={{ uri: p.headshot }} style={styles.headshot} contentFit="cover" /> : <View style={[styles.headshot, { backgroundColor: t.card }]} />}
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }} numberOfLines={1}>{p.fullName}</Text>
        <Text style={{ color: t.sub, fontSize: 14, marginTop: 2 }}>
          {[p.number != null ? `#${p.number}` : null, p.position].filter(Boolean).join(' · ')}
        </Text>
        {p.teamAbbrev ? (
          <Link href={{ pathname: '/teams/[teamId]', params: { teamId: p.teamAbbrev.toLowerCase() } }} asChild>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <TeamLogo uri={p.teamLogo} size={20} />
              <Text style={{ color: t.accent, fontSize: 14, fontWeight: '600' }}>{p.teamName || p.teamAbbrev}</Text>
            </Pressable>
          </Link>
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

function BioCard({ p }: { p: PlayerDetail }) {
  const t = useTheme();
  const born = [p.birthDate, p.age != null ? `(${p.age})` : null].filter(Boolean).join(' ');
  const draft = p.draft?.year ? `${p.draft.year}${p.draft.teamAbbrev ? ` · ${p.draft.teamAbbrev}` : ''}${p.draft.overallPick ? ` · #${p.draft.overallPick}` : ''}` : 'Undrafted';
  const rows: [string, string | undefined][] = [
    ['Height', p.height],
    ['Weight', p.weight ? `${p.weight} lb` : undefined],
    [p.isGoalie ? 'Catches' : 'Shoots', p.shootsCatches],
    ['Born', born || undefined],
    ['Birthplace', [p.birthplace, p.birthCountry].filter(Boolean).join(', ') || undefined],
    ['Draft', draft],
    ...(p.contract?.capHitLabel ? [['Contract', `${p.contract.capHitLabel}${p.contract.expiryYear ? ` → ${p.contract.expiryYear}` : ''}`] as [string, string]] : []),
  ];
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.section, { color: t.sub }]}>PLAYER INFO</Text>
      {rows.filter(([, v]) => v).map(([label, val]) => (
        <View key={label} style={styles.bioRow}>
          <Text style={{ color: t.sub, fontSize: 14 }}>{label}</Text>
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{val}</Text>
        </View>
      ))}
    </View>
  );
}

function CareerCard({ rows, goalie }: { rows: PlayerSeasonStatRow[]; goalie: boolean }) {
  const t = useTheme();
  const reg = rows.filter((r) => r.gameType === 2).sort((a, b) => b.season - a.season);
  if (!reg.length) return null;
  const cols = goalie ? ['GP', 'W-L', 'GAA', 'SV%'] : ['GP', 'G', 'A', 'PTS'];
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.section, { color: t.sub }]}>CAREER</Text>
      <View style={[styles.crow, { borderColor: t.border }]}>
        <Text style={[styles.cseason, { color: t.sub, fontWeight: '700' }]}>Season</Text>
        <Text style={[styles.cleague, { color: t.sub, fontWeight: '700' }]}>Lg</Text>
        {cols.map((c) => <Text key={c} style={[styles.cstat, { color: t.sub, fontWeight: '700' }]}>{c}</Text>)}
      </View>
      {reg.map((r, i) => (
        <View key={`${r.season}-${r.teamName}-${i}`} style={[styles.crow, { borderColor: t.border }]}>
          <Text style={[styles.cseason, { color: t.text }]}>{seasonLabel(r.season)}</Text>
          <Text style={[styles.cleague, { color: t.sub }]} numberOfLines={1}>{r.leagueAbbrev}</Text>
          {goalie ? (
            <>
              <Text style={[styles.cstat, { color: t.text }]}>{r.gamesPlayed ?? 0}</Text>
              <Text style={[styles.cstat, { color: t.text }]}>{r.wins ?? 0}-{r.losses ?? 0}</Text>
              <Text style={[styles.cstat, { color: t.text }]}>{(r.goalsAgainstAvg ?? 0).toFixed(2)}</Text>
              <Text style={[styles.cstat, { color: t.text }]}>{(r.savePctg ?? 0).toFixed(3).replace(/^0/, '')}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.cstat, { color: t.text }]}>{r.gamesPlayed ?? 0}</Text>
              <Text style={[styles.cstat, { color: t.text }]}>{r.goals ?? 0}</Text>
              <Text style={[styles.cstat, { color: t.text }]}>{r.assists ?? 0}</Text>
              <Text style={[styles.cstat, { color: t.text, fontWeight: '700' }]}>{r.points ?? 0}</Text>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headshot: { width: 76, height: 76, borderRadius: 38 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 2 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 8 },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 2 },
  bioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  crow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  cseason: { width: 64, fontSize: 13, fontVariant: ['tabular-nums'] },
  cleague: { flex: 1, fontSize: 13, paddingHorizontal: 6 },
  cstat: { width: 44, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'] },
});
