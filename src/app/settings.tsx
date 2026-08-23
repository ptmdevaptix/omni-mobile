import { useQuery } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { TeamLogo } from '@/components/team-logo';
import { leagueOf } from '@/lib/api';
import { useFavorites } from '@/lib/favorites';
import { fetchAllTeams, type TeamDirectoryEntry } from '@/lib/leagues';
import { NOTIFICATION_EVENTS, useNotificationPrefs } from '@/lib/notification-prefs';
import { acquirePushToken, pushPermissionStatus, type PushPermission } from '@/lib/push';
import { useTheme } from '@/lib/theme';

type Row = { id: string; name: string; logo?: string; darkLogo?: string; league: string };

export default function SettingsScreen() {
  const t = useTheme();
  const { favorites, moveFavorite, toggle } = useFavorites();
  const { prefs, setEnabled, setEvent, setTeamEnabled, isTeamEnabled } = useNotificationPrefs();
  const q = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });

  // Favorites are stored as ids; names/logos come from the team directory. Falls back to the raw id
  // so the list still works (and stays reorderable) when the directory can't be reached.
  const rows = useMemo<Row[]>(() => {
    const byId = new Map<string, TeamDirectoryEntry>((q.data ?? []).map((tm) => [tm.id, tm]));
    return favorites.map((id) => {
      const tm = byId.get(id);
      return tm
        ? { id, name: tm.name, logo: tm.logo, darkLogo: tm.darkLogo, league: tm.league }
        : { id, name: id, league: leagueOf(id) };
    });
  }, [favorites, q.data]);

  const off = !prefs.enabled;

  const [permission, setPermission] = useState<PushPermission | null>(null);
  useEffect(() => { pushPermissionStatus().then(setPermission).catch(() => {}); }, [prefs.enabled]);

  // Ask for permission at the moment the user opts in — not at launch, when they'd have no idea what
  // they were agreeing to. A refusal leaves the switch off rather than silently promising alerts that
  // iOS will never deliver.
  async function enable(on: boolean) {
    if (!on) { setEnabled(false); return; }
    const { status } = await acquirePushToken();
    if (status === 'granted') { setEnabled(true); return; }
    if (status === 'denied') {
      Alert.alert(
        'Notifications are off for Omni Hockey',
        'Turn them on in iOS Settings › Notifications › Omni Hockey, then try again.',
        [{ text: 'OK' }],
      );
      return;
    }
    Alert.alert(
      'Not available here',
      'Push notifications need a real device — they can’t be delivered to the simulator.',
      [{ text: 'OK' }],
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 24 }}>

      {/* ── Notifications ─────────────────────────────────────────────── */}
      <View style={{ gap: 8 }}>
        <Text style={[styles.header, { color: t.sub }]}>NOTIFICATIONS</Text>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <ToggleRow
            label="Game notifications"
            detail="For your favorite teams"
            value={prefs.enabled}
            onChange={enable}
          />
        </View>

        {/* The stored flag is intent; this is reality. They diverge when permission is revoked in iOS
            Settings, or on a simulator, where APNs never issues a token. */}
        {prefs.enabled && permission && permission !== 'granted' ? (
          <Text style={[styles.note, { color: t.accent }]}>
            {permission === 'denied'
              ? 'Notifications are blocked for Omni Hockey in iOS Settings, so nothing can be delivered.'
              : 'Push notifications can’t be delivered to the simulator — this needs a real device.'}
          </Text>
        ) : (
          <Text style={[styles.note, { color: t.subtle }]}>
            Alerts are sent from our servers while games are on — the app doesn&apos;t need to be open.
          </Text>
        )}

        <Text style={[styles.header, { color: t.sub, marginTop: 8 }]}>WHAT TO SEND</Text>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, opacity: off ? 0.4 : 1 }]}>
          {NOTIFICATION_EVENTS.map((e, i) => (
            <ToggleRow
              key={e.key}
              label={e.label}
              detail={e.detail}
              value={prefs.events[e.key]}
              disabled={off}
              divider={i > 0}
              onChange={(on) => setEvent(e.key, on)}
            />
          ))}
        </View>
      </View>

      {/* ── Favorite teams: order + per-team mute ─────────────────────── */}
      <View style={{ gap: 8 }}>
        <Text style={[styles.header, { color: t.sub }]}>FAVORITE TEAMS</Text>

        {rows.length === 0 ? (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, padding: 16 }]}>
            <Text style={{ color: t.sub, fontSize: 13 }}>
              Tap the ★ on any team to add it here.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.note, { color: t.subtle }]}>
              This order is used everywhere your teams appear. Switching a team off silences all of its
              notifications.
            </Text>
            <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
              {rows.map((row, i) => (
                <View
                  key={row.id}
                  style={[styles.row, i > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                >
                  <View style={styles.arrows}>
                    <Pressable
                      onPress={() => moveFavorite(i, i - 1)}
                      disabled={i === 0}
                      hitSlop={6}
                      accessibilityLabel={`Move ${row.name} up`}
                    >
                      <SymbolView name="chevron.up" size={13} tintColor={i === 0 ? t.subtle : t.accent} />
                    </Pressable>
                    <Pressable
                      onPress={() => moveFavorite(i, i + 1)}
                      disabled={i === rows.length - 1}
                      hitSlop={6}
                      accessibilityLabel={`Move ${row.name} down`}
                    >
                      <SymbolView name="chevron.down" size={13} tintColor={i === rows.length - 1 ? t.subtle : t.accent} />
                    </Pressable>
                  </View>

                  <TeamLogo uri={row.logo} darkUri={row.darkLogo} size={26} />

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{row.name}</Text>
                    <Text style={{ color: t.subtle, fontSize: 11 }}>{row.league}</Text>
                  </View>

                  {/* Only the notification switch dims with the master toggle — reordering and
                      removing a favorite stay usable whether or not notifications are on. */}
                  <View style={{ opacity: off ? 0.4 : 1 }}>
                    <Switch
                      value={isTeamEnabled(row.id)}
                      onValueChange={(on) => setTeamEnabled(row.id, on)}
                      disabled={off}
                    />
                  </View>

                  <Pressable onPress={() => toggle(row.id)} hitSlop={6} accessibilityLabel={`Remove ${row.name}`}>
                    <SymbolView name="xmark" size={13} tintColor={t.subtle} />
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function ToggleRow({
  label, detail, value, onChange, disabled = false, divider = false,
}: {
  label: string; detail?: string; value: boolean; onChange: (on: boolean) => void;
  disabled?: boolean; divider?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[styles.row, divider && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.text, fontSize: 15 }}>{label}</Text>
        {detail ? <Text style={{ color: t.subtle, fontSize: 11, marginTop: 1 }}>{detail}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  note: { fontSize: 11, lineHeight: 15, paddingHorizontal: 2 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  arrows: { gap: 6, alignItems: 'center' },
});
