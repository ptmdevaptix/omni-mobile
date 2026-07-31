import { Fragment } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '@/lib/theme';

// Minimal dependency-free markdown renderer for our static content: ## / # headings, paragraphs,
// "- " bullet lists, **bold**, and [text](url) links. (markdown-it needs Node's punycode → unusable in Metro.)

type Seg = { text: string; bold?: boolean; url?: string };

function parseInline(text: string): Seg[] {
  const segs: Seg[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) segs.push({ text: m[2], bold: true });
    else if (m[4] !== undefined) segs.push({ text: m[4], url: m[5] });
    last = re.lastIndex;
  }
  if (last < text.length) segs.push({ text: text.slice(last) });
  return segs;
}

function Inline({ text, t }: { text: string; t: Theme }) {
  return (
    <>
      {parseInline(text).map((s, i) => {
        if (s.url) return <Text key={i} style={{ color: t.accent, fontWeight: '600' }} onPress={() => Linking.openURL(s.url!).catch(() => {})}>{s.text}</Text>;
        if (s.bold) return <Text key={i} style={{ fontWeight: '700', color: t.text }}>{s.text}</Text>;
        return <Fragment key={i}>{s.text}</Fragment>;
      })}
    </>
  );
}

export function Markdown({ source }: { source: string }) {
  const t = useTheme();
  const lines = source.replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }

    if (line.startsWith('## ')) { blocks.push(<Text key={key++} style={[styles.h2, { color: t.text }]}>{line.slice(3)}</Text>); i++; continue; }
    if (line.startsWith('# ')) { blocks.push(<Text key={key++} style={[styles.h1, { color: t.text }]}>{line.slice(2)}</Text>); i++; continue; }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) { items.push(lines[i].slice(2)); i++; }
      blocks.push(
        <View key={key++} style={{ marginBottom: 12, gap: 6 }}>
          {items.map((it, j) => (
            <View key={j} style={styles.bulletRow}>
              <Text style={{ color: t.sub, marginRight: 8, lineHeight: 22 }}>•</Text>
              <Text style={[styles.body, { color: t.text, flex: 1 }]}><Inline text={it} t={t} /></Text>
            </View>
          ))}
        </View>,
      );
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('- ')) { para.push(lines[i]); i++; }
    blocks.push(<Text key={key++} style={[styles.body, styles.para, { color: t.text }]}><Inline text={para.join(' ')} t={t} /></Text>);
  }

  return <View>{blocks}</View>;
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  para: { marginBottom: 12 },
  h1: { fontSize: 20, fontWeight: '800', marginTop: 12, marginBottom: 8 },
  h2: { fontSize: 17, fontWeight: '700', marginTop: 18, marginBottom: 6 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
});
