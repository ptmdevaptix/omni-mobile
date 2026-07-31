import { View } from 'react-native';

import { StateView } from '@/components/state-view';
import { useTheme } from '@/lib/theme';

// Reached from More → Leaders (moved out of the tab bar). Skater/goalie leaders per league land here.
export default function LeadersScreen() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StateView kind="empty" title="Leaders coming soon" message="Skater & goalie leaders per league will land here." />
    </View>
  );
}
