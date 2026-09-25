import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSync } from '@/lib/sync';
import { useTheme } from '@/lib/theme';

// The header's Sync button and the sheet it opens — the web's header Sync button (omni-hockey
// components/sync-panel.tsx), the same two states:
//   not synced: make a code here, or type in one another device made, both on screen at once;
//   synced:     a fresh code for the next device, straight away, with Copy.

const SYNCED_GREEN = { light: '#15803d', dark: '#4ade80' } as const;

/**
 * Copy to the clipboard where this build has the module, and otherwise offer the share sheet, whose
 * own Copy does the same. expo-clipboard is native: an over-the-air update carrying this screen can
 * reach a build made before it was added, and importing a missing native module there would crash
 * the app on launch — so it is looked up, not imported.
 */
async function copyText(text: string): Promise<'copied' | 'shared'> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return 'copied';
  } catch {
    await Share.share({ message: text });
    return 'shared';
  }
}

export function SyncButton() {
  const t = useTheme();
  const { ready, linked } = useSync();
  const [open, setOpen] = useState(false);
  const on = ready && linked;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={on ? 'Synced — add another device' : 'Sync with your other devices'}
      >
        <SymbolView
          name={on ? 'checkmark.arrow.trianglehead.counterclockwise' : 'arrow.triangle.2.circlepath'}
          tintColor={on ? SYNCED_GREEN[t.mode] : t.accent}
          size={20}
          fallback={<SymbolView name="arrow.triangle.2.circlepath" tintColor={on ? SYNCED_GREEN[t.mode] : t.accent} size={20} />}
        />
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SyncSheet onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function SyncSheet({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const { linked, accountId, createCode, claimCode, unlink } = useSync();
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<'code' | 'claim' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [code]);

  const makeCode = async () => {
    setBusy('code'); setError(null);
    try { setCode(await createCode()); setNow(Date.now()); } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t make a code.'); } finally { setBusy(null); }
  };

  // Synced: the code is the point, so it is there without asking.
  useEffect(() => {
    // Deferred a tick: starting the request sets state, which an effect must not do synchronously.
    if (linked && !code && !busy) void Promise.resolve().then(makeCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked]);

  const claim = async () => {
    if (input.length !== 6 || busy) return;
    setBusy('claim'); setError(null);
    try {
      await claimCode(input);
      setInput('');
      setNote('Synced. This device now has your other device’s teams, players, leagues and pins.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code didn’t work — it may have expired.');
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!code) return;
    const how = await copyText(code.code).catch(() => null);
    if (how === 'copied') { setNote('Code copied.'); setTimeout(() => setNote(null), 1500); }
  };

  const msLeft = code ? new Date(code.expiresAt).getTime() - now : 0;
  const expired = !!code && msLeft <= 0;
  const left = `${Math.floor(msLeft / 60_000)}:${String(Math.floor((msLeft % 60_000) / 1000)).padStart(2, '0')}`;

  const codeBox = code ? (
    <View style={[styles.box, { borderColor: t.border, backgroundColor: t.bg }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text selectable style={{ color: t.text, fontSize: 30, fontWeight: '800', letterSpacing: 6, fontVariant: ['tabular-nums'], flex: 1 }}>{code.code}</Text>
        <Pressable onPress={copy} accessibilityRole="button" style={[styles.btnOutline, { borderColor: t.border }]}>
          <SymbolView name="doc.on.doc" tintColor={t.text} size={14} />
          <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>Copy</Text>
        </Pressable>
      </View>
      {expired ? (
        <Pressable onPress={makeCode}><Text style={{ color: t.accent, fontSize: 12 }}>This code has expired — tap for a new one</Text></Pressable>
      ) : (
        <Text style={{ color: t.sub, fontSize: 12 }}>Enter it on your other device with its Sync button, on the web or in the app. Expires in {left}.</Text>
      )}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.card, padding: 20, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: t.text, fontSize: 20, fontWeight: '800', flex: 1 }}>Sync across devices</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button"><Text style={{ color: t.accent, fontSize: 16, fontWeight: '600' }}>Done</Text></Pressable>
      </View>

      {linked ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SymbolView name="checkmark.circle.fill" tintColor={SYNCED_GREEN[t.mode]} size={18} />
            <Text style={{ color: SYNCED_GREEN[t.mode], fontSize: 15, fontWeight: '700' }}>This device is synced</Text>
          </View>
          <Text style={{ color: t.sub, fontSize: 13 }}>To add another device, enter this code on it:</Text>
          {codeBox ?? (busy === 'code' ? <ActivityIndicator /> : (
            <Pressable onPress={makeCode} style={[styles.btn, { backgroundColor: t.accent }]}><Text style={{ color: t.onAccent, fontWeight: '700' }}>Show a code</Text></Pressable>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: t.subtle, fontSize: 11, flex: 1 }}>{accountId?.slice(0, 8)}…</Text>
            <Pressable onPress={() => { unlink(); setCode(null); setNote('This device has stopped syncing. Its favorites stay as they are.'); }} accessibilityRole="button">
              <Text style={{ color: t.sub, fontSize: 13, textDecorationLine: 'underline' }}>Unlink this device</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={{ color: t.sub, fontSize: 14 }}>
            Keep your teams, players, leagues and pinned games the same on your phone and your computer. No account needed.
          </Text>
          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: t.text }]}>On your first device</Text>
            {codeBox ?? (
              <Pressable onPress={makeCode} disabled={!!busy} style={[styles.btn, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}>
                <Text style={{ color: t.onAccent, fontWeight: '700' }}>{busy === 'code' ? 'Making a code…' : 'Get a sync code'}</Text>
              </Pressable>
            )}
          </View>
          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: t.text }]}>Or, have a code from your other device?</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                value={input}
                onChangeText={(v) => setInput(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="ABC123"
                placeholderTextColor={t.subtle}
                autoCapitalize="characters"
                autoCorrect={false}
                textContentType="oneTimeCode"
                maxLength={6}
                returnKeyType="go"
                onSubmitEditing={claim}
                style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
              />
              <Pressable onPress={claim} disabled={input.length !== 6 || !!busy}
                style={[styles.btnOutline, { borderColor: t.border, opacity: input.length !== 6 || busy ? 0.5 : 1 }]}>
                <Text style={{ color: t.text, fontWeight: '700' }}>{busy === 'claim' ? 'Syncing…' : 'Sync'}</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {error ? <Text style={{ color: '#ef4444', fontSize: 13 }}>{error}</Text> : null}
      {note ? <Text style={{ color: SYNCED_GREEN[t.mode], fontSize: 13 }}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 10 },
  btn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 13, fontWeight: '700' },
  input: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, letterSpacing: 4, fontWeight: '700' },
});
