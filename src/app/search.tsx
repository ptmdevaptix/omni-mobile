import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { useFavorites } from '@/lib/favorites';
import { fetchAllTeams, leagueRank, type TeamDirectoryEntry } from '@/lib/leagues';
import { searchPlayers } from '@/lib/player';
import { teamMatches } from '@/lib/team-search-terms';
import type { PlayerSearchResult } from '@/lib/player-types';
import { useTheme } from '@/lib/theme';

// Search teams (local filter of /all-teams) + players (NHL player-search API).
export default function SearchScreen() {
  const t = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  // Off by default, as on the web: a search is nearly always for someone playing now, and the
  // retired names would crowd out the live one.
  const [activeOnly, setActiveOnly] = useState(true);
  const s = q.trim();

  const teamsQ = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });
  const playersQ = useQuery({
    queryKey: ['player-search', s.toLowerCase(), activeOnly],
    queryFn: () => searchPlayers(s, activeOnly),
    enabled: s.length >= 2,
  });

  // A club is found by everything it could reasonably be typed as — its id, its name with the
  // abbreviations in it spelled out ("penn state", "western michigan"), and a short alias list for
  // the names that share no text with the stored one ("habs", "connecticut"). A plain substring test
  // over the displayed name found none of those.
  const teams = useMemo(() => {
    if (!s) return [] as TeamDirectoryEntry[];
    return (teamsQ.data ?? [])
      .filter((tm) => teamMatches({ id: tm.id, name: tm.name, abbr: tm.abbr ?? '' }, s))
      .sort((a, b) => leagueRank(a.league) - leagueRank(b.league) || a.name.localeCompare(b.name))
      .slice(0, 12);
  }, [s, teamsQ.data]);

  // Straight through, in the order the API returned. It ranks by relevance, then league tier, then
  // whether he is playing, then career games — sorting again here by `active` alone flattened all of
  // that, which is how Makar ended up below players nobody was looking for.
  const players = playersQ.data ?? [];

  // Tagged rather than sniffed by field: both a team and a player carry `league` now, so the old
  // `'league' in item` test filed every player as a team — no crest, and a tap that opened a team
  // page with an undefined id.
  type Hit = { kind: 'team'; team: TeamDirectoryEntry } | { kind: 'player'; player: PlayerSearchResult };
  const sections = [
    ...(teams.length ? [{ title: 'Teams', data: teams.map((team): Hit => ({ kind: 'team', team })) }] : []),
    ...(players.length ? [{ title: 'Players', data: players.map((player): Hit => ({ kind: 'player', player })) }] : []),
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

      {/* The switch belongs beside the results, not in settings: it is a property of this search. */}
      {s !== '' ? (
        <Pressable
          onPress={() => setActiveOnly((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: activeOnly }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={{
            width: 17, height: 17, borderRadius: 4, borderWidth: 1.5,
            borderColor: activeOnly ? t.accent : t.border,
            backgroundColor: activeOnly ? t.accent : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {activeOnly ? <SymbolView name="checkmark" tintColor="#fff" size={11} /> : null}
          </View>
          <Text style={{ color: t.sub, fontSize: 13 }}>Active players only</Text>
        </Pressable>
      ) : null}

      {s === '' ? (
        <StateView kind="empty" title="Search" message="Find any team, or a player by name." />
      ) : noResults ? (
        <StateView
          kind="empty"
          title="No matches"
          message={activeOnly ? `Nothing found for “${s}”. Turn off Active players only to include retired ones.` : `Nothing found for “${s}”.`}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => (item.kind === 'team' ? `t-${item.team.id}` : `p-${item.player.slug}`) + i}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <Text style={[styles.header, { color: t.sub }]}>{section.title.toUpperCase()}</Text>}
          renderItem={({ item }) => (item.kind === 'team' ? <TeamResult team={item.team} /> : <PlayerResult player={item.player} />)}
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

/**
 * The crest of the club he PLAYS for.
 *
 * A headshot loses to a crest at this size: every one is a head, centred, cropped identically, in a
 * jersey too small to read, so six of them tell you nothing while six crests tell you at a glance who
 * each player belongs to. The API sends `headshot: ""` for exactly that reason.
 *
 * Not the club that holds his rights: a Boston College crest beside a Bruins prospect is the fact a
 * reader is looking for. A club we carry no logo for shows its country's flag — HV71 is Swedish, and
 * a flag says that where a blank says nothing.
 *
 * Falling back: an NHL-tier player with no resolved club gets the league's own shield, because an
 * unsigned free agent belongs to nobody and "NHL, no club" is the actual fact. A junior wearing an
 * NHL shield would claim something untrue, so he gets his initials.
 */
function PlayerCrest({ name, club, teamAbbrev, league, size = 30 }: {
  name: string;
  club?: PlayerSearchResult['club'];
  teamAbbrev?: string;
  league?: string | null;
  size?: number;
}) {
  const t = useTheme();
  if (club?.logo) return <TeamLogo uri={club.logo} size={size} />;
  if (club?.flag) {
    return (
      <View style={[styles.avatar, { width: size, height: size }]}>
        <Text style={{ fontSize: size * 0.62 }}>{club.flag}</Text>
      </View>
    );
  }
  // Only when NO club resolved. Once one has, the crest of the club that holds his rights would put
  // an NHL mark beside a junior again — the thing this row exists to stop. A club we know but cannot
  // draw gets his initials.
  const abbr = (club ? '' : (teamAbbrev || (league === 'NHL' ? 'NHL' : ''))).trim().toUpperCase();
  if (abbr) {
    const svg = (variant: string) => `https://assets.nhle.com/logos/nhl/svg/${abbr}_${variant}.svg`;
    return <TeamLogo uri={svg('light')} darkUri={svg('dark')} size={size} />;
  }
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() || '?';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg }]}>
      <Text style={{ color: t.sub, fontSize: 12, fontWeight: '800' }}>{initials}</Text>
    </View>
  );
}

function PlayerResult({ player }: { player: PlayerSearchResult }) {
  const t = useTheme();
  const { isFavoritePlayer, togglePlayer } = useFavorites();
  // The slug IS the player page — /api/player resolves it directly, no nhl- prefix to rebuild.
  const pid = player.slug;
  const qualifier = [player.pos || null, player.number != null ? `#${player.number}` : null].filter(Boolean).join(' · ');
  const clubLeague = player.club?.league || player.league;
  return (
    <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
      <Link href={{ pathname: '/players/[playerId]', params: { playerId: pid } }} asChild>
        <Pressable style={styles.main}>
          <PlayerCrest name={player.name} club={player.club} teamAbbrev={player.teamAbbrev} league={player.league} />
          {/* Position and number sit against the name because they qualify IT — this is what tells
              one Jack Smith from another when the names and the crests both match. The name shrinks
              first: a clipped surname is still recognisable, half a number is not. */}
          <Text style={{ flexShrink: 1, color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{player.name}</Text>
          {qualifier ? <Text style={{ color: t.sub, fontSize: 12 }}>{qualifier}</Text> : null}
          <View style={{ flex: 1 }} />
          {/* The league he PLAYS in, which for a prospect is not the league that holds his rights.
              `league` is the tier the ranking sorted on — NHL for anyone an NHL club owns — and beside
              a Hamilton crest it read as a contradiction. The club's own league agrees with the mark. */}
          {clubLeague ? <Text style={{ color: t.sub, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 }} numberOfLines={1}>{clubLeague.toUpperCase()}</Text> : null}
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
