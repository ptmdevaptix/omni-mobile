import { ScrollView } from 'react-native';

import { FollowingPanel } from '@/components/following-panel';
import { useTheme } from '@/lib/theme';

/**
 * What Home shows: followed leagues and favourite teams.
 *
 * This lived at the bottom of Home, and "Customize" scrolled you to it. That worked while it was
 * eight chips in one row; it is now fourteen across six groups, and a control that takes a screen and
 * a half of scrolling to reach is not a control anyone uses twice.
 *
 * A pushed screen rather than a sheet, for two reasons. The panel links OUT — every favourite team is
 * a link to its page, and "Find a team" opens search — and following a link out of a modal means
 * dismissing it first, which is the kind of small wrongness people feel without being able to name.
 * And Favorites is already a screen reached from More, so this matches the shape the app already has
 * rather than introducing a second idea of where preferences live.
 *
 * (If a sheet is wanted later it is one option on the Stack.Screen — `presentation: 'modal'` — not a
 * rewrite. The panel does not care what contains it.)
 */
export default function FollowingScreen() {
  const t = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <FollowingPanel />
    </ScrollView>
  );
}
