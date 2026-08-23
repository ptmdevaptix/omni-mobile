// Push registration: permission → Expo token → mirror the local prefs to the server.
//
// The server is what actually sends notifications (a cron watches live games), so it needs its own
// copy of the token AND the preferences. Anything that changes what should be sent — the master
// switch, an event toggle, muting a team, starring or unstarring one — has to be re-registered.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { API_BASE } from './api';
import { useFavorites } from './favorites';
import { useNotificationPrefs, type NotificationPrefs } from './notification-prefs';

// How a notification behaves while the app is in the foreground. `shouldShowAlert` was split into
// banner + list in SDK 53; SDK 57 wants all four fields.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushPermission = 'granted' | 'denied' | 'unavailable';

/**
 * Ask for notification permission and return the device's Expo push token.
 *
 * Returns 'unavailable' on a simulator: APNs never issues tokens there, so notifications can only be
 * tested on hardware (i.e. a TestFlight build).
 */
export async function acquirePushToken(): Promise<{ status: PushPermission; token?: string }> {
  // Permission is asked for even on a simulator: only the *token* is impossible there, and having
  // iOS authorisation on record is what lets `xcrun simctl push <device> <bundle-id> payload.apns`
  // render notifications locally — the only way to review copy and tap behaviour without hardware.
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    granted = asked.granted;
  }
  if (!granted) return { status: 'denied' };

  if (!Device.isDevice) return { status: 'unavailable' };

  try {
    // Recommended to pass explicitly even though it falls back to expoConfig.extra.eas.projectId.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return { status: 'granted', token: data };
  } catch {
    // No APNs entitlement (unsigned/dev build) or the token service is unreachable.
    return { status: 'unavailable' };
  }
}

/**
 * Current permission state without prompting. The stored `enabled` flag is only the user's intent —
 * iOS permission can be revoked in Settings afterwards, and the flag can outlive a device change, so
 * the UI has to check reality rather than trust it.
 */
export async function pushPermissionStatus(): Promise<PushPermission> {
  if (!Device.isDevice) return 'unavailable';
  const { granted } = await Notifications.getPermissionsAsync();
  return granted ? 'granted' : 'denied';
}

export async function postRegistration(token: string, prefs: NotificationPrefs, teams: string[]): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/push/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version,
        enabled: prefs.enabled,
        events: prefs.events,
        teams,
        mutedTeams: prefs.mutedTeams,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// A notification about a game carries its id so tapping it opens that game.
//
// ⚠️ iOS surfaces custom data from a `body` key in the APNs payload — top-level keys are IGNORED and
// `content.data` arrives null. Expo's push service puts whatever you pass as `data` into `body`, so
// production is fine, but a hand-written payload for `simctl push` must nest it:
//     {"aps":{...},"body":{"gameId":"nhl-2026020001"}}
// Verified the hard way: a top-level "gameId" logged `tap payload null` and the tap just opened the app.
function gameIdFrom(data: unknown): string | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const nested = (d.body ?? {}) as Record<string, unknown>;
  const id = d.gameId ?? nested.gameId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Opens the relevant game when a notification is tapped.
 *
 * Two paths, and the second is the one that's easy to miss: the listener only fires while the app is
 * running, so a tap that cold-starts the app needs getLastNotificationResponseAsync() — otherwise the
 * app launches to Home and the tap appears to do nothing.
 */
const HANDLED_KEY = 'lastHandledNotification';

export function useNotificationTaps() {
  const router = useRouter();
  const navState = useRootNavigationState();
  const [pendingGameId, setPendingGameId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const take = async (response: Notifications.NotificationResponse | null, isReplay: boolean) => {
      if (!response || cancelled) return;
      const data = response.notification.request.content.data;
      if (__DEV__) console.log('[push] tap payload', JSON.stringify(data));

      // getLastNotificationResponseAsync() returns the most recent tap *forever*, not just the one
      // that launched this session — without this guard, every later launch would re-open a stale
      // game. The live listener never replays, so it skips the check.
      const id = response.notification.request.identifier;
      if (isReplay) {
        const seen = await AsyncStorage.getItem(HANDLED_KEY).catch(() => null);
        if (seen === id) return;
        AsyncStorage.setItem(HANDLED_KEY, id).catch(() => {});
      }

      const gameId = gameIdFrom(data);
      if (gameId && !cancelled) setPendingGameId(gameId);
    };

    Notifications.getLastNotificationResponseAsync().then((r) => take(r, true)).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((r) => { void take(r, false); });

    return () => { cancelled = true; sub.remove(); };
  }, []);

  // Navigation has to wait for the root navigator to mount. On a cold start the tap is delivered
  // before the Stack exists, and router.push() at that point is silently dropped — which looks
  // exactly like "the notification just opens the app".
  useEffect(() => {
    if (!pendingGameId || !navState?.key) return;
    router.push({ pathname: '/games/[gameId]', params: { gameId: pendingGameId } });
    setPendingGameId(null);
  }, [pendingGameId, navState?.key, router]);
}

/**
 * Keeps the server's copy in step with local prefs and favorites. Mounted once, app-wide, because
 * favorites change from the ★ on team pages — not just from the settings screen.
 *
 * Re-registers on any meaningful change, debounced so dragging through several toggles sends one
 * request. Turning the master switch off still registers (with enabled:false) rather than going
 * silent, so the server stops sending straight away.
 */
export function usePushSync() {
  const { prefs, ready } = useNotificationPrefs();
  const { favorites } = useFavorites();
  const tokenRef = useRef<string | null>(null);
  const lastSent = useRef<string>('');

  const signature = JSON.stringify({ e: prefs.enabled, v: prefs.events, m: prefs.mutedTeams, t: favorites });

  useEffect(() => {
    if (!ready) return;                     // don't post defaults before storage has loaded
    if (!prefs.enabled && !tokenRef.current) return; // never enabled on this device — nothing to say
    if (signature === lastSent.current) return;

    const timer = setTimeout(async () => {
      let token = tokenRef.current;
      if (!token) {
        const result = await acquirePushToken();
        if (result.status !== 'granted' || !result.token) return; // permission handled in Settings
        token = result.token;
        tokenRef.current = token;
      }
      if (await postRegistration(token, prefs, favorites)) lastSent.current = signature;
    }, 800);

    return () => clearTimeout(timer);
  }, [ready, signature, prefs, favorites]);
}
