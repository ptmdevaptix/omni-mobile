import { Text, View } from 'react-native';

import { LeagueBadge } from '@/components/league-badge';
import { LEAGUES } from '@/lib/leagues';
import { useTheme } from '@/lib/theme';

/**
 * A run's sub-heading inside a list section — the member leagues under a block, NCAA conferences
 * under the NCAA.
 *
 * When the heading names a league it carries that league's mark, because three-letter codes on their
 * own are slow to tell apart: SHL, Liiga and ELH are a wall of initials until the flags are there.
 */
export function SubHeading({ title }: { title: string }) {
  const t = useTheme();
  const league = LEAGUES.find((l) => l.label.toLowerCase() === title.trim().toLowerCase())?.id;
  const label = (
    <Text style={{ color: t.subtle, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
      {title}
    </Text>
  );
  if (!league) return <View style={{ marginTop: 4, marginBottom: 2 }}>{label}</View>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 2 }}>
      <LeagueBadge league={league} size={16} />
      {label}
    </View>
  );
}
