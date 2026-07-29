import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { FavoritesProvider } from '@/lib/favorites';
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
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="teams/index" options={{ title: 'Teams' }} />
        <Stack.Screen name="teams/[teamId]" options={{ title: 'Team' }} />
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
        <FavoritesProvider>
          <RootNav />
        </FavoritesProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
}
