// Notification preferences, stored locally (AsyncStorage) alongside favorites.
//
// These are the user's *intent*. Nothing here schedules or sends anything — iOS pushes originate
// server-side (a watcher polls live games and pushes on state changes), so once push is wired up
// these preferences have to be mirrored to the server with the device's push token. Keeping them in
// one serialisable object makes that a single POST body.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { alertOverrides, resolveAlerts, type PersonAlerts, type PersonEvent } from '@/lib/player-alerts';

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
  /**
   * What to hear about each person followed, as EXCEPTIONS to that follow's default. Absent means
   * the default — everything for a player starred by name, goals/assists/finals for a whole org —
   * so a reader who never opens these switches stores nothing.
   */
  playerAlerts: Record<string, Partial<PersonAlerts>>;
  prospectAlerts: Record<string, Partial<PersonAlerts>>;
  /** Alerts for games pinned for the day. On by default: pinning a game is asking to hear about it. */
  pinnedAlerts: boolean;
  /** Alerts for followed prospects, all orgs at once — one switch, as the Settings screen shows it. */
  prospectsEnabled: boolean;
  /** Starred players silenced individually. Players are ON by default, so absence means enabled. */
  mutedPlayers: string[];
};

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false, // opt-in: nothing is sent until the user turns it on and grants permission
  events: { start: true, goal: true, period: true, final: true },
  mutedTeams: [],
  playerAlerts: {},
  prospectAlerts: {},
  pinnedAlerts: true,
  prospectsEnabled: true,
  mutedPlayers: [],
};

function normalise(raw: unknown): NotificationPrefs {
  const p = (raw ?? {}) as Partial<NotificationPrefs>;
  const events = { ...DEFAULT_PREFS.events, ...(p.events ?? {}) };
  return {
    enabled: typeof p.enabled === 'boolean' ? p.enabled : DEFAULT_PREFS.enabled,
    events,
    mutedTeams: Array.isArray(p.mutedTeams) ? p.mutedTeams.filter((x) => typeof x === 'string') : [],
    playerAlerts: (p.playerAlerts ?? {}) as Record<string, Partial<PersonAlerts>>,
    prospectAlerts: (p.prospectAlerts ?? {}) as Record<string, Partial<PersonAlerts>>,
    pinnedAlerts: typeof p.pinnedAlerts === 'boolean' ? p.pinnedAlerts : DEFAULT_PREFS.pinnedAlerts,
    prospectsEnabled: typeof p.prospectsEnabled === 'boolean' ? p.prospectsEnabled : DEFAULT_PREFS.prospectsEnabled,
    mutedPlayers: Array.isArray(p.mutedPlayers) ? p.mutedPlayers.filter((x) => typeof x === 'string') : [],
  };
}

const Ctx = createContext<{
  prefs: NotificationPrefs;
  ready: boolean;
  setEnabled: (on: boolean) => void;
  setEvent: (key: NotificationEvent, on: boolean) => void;
  setTeamEnabled: (teamId: string, on: boolean) => void;
  isTeamEnabled: (teamId: string) => boolean;
  /** The switches for one followed person, with their defaults filled in. */
  alertsFor: (id: string, kind: 'starred' | 'prospect') => PersonAlerts;
  setAlert: (id: string, kind: 'starred' | 'prospect', event: PersonEvent, on: boolean) => void;
  setPinnedAlerts: (on: boolean) => void;
  setProspectsEnabled: (on: boolean) => void;
  setPlayerEnabled: (playerId: string, on: boolean) => void;
  isPlayerEnabled: (playerId: string) => boolean;
}>({
  prefs: DEFAULT_PREFS,
  ready: false,
  setEnabled: () => {},
  setEvent: () => {},
  setTeamEnabled: () => {},
  isTeamEnabled: () => true,
  alertsFor: (_id, kind) => resolveAlerts(undefined, kind),
  setAlert: () => {},
  setPinnedAlerts: () => {},
  setProspectsEnabled: () => {},
  setPlayerEnabled: () => {},
  isPlayerEnabled: () => true,
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
    alertsFor: (id: string, kind: 'starred' | 'prospect') =>
      resolveAlerts(kind === 'starred' ? prefs.playerAlerts[id] : prefs.prospectAlerts[id], kind),
    // Only the exceptions are stored, so changing a default later moves everyone who never chose.
    setAlert: (id: string, kind: 'starred' | 'prospect', event: PersonEvent, on: boolean) =>
      update((p) => {
        const field = kind === 'starred' ? 'playerAlerts' : 'prospectAlerts';
        const next = { ...resolveAlerts(p[field][id], kind), [event]: on };
        const diff = alertOverrides(next, kind);
        const map = { ...p[field] };
        if (Object.keys(diff).length) map[id] = diff; else delete map[id];
        return { ...p, [field]: map };
      }),
    // These three silence a follow by leaving it out of the registration (lib/push usePushSync), so
    // the server needs to know nothing about them — and the end-of-day summary leaves them out too.
    setPinnedAlerts: (on: boolean) => update((p) => ({ ...p, pinnedAlerts: on })),
    setProspectsEnabled: (on: boolean) => update((p) => ({ ...p, prospectsEnabled: on })),
    setPlayerEnabled: (playerId: string, on: boolean) =>
      update((p) => ({
        ...p,
        mutedPlayers: on ? p.mutedPlayers.filter((id) => id !== playerId) : [...new Set([...p.mutedPlayers, playerId])],
      })),
    isPlayerEnabled: (playerId: string) => !prefs.mutedPlayers.includes(playerId),
  }), [prefs, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useNotificationPrefs = () => useContext(Ctx);
