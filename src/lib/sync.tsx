// Sync across devices — the app's end of the web's anonymous pairing (omni-hockey lib/sync.ts,
// app/api/sync/*). Pair a phone with a browser (or another phone) with a six-character code, and the
// two keep the same favorite teams, starred players, followed leagues, prospect switches and pinned
// games.
//
// There is no account: `accountId` is a random id the server hands out, kept here, and possessing it
// is the credential. On pairing, the device that CLAIMS a code takes the account's preferences (the
// one that made the code seeded them), the same rule the web follows. After that, whichever device
// changes something last wins — pushed about a second after the change, pulled when the app opens or
// comes back to the foreground.
//
// The shapes differ between the clients and are translated here. The web stores a team with its name
// and crest; the app stores ids and looks those up live, so on the way out they come from the team
// directory and on the way in they are dropped. A player goes out with a name (the web shows it
// before it has looked him up) and comes in as his id.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { API_BASE, CLIENT_ID } from '@/lib/api';
import { useFavorites, type FavoriteTeam, type PinnedGame, type ProspectFollow } from '@/lib/favorites';
import { useFollowedLeagues, type FollowedLeague } from '@/lib/followed-leagues';
import { fetchAllTeams } from '@/lib/leagues';
import { nameFromSlug } from '@/lib/pref-telemetry';
import { useDerivedClubs } from '@/lib/use-follows';

const ACCOUNT_KEY = 'syncAccountId';
/** The web's default-league choice, which the app has no use for but must not erase: every write
 *  sends it back as it last arrived. */
const DEFAULT_LEAGUE_KEY = 'syncDefaultLeague';
const PUSH_DEBOUNCE_MS = 800;

/** What the server stores for an account — the web's SyncedPrefs. */
type ServerTeam = { id: string; league: string; name: string; abbr: string; logo: string; darkLogo?: string; via?: string };
type ServerPrefs = {
  favorites: ServerTeam[];
  defaultLeague: string | null;
  followedLeagues: FollowedLeague[] | null;
  players: { id: string; name: string }[];
  prospects: ProspectFollow[];
  /** Absent from a server whose database has no column for pins yet — keep this device's own. */
  pinnedGames?: PinnedGame[];
};

async function call<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', 'X-Omni-Client': CLIENT_ID },
      signal: ctrl.signal,
    });
    const body = (await res.json().catch(() => null)) as T | null;
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

type Ctx = {
  /** Storage has been read. */
  ready: boolean;
  linked: boolean;
  accountId: string | null;
  /** A fresh code for this device's account — making the account first, seeded from this device, if it has none. */
  createCode: () => Promise<{ code: string; expiresAt: string }>;
  /** Take the account behind another device's code, and its preferences with it. Throws a readable message. */
  claimCode: (code: string) => Promise<void>;
  unlink: () => void;
};

const SyncContext = createContext<Ctx>({
  ready: false, linked: false, accountId: null,
  createCode: async () => { throw new Error('Sync is not ready'); },
  claimCode: async () => { throw new Error('Sync is not ready'); },
  unlink: () => {},
});

export function SyncProvider({ children }: { children: ReactNode }) {
  const fav = useFavorites();
  const leagues = useFollowedLeagues();
  const dir = useQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 });
  const { clubs } = useDerivedClubs();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [defaultLeague, setDefaultLeague] = useState<string | null>(null);
  const lastSig = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.multiGet([ACCOUNT_KEY, DEFAULT_LEAGUE_KEY])
      .then((pairs) => {
        const m = Object.fromEntries(pairs);
        setAccountId(m[ACCOUNT_KEY] || null);
        setDefaultLeague(m[DEFAULT_LEAGUE_KEY] || null);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const saveAccount = useCallback((id: string | null) => {
    setAccountId(id);
    if (id) AsyncStorage.setItem(ACCOUNT_KEY, id).catch(() => {});
    else AsyncStorage.removeItem(ACCOUNT_KEY).catch(() => {});
  }, []);

  // This device's preferences, as the server wants them.
  const local = useMemo<ServerPrefs>(() => {
    const byId = new Map((dir.data ?? []).map((t) => [t.id, t]));
    const named = clubs.flatMap((c) => c.players);
    return {
      favorites: fav.favoriteTeams.map((t: FavoriteTeam) => {
        const d = byId.get(t.id);
        return {
          id: t.id, league: t.league, name: d?.name ?? t.id, abbr: d?.abbr ?? '', logo: d?.logo ?? '',
          ...(d?.darkLogo ? { darkLogo: d.darkLogo } : {}), ...(t.via ? { via: t.via } : {}),
        };
      }),
      defaultLeague,
      followedLeagues: leagues.customized ? leagues.followed : null,
      players: fav.favoritePlayers.map((id) => ({ id, name: named.find((p) => p.starIds.includes(id))?.name || nameFromSlug(id) })),
      prospects: fav.prospectFollows,
      pinnedGames: fav.pinnedGames,
    };
  }, [fav.favoriteTeams, fav.favoritePlayers, fav.prospectFollows, fav.pinnedGames, leagues.customized, leagues.followed, dir.data, clubs, defaultLeague]);

  // What counts as a change worth sending — ids only, so a name arriving from the directory is not one.
  const sigOf = (p: ServerPrefs) => JSON.stringify([
    p.favorites.map((t) => `${t.id}:${t.via ?? ''}`), p.followedLeagues, p.players.map((x) => x.id),
    p.prospects.map((x) => x.team), (p.pinnedGames ?? []).map((x) => x.id), p.defaultLeague,
  ]);

  const apply = useCallback((p: ServerPrefs) => {
    setDefaultLeague(p.defaultLeague ?? null);
    if (p.defaultLeague) AsyncStorage.setItem(DEFAULT_LEAGUE_KEY, p.defaultLeague).catch(() => {});
    fav.replaceAll({
      teams: (p.favorites ?? []).map((t) => ({ id: t.id, league: t.league, ...(t.via ? { via: t.via } : {}) })),
      players: (p.players ?? []).map((x) => x.id),
      follows: p.prospects ?? [],
      pins: Array.isArray(p.pinnedGames) ? p.pinnedGames : undefined,
    });
    // Null: the account never chose its leagues, so this device keeps its own default.
    if (p.followedLeagues) leagues.replaceFollowed(p.followedLeagues);
    lastSig.current = sigOf({ ...p, pinnedGames: p.pinnedGames ?? fav.pinnedGames });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fav.replaceAll, leagues.replaceFollowed, fav.pinnedGames]);

  const pull = useCallback(async (id: string) => {
    const { status, body } = await call<ServerPrefs>(`/sync/preferences?accountId=${encodeURIComponent(id)}`);
    if (status === 404) { saveAccount(null); return; } // the account is gone — stop syncing
    if (status === 200 && body) apply(body);
  }, [apply, saveAccount]);

  // Pull when storage is ready and linked, and again whenever the app comes back to the foreground —
  // the other device may have changed something while this one was away.
  const pullRef = useRef(pull);
  useEffect(() => { pullRef.current = pull; }, [pull]);
  const loaded = ready && fav.loaded && leagues.loaded;
  useEffect(() => {
    if (!loaded || !accountId) return;
    void pullRef.current(accountId);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void pullRef.current(accountId); });
    return () => sub.remove();
  }, [loaded, accountId]);

  // Push a local change, debounced, unless it is what was just pulled.
  const sig = sigOf(local);
  useEffect(() => {
    if (!loaded || !accountId) return;
    if (lastSig.current === null) { lastSig.current = sig; return; } // first render after linking: nothing changed yet
    if (sig === lastSig.current) return;
    const timer = setTimeout(async () => {
      const { status } = await call('/sync/preferences', { method: 'PUT', body: JSON.stringify({ accountId, ...local }) }).catch(() => ({ status: 0 }));
      if (status === 404) saveAccount(null);
      else if (status === 200) lastSig.current = sig;
    }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, accountId, sig]);

  const value = useMemo<Ctx>(() => ({
    ready,
    linked: !!accountId,
    accountId,
    createCode: async () => {
      const { status, body } = await call<{ accountId: string; code: string; expiresAt: string }>('/sync/pair/create', {
        method: 'POST',
        // A new account is seeded from this device; an existing one only needs a new code.
        body: JSON.stringify(accountId ? { accountId } : local),
      });
      if (status !== 200 || !body) throw new Error('Couldn’t make a code. Try again.');
      if (!accountId) { lastSig.current = sigOf(local); saveAccount(body.accountId); }
      return { code: body.code, expiresAt: body.expiresAt };
    },
    claimCode: async (code: string) => {
      const { status, body } = await call<{ accountId: string; error?: string } & ServerPrefs>('/sync/pair/claim', {
        method: 'POST', body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      if (status !== 200 || !body?.accountId) throw new Error(body?.error ?? 'That code didn’t work — it may have expired.');
      apply(body);
      saveAccount(body.accountId);
    },
    unlink: () => { lastSig.current = null; saveAccount(null); },
  }), [ready, accountId, local, apply, saveAccount]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export const useSync = () => useContext(SyncContext);
