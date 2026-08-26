import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import { useFavorites } from '@/lib/favorites';
import { useLayout } from '@/lib/layout';
import { fetchAllTeams } from '@/lib/leagues';
import { useTheme } from '@/lib/theme';

// Horizontal strip of favorited-team chips at the top of Home, each linking to that team's page.
export function MyTeamsBar() {
  const t = useTheme();
  const { favorites } = useFavorites();
  const layout = useLayout();
  const q = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });

  if (!favorites.length) return null;
  const byId = new Map((q.data ?? []).map((tm) => [tm.id, tm]));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' }}
      contentContainerStyle={[styles.row, { paddingHorizontal: layout.gutter }]}
    >
      {favorites.map((id) => {
        const tm = byId.get(id);
        return (
          <Link key={id} href={{ pathname: '/teams/[teamId]', params: { teamId: id } }} asChild>
            <Pressable style={StyleSheet.flatten([styles.chip, { backgroundColor: t.card, borderColor: t.border }])}>
              <TeamLogo uri={tm?.logo} darkUri={tm?.darkLogo} size={20} />
              <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{tm?.abbr || id.toUpperCase()}</Text>
            </Pressable>
          </Link>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 6 },
});
