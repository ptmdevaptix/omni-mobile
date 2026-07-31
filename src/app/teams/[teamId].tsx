import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { TeamHome } from '@/components/team/team-home';
import { TeamProspects } from '@/components/team/team-prospects';
import { TeamRoster } from '@/components/team/team-roster';
import { TeamSchedule } from '@/components/team/team-schedule';
import { TeamStats } from '@/components/team/team-stats';
import { TeamTabsBar } from '@/components/team/team-tabs-bar';
import { TeamLogo } from '@/components/team-logo';
import { api, leagueOf, teamHeaderPath } from '@/lib/api';
import { useFavorites } from '@/lib/favorites';
import { teamTabs, type TeamTab } from '@/lib/team';
import { useTheme } from '@/lib/theme';
import type { TeamHeader } from '@/lib/types';

export default function TeamScreen() {
  const t = useTheme();
  const { isFavorite, toggle } = useFavorites();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();

  const tabs = teamTabs(teamId);
  const [tab, setTab] = useState<TeamTab>(tabs[0]);

  const q = useQuery({ queryKey: ['team-header', teamId], queryFn: () => api<TeamHeader>(teamHeaderPath(teamId)) });
  const team = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: team?.abbr || 'Team' }} />

      {q.isError ? (
        <StateView kind="error" message="Couldn’t load this team." onRetry={() => q.refetch()} />
      ) : !team ? (
        <StateView kind="loading" />
      ) : (
        <>
          <View style={[styles.hero, { borderColor: t.border }]}>
            {team.logo ? <TeamLogo uri={team.logo} size={52} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 20, fontWeight: '800' }} numberOfLines={1}>
                {team.name}
              </Text>
              <Text style={{ color: t.sub, fontSize: 13, marginTop: 1 }} numberOfLines={1}>
                {[leagueOf(teamId), team.division, team.record].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Pressable onPress={() => toggle(teamId)} hitSlop={10} accessibilityLabel={isFavorite(teamId) ? 'Remove favorite' : 'Add favorite'}>
              <SymbolView name={isFavorite(teamId) ? 'star.fill' : 'star'} tintColor={isFavorite(teamId) ? '#f5a623' : t.subtle} size={26} />
            </Pressable>
          </View>

          <TeamTabsBar tabs={tabs} value={tab} onChange={setTab} />

          <View style={{ flex: 1 }}>
            {tab === 'home' ? <TeamHome teamId={teamId} />
              : tab === 'schedule' ? <TeamSchedule teamId={teamId} />
              : tab === 'roster' ? <TeamRoster teamId={teamId} />
              : tab === 'stats' ? <TeamStats teamId={teamId} />
              : <TeamProspects teamId={teamId} />}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
