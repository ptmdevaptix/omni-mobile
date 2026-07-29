import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import type { ColorValue } from 'react-native';

import { HeaderActions } from '@/components/header-actions';
import { OmniHeader } from '@/components/omni-header';
import { LeagueContext, type LeagueId } from '@/lib/leagues';
import { useTheme } from '@/lib/theme';

function TabIcon({ name, color, size }: { name: SymbolViewProps['name']; color: ColorValue; size: number }) {
  return <SymbolView name={name} tintColor={color} size={size} type="hierarchical" />;
}

export default function TabsLayout() {
  const t = useTheme();
  // Shared league selection across the content tabs (Scores/Standings/Stats/Teams).
  const [league, setLeague] = useState<LeagueId>('nhl');

  return (
    <LeagueContext.Provider value={{ league, setLeague }}>
      <Tabs
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
          options={{ title: 'Scores', tabBarIcon: ({ color, size }) => <TabIcon name="sportscourt.fill" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="standings"
          options={{ title: 'Standings', tabBarIcon: ({ color, size }) => <TabIcon name="list.number" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="stats"
          options={{ title: 'Stats', tabBarIcon: ({ color, size }) => <TabIcon name="chart.bar.fill" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="more"
          options={{ title: 'More', tabBarIcon: ({ color, size }) => <TabIcon name="ellipsis.circle.fill" color={color} size={size} /> }}
        />
      </Tabs>
    </LeagueContext.Provider>
  );
}
