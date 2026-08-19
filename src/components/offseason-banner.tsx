import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { SCORES_DATE } from '@/lib/api';
import { useTheme } from '@/lib/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Format the pinned ISO day for display. Parsed by hand rather than via `new Date(iso)` — that
// parses as UTC and can render the previous day for anyone west of Greenwich.
function formatPinned(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// Discloses the SCORES_DATE pin (see src/lib/api.ts) so neither testers nor App Review mistake a
// past game day for today's slate. Renders nothing once SCORES_DATE is back to null, so removing
// the pin removes this automatically — no second edit to remember.
export function OffseasonBanner() {
  const t = useTheme();
  if (!SCORES_DATE) return null;
  return (
    <View style={[styles.wrap, { backgroundColor: t.card, borderBottomColor: t.border }]}>
      <SymbolView name="clock.arrow.circlepath" tintColor={t.sub} size={13} type="hierarchical" />
      <Text style={{ color: t.sub, fontSize: 12 }} numberOfLines={1}>
        Off-season preview · games from {formatPinned(SCORES_DATE)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
