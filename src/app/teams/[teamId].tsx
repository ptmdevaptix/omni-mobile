import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProspectFollowToggle } from '@/components/prospect-follow-toggle';
import { StateView } from '@/components/state-view';
import { TeamHome } from '@/components/team/team-home';
import { TeamNews } from '@/components/team/team-news';
import { TeamProspects } from '@/components/team/team-prospects';
import { TeamRoster } from '@/components/team/team-roster';
import { TeamSchedule } from '@/components/team/team-schedule';
import { TeamStats } from '@/components/team/team-stats';
import { TeamTabsBar } from '@/components/team/team-tabs-bar';
import { TeamLogo } from '@/components/team-logo';
import { api, displayLeagueOf, leagueOf, teamHeaderPath } from '@/lib/api';
import { useFavorites } from '@/lib/favorites';
import { fetchTeamLookup, teamTabs, type AffiliateRef, type TeamTab } from '@/lib/team';
import { composeTeamName, shortTeamName } from '@/lib/team-name';
import { teamLinkLabel, useTeamLinks } from '@/lib/team-links';
import { useTheme } from '@/lib/theme';
import type { TeamHeader } from '@/lib/types';

/** The iOS navigation bar's own height, under the status bar. Fixed on a phone. */
const NAV_ROW = 44;
/** Clearance for the round grounds iOS draws the back button and the star on. */
const SIDE_CLEAR = 62;
const CREST = 30;
const CREST_GAP = 10;

export default function TeamScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { isFavorite, toggle } = useFavorites();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();

  const tabs = teamTabs(teamId);
  const [tab, setTab] = useState<TeamTab>(tabs[0]);
  // How wide the band is, and whether the club's full name fits across it.
  const [bandWidth, setBandWidth] = useState(0);
  const [nameFits, setNameFits] = useState(true);

  const q = useQuery({ queryKey: ['team-header', teamId], queryFn: () => api<TeamHeader>(teamHeaderPath(teamId)) });
  const team = q.data;
  const links = useTeamLinks(teamId);
  // The club's colours and its affiliates: on the registry, not on any league's header endpoint.
  const lookup = useQuery({ queryKey: ['team-lookup', teamId], queryFn: () => fetchTeamLookup(teamId), staleTime: 60 * 60_000 });
  const primary = lookup.data?.colors?.primary;
  const aff = lookup.data?.affiliates;
  // The org's other clubs, in tier order. An NHL club names its AHL and ECHL sides; they name it back.
  const affiliates: [string, AffiliateRef][] = [
    ...(aff?.nhl ? ([['NHL', aff.nhl]] as [string, AffiliateRef][]) : []),
    ...(aff?.ahl ? ([['AHL', aff.ahl]] as [string, AffiliateRef][]) : []),
    ...((aff?.echl ?? []).map((a) => ['ECHL', a] as [string, AffiliateRef])),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* The bar is transparent and empty, so the club's colour runs to the top of the screen and
          the club's own name sits in the band the abbreviation used to have to itself. The star
          takes the far side of that band, where there is nothing else. */}
      <Stack.Screen
        options={{
          title: '',
          headerTransparent: true,
          headerShadowVisible: false,
          headerRight: () =>
            team ? (
              <Pressable onPress={() => toggle(teamId)} hitSlop={10} accessibilityLabel={isFavorite(teamId) ? 'Remove favorite' : 'Add favorite'}>
                <SymbolView name={isFavorite(teamId) ? 'star.fill' : 'star'} tintColor={isFavorite(teamId) ? '#f5a623' : t.subtle} size={24} />
              </Pressable>
            ) : null,
        }}
      />

      {q.isError ? (
        <StateView kind="error" message="Couldn’t load this team." onRetry={() => q.refetch()} />
      ) : !team ? (
        <StateView kind="loading" />
      ) : (
        <>
          <View style={[styles.hero, { borderColor: t.border, paddingTop: insets.top }]}>
            {/* The club's own colour behind its name, as the web's header wears it — a wash rather
                than a block, so the text above keeps the contrast the rest of the app has. No crest
                watermark: it landed under the ★, and the crest is already beside the name. */}
            {primary ? (
              <LinearGradient
                colors={[`${primary}${t.mode === 'dark' ? '59' : '2E'}`, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            ) : null}
            {/* Crest and name ride in the navigation band itself, inset past the back chevron on one
                side and the star on the other. That is the row the page used to spend on "NYI". */}
            <View style={styles.identity} onLayout={(e) => setBandWidth(e.nativeEvent.layout.width)}>
              {team.logo ? <TeamLogo uri={team.logo} size={CREST} /> : null}
              {/* A club whose nickname IS its place — HV71, Färjestad BK — is named once. Where the
                  full name is too long for the band — "Notre Dame Fighting Irish" — it falls back to
                  the app's short name for a club: the nickname in the NHL, the place everywhere
                  else, and the single name it has when place and nickname are the same or one of
                  them is missing. Truncating to "Notre Dame Fighting Ir…" would say less in the same
                  room. */}
              {/* Shortening comes first and happens at full size — a name shrunk to fit reads as a
                  mistake long before it becomes unreadable. The small scale below is only a guard for
                  a club whose SHORT name is also too wide; the real fix for one of those is an entry
                  in SHORT_NAME_OVERRIDES, which is how Wilkes-Barre/Scranton is handled. */}
              <Text style={[nameStyle, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.88}>
                {nameFits
                  ? composeTeamName(team.name, team.nickname)
                  : shortTeamName(
                      teamId,
                      { location: team.name, nickname: team.nickname, name: composeTeamName(team.name, team.nickname), abbr: team.abbr },
                      leagueOf(teamId) === 'NHL',
                    )}
              </Text>
              {/* Measured rather than guessed from a character count: names are not equally wide, and
                  the band is a different size on every phone. Invisible, and laid out at exactly the
                  width the visible name has, so two lines means the one line would have been cut. */}
              {bandWidth > 0 ? (
                <Text
                  style={[nameStyle, styles.measure, { width: bandWidth - SIDE_CLEAR * 2 - (team.logo ? CREST + CREST_GAP : 0) }]}
                  numberOfLines={2}
                  pointerEvents="none"
                  onTextLayout={(e) => setNameFits(e.nativeEvent.lines.length <= 1)}>
                  {composeTeamName(team.name, team.nickname)}
                </Text>
              ) : null}
            </View>

            <View style={{ paddingHorizontal: 16, alignItems: 'center' }}>
              <Text style={{ color: t.sub, fontSize: 13, textAlign: 'center' }} numberOfLines={1}>
                {/* A league with no divisions files each club under the league's own name
                    ("SHL · SHL"); the second copy says nothing. */}
                {[
                  displayLeagueOf(teamId),
                  team.division?.toUpperCase() === displayLeagueOf(teamId) ? null : team.division,
                  team.record,
                  // The points the record earned — the number a standings reader looks for next.
                  team.points != null ? `${team.points} pts` : null,
                ].filter(Boolean).join(' · ')}
              </Text>
              {/* Rendered from the array, so a new linkType is a seeder change and needs no edit here.
                  Empty while loading AND when a club has no verified links — both render nothing,
                  deliberately: an unverified club shows no link rather than a guessed one. */}
              {/* The prospect switch, for an NHL club: its affiliates join your teams and its
                  prospects' games ride with your favorites (docs/design/prospect-follows.md). */}
              {leagueOf(teamId) === 'NHL' ? <View style={{ marginTop: 6, alignItems: 'center' }}><ProspectFollowToggle team={teamId} /></View> : null}
              {/* The org's other clubs, each a tap away: an NHL club's farm teams, or the parent of
                  a club that has one. The web gives these a line each; one wrapping row fits a phone. */}
              {affiliates.length > 0 ? (
                <View style={styles.affRow}>
                  {affiliates.map(([tier, a]) => (
                    <Link key={`${tier}-${a.id}`} href={{ pathname: '/teams/[teamId]', params: { teamId: a.id } }} asChild>
                      <Pressable style={styles.affChip} accessibilityRole="link" accessibilityLabel={`${tier} affiliate: ${a.name}`}>
                        <Text style={{ color: t.subtle, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 }}>{tier}</Text>
                        <TeamLogo uri={a.logo} size={14} />
                        <Text style={{ color: t.sub, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{a.location || a.name}</Text>
                      </Pressable>
                    </Link>
                  ))}
                </View>
              ) : null}
              {links.length > 0 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 5 }}>
                  {links.map((link) => (
                    <Pressable
                      key={link.linkType}
                      onPress={() => Linking.openURL(link.url)}
                      hitSlop={8}
                      accessibilityRole="link"
                      accessibilityLabel={`${team.name} ${link.linkType === 'web' ? 'official site' : `on ${link.linkType}`}`}
                    >
                      <Text style={{ color: t.accent, fontSize: 12, fontWeight: '600' }}>{teamLinkLabel(link)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          <TeamTabsBar tabs={tabs} value={tab} onChange={setTab} />

          <View style={{ flex: 1 }}>
            {tab === 'home' ? <TeamHome teamId={teamId} />
              : tab === 'schedule' ? <TeamSchedule teamId={teamId} />
              : tab === 'roster' ? <TeamRoster teamId={teamId} />
              : tab === 'stats' ? <TeamStats teamId={teamId} />
              : tab === 'news' ? <TeamNews teamId={teamId} />
              : <TeamProspects teamId={teamId} />}
          </View>
        </>
      )}
    </View>
  );
}

const nameStyle = { fontSize: 19, fontWeight: '800' as const, flexShrink: 1 };

const styles = StyleSheet.create({
  affRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  affChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // overflow hidden so the colour wash and the crest watermark stop at the header's own edge.
  // A column now, not a row: the first line shares the navigation band and the rest runs full width.
  // overflow hidden so the colour wash stops at the header's own edge.
  hero: { paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  // Centred, with equal clearance for the two controls already in that band: iOS draws each of them
  // on a round ground about 40pt across, not as a bare glyph, so the clearance is the circle's.
  // Centring is also what keeps the name off them — it grows from the middle outwards, not into one.
  identity: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: CREST_GAP, height: NAV_ROW, paddingHorizontal: SIDE_CLEAR },
  measure: { position: 'absolute', opacity: 0, left: 0, top: 0 },
});
