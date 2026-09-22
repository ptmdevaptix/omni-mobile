import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import { leagueOf } from '@/lib/api';
import { useFavorites } from '@/lib/favorites';
import { CHL_MEMBER_LEAGUES, CJRA_MEMBER_LEAGUES, EURO_MEMBER_LEAGUES, useFollowedLeagues, type FollowTarget, type FollowedLeague } from '@/lib/followed-leagues';
import { fetchAllTeams } from '@/lib/leagues';
import { useTheme } from '@/lib/theme';
import { useProspectFollowActions } from '@/lib/use-follows';

// The controls for what Home shows: followed leagues and favorite teams. Sits at the BOTTOM of Home,
// as on the web — for a first-time user the slate above is one league and this is in view; for an
// established user it is a settings-grade control they touch rarely.
//
// Removing asks first (a native alert — this is iOS); adding is one tap.

/**
 * The leagues, grouped by what they actually are — mirroring GROUPS in the web's following-manager.
 *
 * Fourteen chips in one row is a list of acronyms: nothing tells a reader that the AHL and ECHL are
 * the same tier, or which of six four-letter leagues are the Canadian Junior A ones. The heading
 * carries that, so the section can be skimmed by tier rather than read end to end.
 *
 * `block` marks a group that can also be followed as one. The CHL and Canadian Jr A get an "All"
 * chip because nobody who wants a whole tier should have to tap three or six times — but the members
 * stay visible beside it, because a casual fan knows "WHL" long before they know "CHL", and six
 * leagues across five provinces are not interchangeable.
 */
type LeagueGroup = { label: string; block?: FollowTarget; members: readonly FollowedLeague[] };

const GROUPS: readonly LeagueGroup[] = [
  { label: 'NHL', members: ['NHL'] },
  // One tier: both are North American minor pro, which is why they share a colour on the cards too.
  { label: 'NA Minor Pro', members: ['AHL', 'ECHL'] },
  { label: 'College', members: ['NCAA'] },
  { label: 'Canadian Major Junior', block: 'CHL', members: CHL_MEMBER_LEAGUES },
  { label: 'US Junior', members: ['USHL'] },
  { label: 'Canadian Jr. A', block: 'CJRA', members: CJRA_MEMBER_LEAGUES },
  { label: 'Europe', block: 'EURO', members: EURO_MEMBER_LEAGUES },
];

const LABEL: Record<string, string> = {
  NHL: 'NHL', AHL: 'AHL', ECHL: 'ECHL', NCAA: 'NCAA', USHL: 'USHL',
  CHL: 'All', OHL: 'OHL', WHL: 'WHL', QMJHL: 'QMJHL',
  CJRA: 'All', BCHL: 'BCHL', AJHL: 'AJHL', SJHL: 'SJHL', MJHL: 'MJHL', OJHL: 'OJHL', CCHL: 'CCHL',
  EURO: 'All', SHL: 'SHL', LIIGA: 'Liiga', ELH: 'ELH',
};
// Spoken names for the accessible labels and the removal alert, where an acronym or a bare "All"
// would not say what is about to disappear.
const SPOKEN: Record<string, string> = {
  CHL: 'all CHL leagues',
  CJRA: 'all six Canadian Junior A leagues',
  BCHL: 'the BCHL', AJHL: 'the AJHL', SJHL: 'the SJHL',
  MJHL: 'the MJHL', OJHL: 'the OJHL', CCHL: 'the CCHL',
  EURO: 'all three European leagues', SHL: 'the SHL', LIIGA: 'Liiga', ELH: 'the Czech Extraliga',
};

export function FollowingPanel() {
  const t = useTheme();
  const router = useRouter();
  const { loaded, follow, unfollow, isFollowed } = useFollowedLeagues();
  const { favorites, favoriteTeams, removeFavoriteTeam } = useFavorites();
  const { isOn: prospectsOn, enable: enableProspects, disable: disableProspects } = useProspectFollowActions();
  const teamsQ = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });
  const byId = new Map((teamsQ.data ?? []).map((tm) => [tm.id, tm]));
  // Arrived from the "Follow prospects" notice: name the first NHL favorite whose prospects are not
  // followed yet, so the reader is pointed at the switch rather than dropped at the panel.
  const guide = useLocalSearchParams<{ guide?: string }>().guide === 'prospects';
  const guideTarget = guide ? favoriteTeams.find((f) => f.league === 'NHL' && !prospectsOn(f.id)) : undefined;

  if (!loaded) return null;

  // A favorite team's options, as a native sheet rather than the web's inline control: open the
  // page, and — for an NHL club — turn its prospect follow on or off; remove the team last.
  const teamOptions = (id: string) => {
    const tm = byId.get(id);
    const name = tm?.name ?? id.toUpperCase();
    const nhl = leagueOf(id) === 'NHL';
    const on = nhl && prospectsOn(id);
    Alert.alert(name, on ? 'Following its prospects' : undefined, [
      { text: 'Team page', onPress: () => router.push({ pathname: '/teams/[teamId]', params: { teamId: id } }) },
      ...(nhl ? [on
        ? { text: 'Stop following prospects', onPress: () => disableProspects(id) }
        : { text: 'Follow prospects', onPress: () => enableProspects(id) }] : []),
      { text: on ? 'Remove team & prospects' : 'Remove', style: 'destructive' as const, onPress: () => removeFavoriteTeam(id) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const askRemove = (target: FollowTarget) => {
    const what = SPOKEN[target] ?? LABEL[target];
    Alert.alert(`Remove ${what} from Home?`, undefined, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => unfollow(target) },
    ]);
  };

  const chip = (target: FollowTarget) => {
    const on = isFollowed(target);
    const label = LABEL[target];
    return (
      <Pressable
        key={target}
        onPress={() => (on ? askRemove(target) : follow(target))}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={on ? `${SPOKEN[target] ?? label}, following. Remove from Home` : `Add ${SPOKEN[target] ?? label} to Home`}
        style={[styles.chip, on ? { backgroundColor: t.accent, borderColor: t.accent } : { backgroundColor: t.card, borderColor: t.border }]}
      >
        <Text style={{ color: on ? t.onAccent : t.sub, fontSize: 13, fontWeight: on ? '800' : '600' }}>
          {on ? `${label}  ×` : `+ ${label}`}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.panel, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>Following</Text>
      <Text style={{ color: t.sub, fontSize: 12, marginTop: 2 }}>
        Home shows your favorite teams first, then the leagues you follow. Scores has every league.
      </Text>

      <Text style={[styles.label, { color: t.sub }]}>Leagues</Text>
      <View style={{ gap: 12 }}>
        {GROUPS.map((g) => (
          <View key={g.label} accessibilityRole="none" accessibilityLabel={`${g.label} leagues`}>
            <Text style={[styles.groupLabel, { color: t.sub }]}>{g.label}</Text>
            <View style={styles.wrap}>
              {g.block && chip(g.block)}
              {g.members.map((l) => chip(l))}
            </View>
          </View>
        ))}
      </View>

      <Text style={[styles.label, { color: t.sub }]}>Teams</Text>
      {/* The one feature nobody finds by looking, spelled out as steps where the steps happen. */}
      <View style={[styles.explainer, { borderColor: `${t.accent}66`, backgroundColor: `${t.accent}14` }]}>
        <Text style={{ color: '#f5a623', fontSize: 13 }}>★</Text>
        <Text style={{ color: t.sub, fontSize: 12, flex: 1, lineHeight: 17 }}>
          <Text style={{ color: t.text, fontWeight: '700' }}>Follow your favorite NHL team’s prospects.</Text>
          {' '}Add or tap your team below, then choose <Text style={{ color: t.text, fontWeight: '600' }}>Follow prospects</Text>. Its affiliates join your teams and its prospects’ games show wherever they play — a <Text style={{ color: t.text, fontWeight: '700' }}>+P</Text> on the team marks that you’re following its prospects.
          {guideTarget ? <Text style={{ color: t.accent, fontWeight: '700' }}>{` Tap ${byId.get(guideTarget.id)?.abbr ?? guideTarget.id.toUpperCase()} to start.`}</Text> : null}
        </Text>
      </View>
      {favorites.length === 0 ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: t.sub, fontSize: 14 }}>
            Add your favorite teams and their games lead this page, whatever league they play in.
          </Text>
          <Pressable
            onPress={() => router.push('/search' as never)}
            accessibilityRole="button"
            style={[styles.chip, { backgroundColor: t.accent, borderColor: t.accent, alignSelf: 'flex-start' }]}
          >
            <Text style={{ color: t.onAccent, fontSize: 13, fontWeight: '800' }}>Find a team</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.wrap}>
          {favoriteTeams.map((f) => {
            const id = f.id;
            const tm = byId.get(id);
            const on = f.league === 'NHL' && prospectsOn(id);
            const cued = guideTarget?.id === id;
            return (
              <Pressable
                key={id}
                onPress={() => teamOptions(id)}
                accessibilityRole="button"
                accessibilityLabel={on ? `${tm?.name ?? id} — prospects followed. Tap for options` : f.via ? `${tm?.name ?? id} — added by ${f.via.toUpperCase()} prospects. Tap for options` : `${tm?.name ?? id}. Tap for options`}
                style={[styles.chip, styles.teamChip, on ? { backgroundColor: t.accent, borderColor: t.accent } : { backgroundColor: t.bg, borderColor: cued ? t.accent : t.border, borderWidth: cued ? 1.5 : StyleSheet.hairlineWidth }]}
              >
                <TeamLogo uri={tm?.logo} darkUri={tm?.darkLogo} size={18} />
                <Text style={{ color: on ? t.onAccent : t.text, fontSize: 13, fontWeight: '700' }}>{tm?.abbr || id.toUpperCase()}</Text>
                {on ? <Text style={[styles.plusP, { color: t.onAccent, backgroundColor: 'rgba(0,0,0,0.18)' }]}>+P</Text> : null}
                {f.via ? <Text style={{ color: t.subtle, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }}>VIA {f.via.toUpperCase()}</Text> : null}
              </Pressable>
            );
          })}
          <Pressable onPress={() => router.push('/search' as never)} accessibilityRole="button" style={[styles.chip, { borderColor: t.border, borderStyle: 'dashed', borderWidth: 1 }]}>
            <Text style={{ color: t.sub, fontSize: 13, fontWeight: '600' }}>+ Add team</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/favorites' as never)} accessibilityRole="button" style={{ paddingHorizontal: 6, paddingVertical: 7 }}>
            <Text style={{ color: t.sub, fontSize: 13, textDecorationLine: 'underline' }}>Manage</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 20, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  explainer: { flexDirection: 'row', gap: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  plusP: { fontSize: 9, fontWeight: '800', borderRadius: 999, paddingHorizontal: 4, paddingVertical: 1, overflow: 'hidden', marginLeft: 2 },
  teamChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6 },
  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 6, opacity: 0.85 },
});
