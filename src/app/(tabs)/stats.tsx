import { View } from 'react-native';

import { LeaguePicker } from '@/components/league-picker';
import { StateView } from '@/components/state-view';
import { useTheme } from '@/lib/theme';

// Phase 2: skater/goalie leaders per league (/nhl-stats, /ahl-stats, /chl-stats/{league}, /ncaa-stats).
export default function StatsScreen() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <LeaguePicker />
      <StateView kind="empty" title="Leaders coming soon" message="Skater & goalie leaders land in the next phase." />
    </View>
  );
}
