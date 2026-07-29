import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { fetchAllTeams, type TeamDirectoryEntry } from '@/lib/leagues';
import { useTheme } from '@/lib/theme';

// Team search (players will be added once player pages land). Filters the /all-teams directory locally.
export default function SearchScreen() {
  const t = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  const query = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return (query.data ?? [])
      .filter((tm) => tm.name.toLowerCase().includes(s) || (tm.abbr ?? '').toLowerCase().includes(s))
      .slice(0, 60);
  }, [q, query.data]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerRight: () => <Pressable onPress={() => router.back()} hitSlop={8}><Text style={{ color: t.accent, fontSize: 16 }}>Done</Text></Pressable> }} />

      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: t.card, borderColor: t.border }]}>
          <SymbolView name="magnifyingglass" tintColor={t.subtle} size={17} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search teams"
            placeholderTextColor={t.subtle}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={{ flex: 1, color: t.text, fontSize: 17 }}
          />
        </View>
      </View>

      {query.isLoading ? (
        <StateView kind="loading" />
      ) : query.isError ? (
        <StateView kind="error" message="Couldn’t load teams." onRetry={() => query.refetch()} />
      ) : q.trim() === '' ? (
        <StateView kind="empty" title="Search teams" message="Type a team name or abbreviation." />
      ) : results.length === 0 ? (
        <StateView kind="empty" title="No matches" message={`Nothing found for “${q.trim()}”.`} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => <TeamResult team={item} />}
        />
      )}
    </View>
  );
}

function TeamResult({ team }: { team: TeamDirectoryEntry }) {
  const t = useTheme();
  return (
    <Link href={{ pathname: '/teams/[teamId]', params: { teamId: team.id } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.row, { backgroundColor: t.card, borderColor: t.border }])}>
        <TeamLogo uri={team.logo} size={30} />
        <Text style={{ flex: 1, color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{team.name}</Text>
        <Text style={{ color: t.sub, fontSize: 12, fontWeight: '700' }}>{team.league}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
});
