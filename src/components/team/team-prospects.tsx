import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { playerRouteId } from '@/lib/player';
import { fetchTeamOrg } from '@/lib/team';
import type { OrgPlayer } from '@/lib/team-types';
import { useTheme } from '@/lib/theme';

export function TeamProspects({ teamId }: { teamId: string }) {
  const t = useTheme();
  const q = useQuery({ queryKey: ['team-org', teamId], queryFn: () => fetchTeamOrg(teamId) });

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError) return <StateView kind="error" message="Couldn’t load prospects." onRetry={() => q.refetch()} />;

  const players = q.data?.players ?? [];
  if (!players.length) return <StateView kind="empty" title="No prospects" message="Organization depth isn’t available." />;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
      data={players}
      keyExtractor={(p, i) => `${p.name}-${i}`}
      ListHeaderComponent={<Text style={{ color: t.subtle, fontSize: 12, marginBottom: 8 }}>Signed prospects & reserve-list rights beyond the active roster.</Text>}
      renderItem={({ item }) => <ProspectRow p={item} />}
    />
  );
}

/**
 * The club he plays for: its crest where we carry one, its country's flag otherwise.
 *
 * A Swedish flag beside HV71 says the true thing we know about a club whose logo we do not have.
 * The fixed box keeps every name on the same left edge whether or not the mark resolved — a row that
 * shifts because a crest is missing reads as broken.
 */
function ClubMark({ logo, flag }: { logo?: string | null; flag?: string }) {
  if (logo) return <TeamLogo uri={logo} size={MARK} />;
  return (
    <View style={styles.mark}>
      {flag ? <Text style={{ fontSize: MARK * 0.8 }}>{flag}</Text> : null}
    </View>
  );
}

const MARK = 26;

function ProspectRow({ p }: { p: OrgPlayer }) {
  const t = useTheme();
  const routeId = playerRouteId(p.nhlId);
  const draft = p.undrafted ? 'Undrafted' : p.draftYear ? `${p.draftYear}${p.draftOverall ? ` #${p.draftOverall}` : ''}` : '';
  const contract = p.signed ? [p.aavLabel, p.contractEndYear ? `→ ${p.contractEndYear}` : ''].filter(Boolean).join(' ') : 'Unsigned';
  const body = (
    <>
      {/* The club's mark leads the row, at the scale a crest needs to be recognised — that is the
          whole value of it, and at 14px inline it was a smudge. The second line then carries the
          club's NAME alone: the mark and the name said the same thing twice, on top of each other. */}
      <ClubMark logo={p.lastTeamLogo} flag={p.lastTeamFlag} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{p.name}</Text>
        <Text style={{ color: t.sub, fontSize: 12 }} numberOfLines={1}>
          {[p.position, p.age ? `${p.age}y` : '', draft, p.lastTeamName].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Text style={{ color: p.signed ? t.text : t.subtle, fontSize: 12, fontWeight: '600', textAlign: 'right', maxWidth: 120 }} numberOfLines={1}>{contract}</Text>
    </>
  );
  if (!routeId) return <View style={[styles.row, { borderColor: t.border }]}>{body}</View>;
  return (
    <Link href={{ pathname: '/players/[playerId]', params: { playerId: routeId } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.row, { borderColor: t.border }])}>{body}</Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  mark: { width: MARK, height: MARK, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
