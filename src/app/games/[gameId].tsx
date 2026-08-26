import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { GameDetailBody, useGameDetail } from '@/components/game/game-detail';
import { useTheme } from '@/lib/theme';

// Full-screen game detail (phone push navigation, and iPad when opened outside the Scores split
// view). The body lives in components/game/game-detail.tsx so the split view can embed it.
export default function GameScreen() {
  const t = useTheme();
  const { gameId, away, home } = useLocalSearchParams<{ gameId: string; away?: string; home?: string }>();
  // Same query key as the body's — React Query serves both from one fetch.
  const g = useGameDetail(gameId).data;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: g ? `${g.awayTeam.abbr} @ ${g.homeTeam.abbr}` : 'Game' }} />
      <GameDetailBody gameId={gameId} away={away} home={home} />
    </View>
  );
}
