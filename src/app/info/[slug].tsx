import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Markdown } from '@/components/markdown';
import { StateView } from '@/components/state-view';
import { fetchSiteContent } from '@/lib/content';
import { useTheme } from '@/lib/theme';

export default function InfoScreen() {
  const t = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useQuery({ queryKey: ['site-content', slug], queryFn: () => fetchSiteContent(slug), staleTime: 24 * 60 * 60_000 });
  const c = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: c?.title || 'Info' }} />
      {q.isLoading ? (
        <StateView kind="loading" />
      ) : q.isError || !c || !c.markdown ? (
        <StateView kind="empty" title="Unavailable" message="Couldn’t load this page." onRetry={() => q.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text style={{ color: t.text, fontSize: 24, fontWeight: '800', marginBottom: c.updated ? 2 : 12 }}>{c.title}</Text>
          {c.updated ? <Text style={{ color: t.subtle, fontSize: 12, marginBottom: 12 }}>Last updated: {c.updated}</Text> : null}
          <Markdown source={c.markdown} />
        </ScrollView>
      )}
    </View>
  );
}
