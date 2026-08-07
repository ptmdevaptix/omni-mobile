import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { useFavorites } from '@/lib/favorites';
import { fetchAllTeams, type TeamDirectoryEntry } from '@/lib/leagues';
import { searchPlayers } from '@/lib/player';
import type { PlayerSearchResult } from '@/lib/player-types';
import { useTheme } from '@/lib/theme';

// Search teams (local filter of /all-teams) + players (NHL player-search API).
export default function SearchScreen() {
  const t = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  const s = q.trim();

  const teamsQ = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });
  const playersQ = useQuery({ queryKey: ['player-search', s.toLowerCase()], queryFn: () => searchPlayers(s), enabled: s.length >= 2 });

  const teams = useMemo(() => {
    if (!s) return [] as TeamDirectoryEntry[];
    const l = s.toLowerCase();
    return (teamsQ.data ?? []).filter((tm) => tm.name.toLowerCase().includes(l) || (tm.abbr ?? '').toLowerCase().includes(l)).slice(0, 40);
  }, [s, teamsQ.data]);

  const players = useMemo(() => [...(playersQ.data ?? [])].sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0)).slice(0, 40), [playersQ.data]);

  const sections = [
    ...(teams.length ? [{ title: 'Teams', data: teams as (TeamDirectoryEntry | PlayerSearchResult)[] }] : []),
    ...(players.length ? [{ title: 'Players', data: players as (TeamDirectoryEntry | PlayerSearchResult)[] }] : []),
  ];

  const noResults = s.length > 0 && !teams.length && !players.length && !playersQ.isFetching;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerRight: () => <Pressable onPress={() => router.back()} hitSlop={8}><Text style={{ color: t.accent, fontSize: 16 }}>Done</Text></Pressable> }} />

      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: t.card, borderColor: t.border }]}>
          <SymbolView name="magnifyingglass" tintColor={t.subtle} size={17} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search teams & players"
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

      {s === '' ? (
        <StateView kind="empty" title="Search" message="Find any team, or an NHL player by name." />
      ) : noResults ? (
        <StateView kind="empty" title="No matches" message={`Nothing found for “${s}”.`} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => ('league' in item ? `t-${item.id}` : `p-${item.id}`) + i}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <Text style={[styles.header, { color: t.sub }]}>{section.title.toUpperCase()}</Text>}
          renderItem={({ item }) => ('league' in item ? <TeamResult team={item} /> : <PlayerResult player={item} />)}
        />
      )}
    </View>
  );
}

function StarButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityLabel={on ? 'Remove favorite' : 'Add favorite'}>
      <SymbolView name={on ? 'star.fill' : 'star'} tintColor={on ? '#f5a623' : t.subtle} size={20} />
    </Pressable>
  );
}

function TeamResult({ team }: { team: TeamDirectoryEntry }) {
  const t = useTheme();
  const { isFavorite, toggle } = useFavorites();
  return (
    <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
      <Link href={{ pathname: '/teams/[teamId]', params: { teamId: team.id } }} asChild>
        <Pressable style={styles.main}>
          <TeamLogo uri={team.logo} darkUri={team.darkLogo} size={30} />
          <Text style={{ flex: 1, color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{team.name}</Text>
          <Text style={{ color: t.sub, fontSize: 12, fontWeight: '700' }}>{team.league}</Text>
        </Pressable>
      </Link>
      <StarButton on={isFavorite(team.id)} onPress={() => toggle(team.id)} />
    </View>
  );
}

function PlayerResult({ player }: { player: PlayerSearchResult }) {
  const t = useTheme();
  const { isFavoritePlayer, togglePlayer } = useFavorites();
  const pid = `nhl-${player.id}`;
  return (
    <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
      <Link href={{ pathname: '/players/[playerId]', params: { playerId: pid } }} asChild>
        <Pressable style={styles.main}>
          <View style={[styles.avatar, { backgroundColor: t.bg }]}>
            <SymbolView name="person.fill" tintColor={t.subtle} size={16} />
          </View>
          <Text style={{ flex: 1, color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{player.name}</Text>
          <Text style={{ color: t.sub, fontSize: 12, fontWeight: '700' }}>{[player.pos, player.teamAbbrev].filter(Boolean).join(' · ')}</Text>
        </Pressable>
      </Link>
      <StarButton on={isFavoritePlayer(pid)} onPress={() => togglePlayer(pid)} />
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10 },
  header: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginTop: 8, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
