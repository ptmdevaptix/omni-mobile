import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { dayKey } from '@/lib/format';
import { useNoticesPref } from '@/lib/notices-pref';
import { useTheme } from '@/lib/theme';

/**
 * The notice strip at the top of Home: one item visible, a few queued, dots to move between them,
 * and a slow auto-advance that pauses while the reader's finger is on it. Mirrors the web's
 * components/notice-strip.tsx — at most three are queued, there is no per-item dismissal (the strip
 * is on or off as a whole, the megaphone in the header), and a feature notice retires by its own
 * date rather than by a tap.
 *
 * Producers, by priority (breaking > season > feature):
 *   season  — the calendar line the API phrases (/key-dates): camps, preseason, opening night.
 *   feature — hand-authored: the dated "Euro leagues and Canadian Jr. A" notice, and "Follow your
 *             favorite team's prospects", which is always on.
 */
type Notice = { id: string; kind: 'breaking' | 'season' | 'feature'; text: string; route?: string; tag?: string; icon?: string };

const PRIORITY: Record<Notice['kind'], number> = { breaking: 0, season: 1, feature: 2 };
const ROTATE_MS = 8000;
/** The last day the new-leagues notice runs — after that the leagues are simply part of the app. */
const NEW_LEAGUES_UNTIL = '2026-11-30';
const NHL_LOGO = 'https://omnihockey.com/nhl-logo.svg';

export function NoticeStrip() {
  const t = useTheme();
  const router = useRouter();
  const { on, loaded } = useNoticesPref();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const today = dayKey();

  // The device's date, not the server's: it answers a "what's today" question, and the API runs in UTC.
  const season = useQuery({
    queryKey: ['key-dates', 'NHL', today],
    queryFn: () => api<{ message: { headline: string; date: string } | null }>(`/key-dates?league=NHL&today=${today}`),
    staleTime: 6 * 3600_000,
  });

  const notices = useMemo<Notice[]>(() => {
    const out: Notice[] = [];
    const s = season.data?.message;
    if (s?.headline) out.push({ id: `season-${s.date}`, kind: 'season', icon: NHL_LOGO, text: s.headline });
    if (today <= NEW_LEAGUES_UNTIL) {
      out.push({ id: 'feature-new-leagues', kind: 'feature', tag: 'New', route: '/following',
        text: 'Euro leagues and Canadian Jr. A now supported — follow the SHL, Liiga, Extraliga, BCHL, AJHL, SJHL, MJHL, OJHL and CCHL' });
    }
    out.push({ id: 'feature-prospect-follows', kind: 'feature', route: '/following?guide=prospects',
      text: "Follow your favorite team's prospects — their games and lineups, wherever they play" });
    return out.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]).slice(0, 3);
  }, [season.data, today]);

  useEffect(() => {
    if (paused || notices.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % notices.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, notices.length]);

  if (!loaded || !on || notices.length === 0) return null;
  const n = notices[Math.min(index, notices.length - 1)];
  const breaking = n.kind === 'breaking';
  const tint = breaking ? '#ef4444' : t.accent;
  const tagColors = n.kind === 'feature'
    ? { backgroundColor: 'rgba(16,185,129,0.15)', color: t.mode === 'dark' ? '#34d399' : '#047857' }
    : { backgroundColor: `${tint}26`, color: tint };

  return (
    <Pressable
      onPress={n.route ? () => router.push(n.route as never) : undefined}
      onPressIn={() => setPaused(true)}
      onPressOut={() => setPaused(false)}
      accessibilityRole={n.route ? 'link' : 'text'}
      style={[styles.wrap, { borderColor: `${tint}66`, backgroundColor: `${tint}1a` }]}
    >
      {n.icon ? <Image source={{ uri: n.icon }} style={styles.icon} contentFit="contain" transition={0} /> : null}
      {n.tag ? <Text style={[styles.tag, tagColors]}>{n.tag.toUpperCase()}</Text> : null}
      <Text style={{ color: t.text, fontSize: 13, fontWeight: breaking ? '700' : '600', flex: 1 }} numberOfLines={2}>{n.text}</Text>
      {n.route ? <Text style={{ color: t.sub, fontSize: 13 }}>›</Text> : null}
      {/* Dots: where you are in the queue, and a way to move without waiting. */}
      {notices.length > 1 ? (
        <View style={styles.dots}>
          {notices.map((m, i) => (
            <Pressable key={m.id} onPress={() => setIndex(i)} hitSlop={6} accessibilityRole="tab" accessibilityState={{ selected: i === index }} accessibilityLabel={m.text}>
              <View style={[styles.dot, { backgroundColor: t.text, opacity: i === index ? 0.7 : 0.25, width: i === index ? 14 : 6 }]} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  icon: { width: 16, height: 16 },
  tag: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, overflow: 'hidden' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 2 },
  dot: { height: 6, borderRadius: 3 },
});
