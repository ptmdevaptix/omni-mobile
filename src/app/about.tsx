import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme';

const LIGHT = require('@/assets/images/omni-logo-light.png');
const DARK = require('@/assets/images/omni-logo-dark.png');

// Mirrors the web SiteFooter's link set (opened in an in-app browser).
const LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Get Involved', href: '/get-involved' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Use', href: '/terms' },
  { label: 'Affiliate Disclosure', href: '/affiliate' },
  { label: 'Credits', href: '/credits' },
];

export default function AboutScreen() {
  const t = useTheme();
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const year = new Date().getFullYear();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={styles.headerBlock}>
        <Image source={t.mode === 'dark' ? DARK : LIGHT} style={{ width: 64, height: 64 }} contentFit="contain" />
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>Omni Hockey</Text>
        <Text style={{ color: t.sub, fontSize: 14, textAlign: 'center' }}>Sports intelligence for the NHL, AHL, CHL & NCAA.</Text>
        <Text style={{ color: t.subtle, fontSize: 12 }}>Version {version}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        {LINKS.map((l, i) => (
          <Pressable
            key={l.href}
            onPress={() => router.push(`/info/${l.href.slice(1)}` as any)}
            style={[styles.row, i > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth }]}
          >
            <Text style={{ color: t.text, fontSize: 16 }}>{l.label}</Text>
            <SymbolView name="chevron.right" tintColor={t.subtle} size={14} />
          </Pressable>
        ))}
      </View>

      <Text style={{ color: t.subtle, fontSize: 12, textAlign: 'center' }}>© {year} Omni Hockey · Data from omnihockey.com</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerBlock: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
});
