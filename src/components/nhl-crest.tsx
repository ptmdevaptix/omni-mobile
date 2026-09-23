import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import { NHL_TEAM_NAMES } from '@/lib/nhl-teams';

/**
 * The crest of the NHL club holding a junior or college player's rights, shown beside his name on a
 * roster. It is a handful of players on any one roster, so it rides inline rather than earning a
 * column that would charge every row for empty space.
 *
 * The CDN carries CURRENT clubs only, so an abbreviation it does not know (a defunct or
 * pre-relocation club) falls back to the league's own mark rather than a broken image. TeamLogo
 * already applies the NHL's 1.5x correction, so the crest matches other leagues' logos in the box.
 */
export function NhlCrest({ abbr, size = 16 }: { abbr: string; size?: number }) {
  const A = abbr.trim().toUpperCase();
  const known = A in NHL_TEAM_NAMES;
  const code = known ? A : 'NHL';
  const mark = (
    <TeamLogo
      uri={`https://assets.nhle.com/logos/nhl/svg/${code}_light.svg`}
      darkUri={`https://assets.nhle.com/logos/nhl/svg/${code}_dark.svg`}
      size={size}
    />
  );
  if (!known) return <View accessibilityLabel={`NHL rights: ${A}`}>{mark}</View>;
  return (
    <Link href={{ pathname: '/teams/[teamId]', params: { teamId: A.toLowerCase() } }} asChild>
      <Pressable accessibilityLabel={`NHL rights: ${A}`} hitSlop={6}>{mark}</Pressable>
    </Link>
  );
}
