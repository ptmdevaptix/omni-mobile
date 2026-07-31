import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme';

// One place for the non-content states from the spec: loading, empty, offseason, error.
// Keep screens declarative: `if (q.isLoading) return <StateView kind="loading" />` etc.
type Kind = 'loading' | 'empty' | 'offseason' | 'error';

const DEFAULTS: Record<Exclude<Kind, 'loading'>, { symbol: SymbolViewProps['name']; title: string }> = {
  empty: { symbol: 'tray', title: 'Nothing here yet' },
  offseason: { symbol: 'calendar', title: 'Offseason' },
  error: { symbol: 'exclamationmark.triangle', title: 'Something went wrong' },
};

export function StateView({
  kind,
  title,
  message,
  onRetry,
}: {
  kind: Kind;
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const t = useTheme();

  if (kind === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  const d = DEFAULTS[kind];
  return (
    <View style={styles.center}>
      <SymbolView name={d.symbol} size={44} tintColor={t.subtle} type="hierarchical" />
      <Text style={[styles.title, { color: t.text }]}>{title ?? d.title}</Text>
      {message ? <Text style={[styles.msg, { color: t.sub }]}>{message}</Text> : null}
      {onRetry ? (
        <Pressable onPress={onRetry} style={[styles.retry, { borderColor: t.border }]} hitSlop={8}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  msg: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retry: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
});
