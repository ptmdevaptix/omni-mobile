import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api, leagueOf, teamHeaderPath } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import type { TeamHeader } from '@/lib/types';

export default function TeamScreen() {
  const t = useTheme();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const [team, setTeam] = useState<TeamHeader | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<TeamHeader>(teamHeaderPath(teamId))
      .then((d) => { if (!cancelled) setTeam(d); })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [teamId]);

  if (error) {
    return <View style={[styles.center, { backgroundColor: t.bg }]}><Text style={{ color: t.sub, padding: 24, textAlign: 'center' }}>Couldn’t load this team.{'\n'}{error}</Text></View>;
  }
  if (!team) {
    return <View style={[styles.center, { backgroundColor: t.bg }]}><ActivityIndicator color={t.accent} /></View>;
  }

  const last = team.gameStatus?.last;
  const next = team.gameStatus?.next;
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Stack.Screen options={{ title: team.abbr || 'Team' }} />

      <View style={styles.hero}>
        {team.logo ? <Image source={{ uri: team.logo }} style={styles.heroLogo} resizeMode="contain" /> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>{team.name}{team.nickname ? ` ${team.nickname}` : ''}</Text>
          <Text style={{ color: t.sub, fontSize: 13, marginTop: 2 }}>{leagueOf(teamId)}{team.division ? ` · ${team.division}` : ''}</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Row t={t} label="Record" value={team.record ?? '—'} />
        {team.confRecord ? <Row t={t} label="Conference" value={`${team.confRecord}`} /> : null}
        {/* Points are an NHL/AHL/CHL concept — NCAA returns 0, so hide it there (matches the web app). */}
        {typeof team.points === 'number' && team.points > 0 ? <Row t={t} label="Points" value={String(team.points)} /> : null}
      </View>

      {(last || next) && (
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          {last ? <Row t={t} label="Last" value={`${last.date ? fmtDate(last.date) + ' · ' : ''}${last.awayAbbr} ${last.awayScore}, ${last.homeAbbr} ${last.homeScore}${last.overtime ? ` (${last.overtime})` : ''}`} /> : null}
          {next ? <Row t={t} label="Next" value={`${fmtDate(next.date)} ${next.isHome ? 'vs' : '@'} ${next.opponentAbbr}`} /> : null}
        </View>
      )}

      <Text style={{ color: t.sub, fontSize: 11, textAlign: 'center' }}>Data from omnihockey.com</Text>
    </ScrollView>
  );
}

function Row({ t, label, value }: { t: ReturnType<typeof useTheme>; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={{ color: t.sub, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

function fmtDate(d: string): string {
  const date = new Date(d + 'T12:00:00');
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroLogo: { width: 64, height: 64 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
