import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import type { ColorValue } from 'react-native';

import { HeaderActions } from '@/components/header-actions';
import { OmniHeader } from '@/components/omni-header';
import { useLayout } from '@/lib/layout';
import { LeagueContext, leagueColors, type LeagueId } from '@/lib/leagues';
import { useTheme } from '@/lib/theme';

function TabIcon({ name, color, size }: { name: SymbolViewProps['name']; color: ColorValue; size: number }) {
  return <SymbolView name={name} tintColor={color} size={size} type="hierarchical" />;
}

export default function TabsLayout() {
  const t = useTheme();
  const layout = useLayout();
  // Shared league selection across the content tabs (Scores/Standings/Stats/Teams).
  const [league, setLeague] = useState<LeagueId>('nhl');
  // Scores + Standings tint their chrome (header + tab bar) to the selected league; other tabs stay neutral.
  const chromeBg = leagueColors(league, t.mode === 'dark').bg;
  const leagueChrome = {
    headerStyle: { backgroundColor: chromeBg },
    headerShadowVisible: false,
    tabBarStyle: { backgroundColor: chromeBg },
  };

  return (
    <LeagueContext.Provider value={{ league, setLeague }}>
      <Tabs
        // On iPad the root rail is the navigation, so the tab bar renders nothing — these screens
        // are just the four destinations it points at. The phone keeps the bottom bar.
        {...(layout.regular ? { tabBar: () => null } : {})}
        screenOptions={{
          tabBarActiveTintColor: t.accent,
          tabBarInactiveTintColor: t.sub,
          headerTitle: () => <OmniHeader />,
          headerTitleAlign: 'left',
          headerRight: () => <HeaderActions />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Home', tabBarIcon: ({ color, size }) => <TabIcon name="house.fill" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="scores"
          options={{
            title: 'Scores',
            tabBarIcon: ({ color, size }) => <TabIcon name="sportscourt.fill" color={color} size={size} />,
            ...leagueChrome,
          }}
        />
        <Tabs.Screen
          name="standings"
          options={{
            title: 'Standings',
            tabBarIcon: ({ color, size }) => <TabIcon name="list.number" color={color} size={size} />,
            ...leagueChrome,
          }}
        />
        <Tabs.Screen
          name="news"
          options={{ title: 'News', tabBarIcon: ({ color, size }) => <TabIcon name="newspaper.fill" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="more"
          options={{ title: 'More', tabBarIcon: ({ color, size }) => <TabIcon name="ellipsis.circle.fill" color={color} size={size} /> }}
        />
      </Tabs>
    </LeagueContext.Provider>
  );
}
