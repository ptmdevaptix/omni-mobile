import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import { useFavorites } from '@/lib/favorites';
import { timeAgo, type NewsItem } from '@/lib/news';
import { useTheme } from '@/lib/theme';

const MAX_TAGS = 5;

// Shared article card (image, source · time, headline, excerpt, team-tag chips). Tapping opens the
// article in an in-app browser. Used by the News tab, the team News tab, and the team home card.
export function NewsCard({ a }: { a: NewsItem }) {
  const t = useTheme();
  const { favorites } = useFavorites();
  // A story about eight clubs would otherwise show the first four the feed happened to list, and the
  // reader's own club could be the fifth. Favorites lead; within each group the feed's order stands.
  const fav = new Set(favorites.map((f) => f.toLowerCase()));
  const seen = new Set<string>();
  const all = (a.teamTags ?? []).filter((tag) => {
    const k = (tag.abbr || tag.id).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const isMine = (tag: { id: string }) => fav.has(tag.id.toLowerCase());
  const ordered = [...all.filter(isMine), ...all.filter((tag) => !isMine(tag))];
  const tags = ordered.slice(0, MAX_TAGS);
  const overflow = ordered.length - tags.length;
  const mine = all.some(isMine);
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(a.url)}
      style={({ pressed }) => [styles.card, { backgroundColor: t.card, borderColor: mine ? t.accent : t.border }, mine && { borderWidth: 1 }, pressed && { opacity: 0.7 }]}
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
                <Text style={{ color: isMine(tag) ? t.accent : t.sub, fontSize: 11, fontWeight: '700' }}>{tag.abbr}</Text>
              </View>
            ))}
            {overflow > 0 ? <Text style={{ color: t.subtle, fontSize: 11, fontWeight: '700' }}>+{overflow}</Text> : null}
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
