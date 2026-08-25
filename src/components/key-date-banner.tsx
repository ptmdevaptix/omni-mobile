import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { dayKey } from '@/lib/format';
import { useTheme } from '@/lib/theme';

// "NHL rookie camps open Sep 11, main camps open Sep 17" — the same line the web header shows, from
// the same source. The phrasing and the calendar both live server-side (lib/key-date-message), so this
// app doesn't carry a second copy of either to drift out of date.
//
// Renders nothing once the season is underway, which is when the scoreboard has real games to show.

const LOGO = 'https://omnihockey.com/nhl-logo.svg';

export function KeyDateBanner() {
  const t = useTheme();
  // The device's date, not the server's: it answers a "what's today" question, and the API runs in UTC.
  const today = dayKey();

  const q = useQuery({
    queryKey: ['key-dates', 'NHL', today],
    queryFn: () => api<{ message: { headline: string; date: string } | null }>(`/key-dates?league=NHL&today=${today}`),
    staleTime: 6 * 3600_000,
  });

  const headline = q.data?.message?.headline;
  if (!headline) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: t.card, borderColor: t.border }]}>
      <Image source={{ uri: LOGO }} style={styles.logo} contentFit="contain" transition={0} />
      {/* One line, always. Later phases of the calendar produce longer lines than the current one
          ("preseason underway — regular season begins Oct 2"), so rather than tune the copy to a
          width it can't be held to, the text shrinks a little when it has to. Never truncates. */}
      <Text
        style={{ color: t.text, fontSize: 13, fontWeight: '600', flexShrink: 1 }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        {headline}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  logo: { width: 18, height: 18 },
});
