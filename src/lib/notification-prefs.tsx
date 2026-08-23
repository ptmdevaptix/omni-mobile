// Notification preferences, stored locally (AsyncStorage) alongside favorites.
//
// These are the user's *intent*. Nothing here schedules or sends anything — iOS pushes originate
// server-side (a watcher polls live games and pushes on state changes), so once push is wired up
// these preferences have to be mirrored to the server with the device's push token. Keeping them in
// one serialisable object makes that a single POST body.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const KEY = 'notificationPrefs';

// The four toggles the user asked for. "start" covers both the 10-minute warning and puck drop;
// "final" covers regulation, OT and shootout results (a shootout reports only its final score —
// never one notification per attempt).
export type NotificationEvent = 'start' | 'goal' | 'period' | 'final';

export const NOTIFICATION_EVENTS: { key: NotificationEvent; label: string; detail: string }[] = [
  { key: 'start', label: 'Game start', detail: '10 minutes before, and again at puck drop' },
  { key: 'goal', label: 'Goals', detail: 'Score updates as they happen' },
  { key: 'period', label: 'Period end', detail: 'Score at the end of each period' },
  { key: 'final', label: 'Final score', detail: 'Including OT and shootout results' },
];

export type NotificationPrefs = {
  /** Master switch. Off = nothing is sent, whatever else is set. */
  enabled: boolean;
  events: Record<NotificationEvent, boolean>;
  /** Favorite team ids explicitly silenced. Teams are ON by default, so absence means enabled. */
  mutedTeams: string[];
};

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false, // opt-in: nothing is sent until the user turns it on and grants permission
  events: { start: true, goal: true, period: true, final: true },
  mutedTeams: [],
};

function normalise(raw: unknown): NotificationPrefs {
  const p = (raw ?? {}) as Partial<NotificationPrefs>;
  const events = { ...DEFAULT_PREFS.events, ...(p.events ?? {}) };
  return {
    enabled: typeof p.enabled === 'boolean' ? p.enabled : DEFAULT_PREFS.enabled,
    events,
    mutedTeams: Array.isArray(p.mutedTeams) ? p.mutedTeams.filter((x) => typeof x === 'string') : [],
  };
}

const Ctx = createContext<{
  prefs: NotificationPrefs;
  ready: boolean;
  setEnabled: (on: boolean) => void;
  setEvent: (key: NotificationEvent, on: boolean) => void;
  setTeamEnabled: (teamId: string, on: boolean) => void;
  isTeamEnabled: (teamId: string) => boolean;
}>({
  prefs: DEFAULT_PREFS,
  ready: false,
  setEnabled: () => {},
  setEvent: () => {},
  setTeamEnabled: () => {},
  isTeamEnabled: () => true,
});

export function NotificationPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v) { try { setPrefs(normalise(JSON.parse(v))); } catch {} } })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const update = (fn: (p: NotificationPrefs) => NotificationPrefs) =>
    setPrefs((prev) => {
      const next = fn(prev);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

  const value = useMemo(() => ({
    prefs,
    ready,
    setEnabled: (on: boolean) => update((p) => ({ ...p, enabled: on })),
    setEvent: (key: NotificationEvent, on: boolean) =>
      update((p) => ({ ...p, events: { ...p.events, [key]: on } })),
    // Muting a team silences every event for it, which is why this is a team list rather than a
    // per-team copy of the event toggles.
    setTeamEnabled: (teamId: string, on: boolean) =>
      update((p) => ({
        ...p,
        mutedTeams: on ? p.mutedTeams.filter((id) => id !== teamId) : [...new Set([...p.mutedTeams, teamId])],
      })),
    isTeamEnabled: (teamId: string) => !prefs.mutedTeams.includes(teamId),
  }), [prefs, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useNotificationPrefs = () => useContext(Ctx);
