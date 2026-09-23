import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { resolveLogo } from '@/lib/api';
import { flagBadgeColors, leagueCountry } from '@/lib/country-flags';
import { leagueById, type LeagueId } from '@/lib/leagues';
import { useTheme } from '@/lib/theme';

/**
 * The mark beside a league's name in a list of games: its own logo where one exists, and otherwise
 * a shield in its country's flag colours.
 *
 * The ECHL, the six Canadian Jr A leagues and the three European ones have no mark we can use. For
 * the European three the flag is the useful signal anyway — three leagues named by three-letter
 * codes are told apart faster by blue-and-yellow against blue-white-red than by reading them.
 *
 * Drawn as bands in a rounded box rather than a real shield: the app carries no SVG renderer, and a
 * band says the same thing.
 */
export function LeagueBadge({ league, size = 18 }: { league: LeagueId | string; size?: number }) {
  const t = useTheme();
  const cfg = leagueById(league as LeagueId);
  const known = cfg.id === league;
  const uri = known ? resolveLogo(cfg.logoUrl) : undefined;
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size }} contentFit="contain" />;

  const bands = flagBadgeColors(leagueCountry(known ? cfg.label : String(league)));
  if (!bands) return null;
  return (
    <View
      style={{
        width: size, height: size, borderRadius: 4, overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
        flexDirection: 'row',
      }}>
      {bands.map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}
    </View>
  );
}
