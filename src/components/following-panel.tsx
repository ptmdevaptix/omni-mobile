import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import { useFavorites } from '@/lib/favorites';
import { CHL_MEMBER_LEAGUES, useFollowedLeagues, type FollowTarget } from '@/lib/followed-leagues';
import { fetchAllTeams, homeLeagueOrder } from '@/lib/leagues';
import { useTheme } from '@/lib/theme';

// The controls for what Home shows: followed leagues and favorite teams. Sits at the BOTTOM of Home,
// as on the web — for a first-time user the slate above is one league and this is in view; for an
// established user it is a settings-grade control they touch rarely.
//
// The CHL is a cluster — All · OHL · WHL · QMJHL — always expanded: a casual fan knows "WHL" long
// before they know "CHL", so the member leagues have to be visible on the row.
//
// Removing asks first (a native alert — this is iOS); adding is one tap.

const LABEL: Record<string, string> = { NHL: 'NHL', AHL: 'AHL', ECHL: 'ECHL', NCAA: 'NCAA', USHL: 'USHL', CHL: 'All', OHL: 'OHL', WHL: 'WHL', QMJHL: 'QMJHL' };
const SPOKEN: Record<string, string> = { CHL: 'all CHL leagues' };

export function FollowingPanel() {
  const t = useTheme();
  const router = useRouter();
  const { followed, loaded, follow, unfollow, isFollowed } = useFollowedLeagues();
  const { favorites } = useFavorites();
  const teamsQ = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });
  const byId = new Map((teamsQ.data ?? []).map((tm) => [tm.id, tm]));

  if (!loaded) return null;

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

  // Top-level order by region (the CHL block sits where its member leagues would).
  const seen = new Set<string>();
  const tops: string[] = [];
  for (const lg of homeLeagueOrder()) {
    const top = (CHL_MEMBER_LEAGUES as readonly string[]).includes(lg) ? 'CHL' : lg;
    if (!seen.has(top)) { seen.add(top); tops.push(top); }
  }

  return (
    <View style={[styles.panel, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>Following</Text>
      <Text style={{ color: t.sub, fontSize: 12, marginTop: 2 }}>
        Home shows your favorite teams first, then the leagues you follow. Scores has every league.
      </Text>

      <Text style={[styles.label, { color: t.sub }]}>Leagues</Text>
      <View style={styles.wrap}>
        {tops.map((top) =>
          top !== 'CHL' ? chip(top as FollowTarget) : (
            <View key="chl" style={[styles.cluster, { borderColor: t.border }]} accessibilityRole="none" accessibilityLabel="CHL leagues">
              <Text style={{ color: t.sub, fontSize: 12, fontWeight: '800', marginLeft: 6 }}>CHL</Text>
              {chip('CHL')}
              {CHL_MEMBER_LEAGUES.map((l) => chip(l))}
            </View>
          ),
        )}
      </View>

      <Text style={[styles.label, { color: t.sub }]}>Teams</Text>
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
          {favorites.map((id) => {
            const tm = byId.get(id);
            return (
              <Link key={id} href={{ pathname: '/teams/[teamId]', params: { teamId: id } }} asChild>
                <Pressable style={StyleSheet.flatten([styles.chip, styles.teamChip, { backgroundColor: t.bg, borderColor: t.border }])}>
                  <TeamLogo uri={tm?.logo} darkUri={tm?.darkLogo} size={18} />
                  <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{tm?.abbr || id.toUpperCase()}</Text>
                </Pressable>
              </Link>
            );
          })}
          <Pressable onPress={() => router.push('/search' as never)} accessibilityRole="button" style={[styles.chip, { borderColor: t.border, borderStyle: 'dashed' }]}>
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
  teamChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6 },
  cluster: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', padding: 4 },
});
