import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { leagueOf } from '@/lib/api';
import { useFavorites } from '@/lib/favorites';
import { fetchAllTeams, type TeamDirectoryEntry } from '@/lib/leagues';
import { fetchPlayer } from '@/lib/player';
import { useTheme } from '@/lib/theme';

type FavTeam = { id: string; name: string; logo?: string; darkLogo?: string; league: string };
type Item = { kind: 'team'; team: FavTeam } | { kind: 'player'; id: string };

export default function FavoritesScreen() {
  const t = useTheme();
  const { favorites, favoritePlayers } = useFavorites();
  const q = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });

  const teams = useMemo<FavTeam[]>(() => {
    const byId = new Map<string, TeamDirectoryEntry>((q.data ?? []).map((tm) => [tm.id, tm]));
    return favorites.map((id) => {
      const tm = byId.get(id);
      return tm ? { id, name: tm.name, logo: tm.logo, darkLogo: tm.darkLogo, league: tm.league } : { id, name: id, league: leagueOf(id) };
    });
  }, [favorites, q.data]);

  const sections = [
    ...(teams.length ? [{ title: 'Teams', data: teams.map((team) => ({ kind: 'team', team }) as Item) }] : []),
    ...(favoritePlayers.length ? [{ title: 'Players', data: favoritePlayers.map((id) => ({ kind: 'player', id }) as Item) }] : []),
  ];

  if (!favorites.length && !favoritePlayers.length) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <StateView kind="empty" title="No favorites yet" message="Tap the ★ on any team or player to add it here." />
      </View>
    );
  }

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      sections={sections}
      keyExtractor={(item) => (item.kind === 'team' ? `t-${item.team.id}` : `p-${item.id}`)}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => <Text style={[styles.header, { color: t.sub }]}>{section.title.toUpperCase()}</Text>}
      renderItem={({ item }) => (item.kind === 'team' ? <FavTeamRow team={item.team} /> : <FavPlayerRow id={item.id} />)}
    />
  );
}

function FavTeamRow({ team }: { team: FavTeam }) {
  const t = useTheme();
  const { toggle } = useFavorites();
  return (
    <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
      <Link href={{ pathname: '/teams/[teamId]', params: { teamId: team.id } }} asChild>
        <Pressable style={styles.main}>
          <TeamLogo uri={team.logo} darkUri={team.darkLogo} size={30} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{team.name}</Text>
            {team.league ? <Text style={{ color: t.sub, fontSize: 12 }}>{team.league}</Text> : null}
          </View>
        </Pressable>
      </Link>
      <Pressable onPress={() => toggle(team.id)} hitSlop={10} accessibilityLabel="Remove favorite">
        <SymbolView name="star.fill" tintColor="#f5a623" size={22} />
      </Pressable>
    </View>
  );
}

function FavPlayerRow({ id }: { id: string }) {
  const t = useTheme();
  const { togglePlayer } = useFavorites();
  const q = useQuery({ queryKey: ['player', id], queryFn: () => fetchPlayer(id) });
  const p = q.data;
  const name = p?.fullName ?? '…';
  const sub = p ? [p.position, p.teamAbbrev].filter(Boolean).join(' · ') : '';
  return (
    <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
      <Link href={{ pathname: '/players/[playerId]', params: { playerId: id } }} asChild>
        <Pressable style={styles.main}>
          {p?.headshot ? (
            <Image source={{ uri: p.headshot }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: t.bg }]}>
              <SymbolView name="person.fill" tintColor={t.subtle} size={16} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{name}</Text>
            {sub ? <Text style={{ color: t.sub, fontSize: 12 }}>{sub}</Text> : null}
          </View>
        </Pressable>
      </Link>
      <Pressable onPress={() => togglePlayer(id)} hitSlop={10} accessibilityLabel="Remove favorite">
        <SymbolView name="star.fill" tintColor="#f5a623" size={22} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginTop: 8, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
});
