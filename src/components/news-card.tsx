import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import { timeAgo, type NewsItem } from '@/lib/news';
import { useTheme } from '@/lib/theme';

// Shared article card (image, source · time, headline, excerpt, team-tag chips). Tapping opens the
// article in an in-app browser. Used by the News tab, the team News tab, and the team home card.
export function NewsCard({ a }: { a: NewsItem }) {
  const t = useTheme();
  const tags = (a.teamTags ?? []).slice(0, 4);
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(a.url)}
      style={({ pressed }) => [styles.card, { backgroundColor: t.card, borderColor: t.border }, pressed && { opacity: 0.7 }]}
    >
      {a.imageUrl ? <Image source={{ uri: a.imageUrl }} style={styles.image} contentFit="cover" /> : null}
      <View style={{ padding: 12, gap: 5 }}>
        <Text style={{ color: t.sub, fontSize: 12, fontWeight: '600' }}>{[a.source, timeAgo(a.publishedAt)].filter(Boolean).join(' · ')}</Text>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '700', lineHeight: 21 }} numberOfLines={3}>{a.title}</Text>
        {a.excerpt ? <Text style={{ color: t.sub, fontSize: 13, lineHeight: 19 }} numberOfLines={3}>{a.excerpt}</Text> : null}
        {tags.length ? (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <View key={tag.id} style={styles.tag}>
                <TeamLogo uri={tag.logo} darkUri={tag.darkLogo} size={16} />
                <Text style={{ color: t.sub, fontSize: 11, fontWeight: '700' }}>{tag.abbr}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  image: { width: '100%', height: 160 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
