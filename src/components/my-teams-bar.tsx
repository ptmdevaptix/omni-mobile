import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';


import { TeamLogo } from '@/components/team-logo';
import { useFavorites } from '@/lib/favorites';
import { fetchAllTeams } from '@/lib/leagues';
import { forgetTeamsExcept, rememberTeams, useTeamIdentity } from '@/lib/team-identity';
import { useTheme } from '@/lib/theme';

const SHOW_AFFILIATES_KEY = 'myTeamsAffiliates';

// Horizontal strip of favorited-team chips at the top of Home, each linking to that team's page.
export function MyTeamsBar() {
  const t = useTheme();
  const { favorites, favoriteTeams } = useFavorites();
  const q = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });
  // What these clubs looked like last launch, so the chips are not an id and an empty square for as
  // long as the directory takes to answer.
  const { identity } = useTeamIdentity();
  // Affiliates a prospect switch added (tagged `via`) fold away by default: a fan who followed the
  // Islanders' prospects did not pick Bridgeport and Worcester, and two extra chips per NHL club
  // would crowd out the teams they did. One pill unfolds them; the choice is remembered.
  const [showAffiliates, setShowAffiliates] = useState(false);
  useEffect(() => { AsyncStorage.getItem(SHOW_AFFILIATES_KEY).then((v) => { if (v === '1') setShowAffiliates(true); }).catch(() => {}); }, []);
  const toggleAffiliates = () => { const next = !showAffiliates; setShowAffiliates(next); AsyncStorage.setItem(SHOW_AFFILIATES_KEY, next ? '1' : '0').catch(() => {}); };
  const affiliates = favoriteTeams.filter((f) => f.via).length;
  const shown = showAffiliates ? favorites : favoriteTeams.filter((f) => !f.via).map((f) => f.id);

  const byId = new Map((q.data ?? []).map((tm) => [tm.id, tm]));

  // Whenever the directory answers, write down the clubs the reader follows and drop the ones he no
  // longer does. Keyed on the favorites list and the directory, so it runs when either changes.
  useEffect(() => {
    if (!q.data?.length || !favorites.length) return;
    const mine: Record<string, { abbr?: string; name?: string; logo?: string; darkLogo?: string }> = {};
    for (const id of favorites) {
      const tm = byId.get(id);
      if (tm) mine[id] = { abbr: tm.abbr, name: tm.name, logo: tm.logo, darkLogo: tm.darkLogo };
    }
    rememberTeams(mine);
    forgetTeamsExcept(favorites);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, favorites.join(',')]);

  // Empty: one chip that says what the strip is for and opens the Following screen, as the web's
  // strip does — a blank band said nothing, and the callout below it only shows to a brand-new reader.
  if (!favorites.length) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.row}>
        <Link href={'/following' as never} asChild>
          <Pressable style={StyleSheet.flatten([styles.chip, { backgroundColor: t.card, borderColor: t.border }])} accessibilityRole="button">
            <Text style={{ color: '#f5a623', fontSize: 13 }}>★</Text>
            <Text style={{ color: t.sub, fontSize: 13, fontWeight: '600' }}>Add your favorite teams</Text>
          </Pressable>
        </Link>
      </ScrollView>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.row}>
      {shown.map((id) => {
        // The live directory is the authority; the remembered copy only fills the gap before it lands.
        const tm = byId.get(id) ?? identity(id);
        return (
          <Link key={id} href={{ pathname: '/teams/[teamId]', params: { teamId: id } }} asChild>
            <Pressable style={StyleSheet.flatten([styles.chip, { backgroundColor: t.card, borderColor: t.border }])}>
              <TeamLogo uri={tm?.logo} darkUri={tm?.darkLogo} size={20} />
              <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{tm?.abbr || id.toUpperCase()}</Text>
            </Pressable>
          </Link>
        );
      })}
      {affiliates > 0 ? (
        <Pressable onPress={toggleAffiliates} accessibilityRole="button" accessibilityState={{ expanded: showAffiliates }} style={[styles.chip, { borderColor: t.border, borderStyle: 'dashed', borderWidth: 1 }]}>
          <Text style={{ color: t.sub, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 }}>{showAffiliates ? 'HIDE AFFILIATES' : `+${affiliates} AFFILIATES`}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 6 },
});
