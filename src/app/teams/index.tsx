import { View } from 'react-native';

import { StateView } from '@/components/state-view';
import { useTheme } from '@/lib/theme';

// Team browser (reached from More). Phase 3: directory per league + favorites; search already exists in
// the header. Kept out of the tab bar per the nav design.
export default function TeamsBrowserScreen() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StateView kind="empty" title="Team browser coming soon" message="For now, use the search icon to find any team." />
    </View>
  );
}
