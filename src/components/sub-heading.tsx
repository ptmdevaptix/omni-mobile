import { Text } from 'react-native';

import { useTheme } from '@/lib/theme';

/** A run's sub-heading inside a list section — NCAA conferences under the NCAA header. */
export function SubHeading({ title }: { title: string }) {
  const t = useTheme();
  return (
    <Text style={{ color: t.subtle, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 4, marginBottom: 2 }}>
      {title}
    </Text>
  );
}
