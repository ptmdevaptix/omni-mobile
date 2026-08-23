import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { CompactModeProvider } from '@/lib/compact';
import { FavoritesProvider } from '@/lib/favorites';
import { NotificationPrefsProvider } from '@/lib/notification-prefs';
import { queryClient } from '@/lib/query';
import { ThemeModeProvider, navTheme, useThemeMode } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

// Bridge React Native's AppState to React Query's focus manager: queries refetch when the app
// returns to the foreground, and live-polling intervals pause while backgrounded.
function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === 'active');
}

function RootNav() {
  const { scheme } = useThemeMode();
  return (
    <ThemeProvider value={navTheme(scheme)}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="teams/index" options={{ title: 'Teams' }} />
        <Stack.Screen name="teams/[teamId]" options={{ title: 'Team' }} />
        <Stack.Screen name="games/[gameId]" options={{ title: 'Game' }} />
        <Stack.Screen name="players/[playerId]" options={{ title: 'Player' }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
        <Stack.Screen name="favorites" options={{ title: 'Favorites' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="leaders" options={{ title: 'Leaders' }} />
        <Stack.Screen name="info/[slug]" options={{ title: 'Info' }} />
        <Stack.Screen name="search" options={{ title: 'Search', presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <CompactModeProvider>
          <FavoritesProvider>
            <NotificationPrefsProvider>
              <RootNav />
            </NotificationPrefsProvider>
          </FavoritesProvider>
        </CompactModeProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
}
