// Favorite teams + players + prospect follows, stored locally (AsyncStorage).
//
// Mirrors omni-hockey lib/user-preferences.ts. Team ids are /teams route ids ("ana", "ahl-440",
// "chl-ohl-7"); player ids are canonical page slugs (see canonicalPlayerKey in lib/player.ts).
//
// A favorite team is an OBJECT, not a bare id, because of one field: `via`. An affiliate a prospect
// switch added carries the NHL club's abbreviation, and that tag is what lets the switch swap the
// affiliate when the affiliation changes and remove it when the switch turns off — a team the user
// starred by hand carries no tag and is never touched. Name and crest are NOT stored: the app has
// always resolved them live from the team directory, which is also why it has no stale-name problem.
// `favorites` (the id list, in stored order) stays on the context so every existing reader is unchanged.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { leagueOf } from './api';

const KEY_TEAMS = 'favoriteTeams';
const KEY_PLAYERS = 'favoritePlayers';
const KEY_PROSPECTS = 'prospectFollows';

export type FavoriteTeam = {
  id: string;
  /** The block the id resolves to — "NHL", "AHL", "CHL", "CJRA"… (leagueOf). */
  league: string;
  /** Set on an affiliate a prospect switch added ("nyi"). See docs/design/prospect-follows.md. */
  via?: string;
};

/**
 * A prospect follow: every prospect in an NHL org becomes a followed player, and the org's
 * affiliates become favorites. `affiliates` records which the switch added, so an affiliate the
 * user later removes is not re-added — only a NEW affiliate (an affiliation change) is.
 */
export type ProspectFollow = { team: string; affiliates: string[] };

type Store = { teams: FavoriteTeam[]; players: string[]; follows: ProspectFollow[] };
const EMPTY: Store = { teams: [], players: [], follows: [] };

type Ctx = {
  /** Storage has been read; before this, everything is empty and nothing should be written or sent. */
  loaded: boolean;
  /** Favorite team ids in stored order — the order shown everywhere. */
  favorites: string[];
  favoriteTeams: FavoriteTeam[];
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
  addFavoriteTeam: (team: FavoriteTeam) => void;
  removeFavoriteTeam: (id: string) => void;
  /** Move a favorite team by index. */
  moveFavorite: (from: number, to: number) => void;
  favoritePlayers: string[];
  isFavoritePlayer: (id: string) => boolean;
  togglePlayer: (id: string) => void;
  /** Re-key a starred player — a legacy "nhl-{id}" star becomes the canonical slug on the next visit. */
  renamePlayer: (from: string, to: string) => void;
  prospectFollows: ProspectFollow[];
  isFollowingProspects: (team: string) => boolean;
  /** Switch on: the org's affiliates become favorites, tagged `via` the team. */
  followProspects: (team: string, affiliates: Omit<FavoriteTeam, 'via'>[]) => void;
  /** Switch off: the follow goes, and with it the affiliates it added that still carry its tag. */
  unfollowProspects: (team: string) => void;
  /** Keep a follow's affiliates current with the org's (affiliation changes, healed gaps). */
  syncProspectAffiliates: (team: string, live: Omit<FavoriteTeam, 'via'>[]) => void;
};

const noop = () => {};
const FavoritesContext = createContext<Ctx>({
  loaded: false,
  favorites: [], favoriteTeams: [], isFavorite: () => false, toggle: noop, addFavoriteTeam: noop, removeFavoriteTeam: noop, moveFavorite: noop,
  favoritePlayers: [], isFavoritePlayer: () => false, togglePlayer: noop, renamePlayer: noop,
  prospectFollows: [], isFollowingProspects: () => false, followProspects: noop, unfollowProspects: noop, syncProspectAffiliates: noop,
});

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * Read the team list, accepting the shape it was stored in before this file carried objects: a
 * plain array of ids. Those become untagged favorites in the same order — a one-time, lossless
 * migration that happens on read, so an app updated over the air keeps every star.
 */
function parseTeams(raw: unknown): FavoriteTeam[] {
  if (!Array.isArray(raw)) return [];
  const out: FavoriteTeam[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      if (item) out.push({ id: item, league: leagueOf(item) });
    } else if (item && typeof item === 'object' && typeof (item as FavoriteTeam).id === 'string') {
      const t = item as FavoriteTeam;
      out.push({ id: t.id, league: t.league || leagueOf(t.id), ...(t.via ? { via: t.via.toLowerCase() } : {}) });
    }
  }
  return out;
}

function parsePlayers(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && !!x) : [];
}

function parseFollows(raw: unknown): ProspectFollow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is ProspectFollow => !!f && typeof f.team === 'string')
    .map((f) => ({ team: f.team.toLowerCase(), affiliates: Array.isArray(f.affiliates) ? f.affiliates : [] }));
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  // The latest store, for helpers that read several slices before writing — a functional setState
  // cannot return two slices' worth of side effects.
  const ref = useRef<Store>(EMPTY);

  useEffect(() => {
    AsyncStorage.multiGet([KEY_TEAMS, KEY_PLAYERS, KEY_PROSPECTS])
      .then((pairs) => {
        const byKey = Object.fromEntries(pairs);
        const teams = parseTeams(parseJson(byKey[KEY_TEAMS]));
        const next: Store = {
          teams,
          players: parsePlayers(parseJson(byKey[KEY_PLAYERS])),
          follows: parseFollows(parseJson(byKey[KEY_PROSPECTS])),
        };
        ref.current = next;
        setStore(next);
        // Persist the migrated shape once, so the legacy id list is not re-parsed on every launch.
        const wasLegacy = (parseJson(byKey[KEY_TEAMS]) as unknown[] | null)?.some((x) => typeof x === 'string');
        if (wasLegacy) AsyncStorage.setItem(KEY_TEAMS, JSON.stringify(teams)).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Apply a change to the whole store and persist whichever slices moved.
  const update = useCallback((fn: (s: Store) => Store) => {
    const prev = ref.current;
    const next = fn(prev);
    if (next === prev) return;
    ref.current = next;
    setStore(next);
    if (next.teams !== prev.teams) AsyncStorage.setItem(KEY_TEAMS, JSON.stringify(next.teams)).catch(() => {});
    if (next.players !== prev.players) AsyncStorage.setItem(KEY_PLAYERS, JSON.stringify(next.players)).catch(() => {});
    if (next.follows !== prev.follows) AsyncStorage.setItem(KEY_PROSPECTS, JSON.stringify(next.follows)).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => {
    const favorites = store.teams.map((t) => t.id);
    const isFavorite = (id: string) => store.teams.some((t) => t.id === id);
    const isFavoritePlayer = (id: string) => store.players.includes(id);
    const isFollowingProspects = (team: string) => store.follows.some((f) => f.team === team.toLowerCase());

    // Switch off, as its own step so removing the NHL club can call it too.
    const unfollow = (s: Store, team: string): Store => {
      const t = team.toLowerCase();
      if (!s.follows.some((f) => f.team === t)) return s;
      return { ...s, teams: s.teams.filter((f) => f.via !== t), follows: s.follows.filter((f) => f.team !== t) };
    };

    const addFavoriteTeam = (team: FavoriteTeam) => update((s) => (
      s.teams.some((t) => t.id === team.id) ? s : { ...s, teams: [...s.teams, { ...team, league: team.league || leagueOf(team.id) }] }
    ));
    // Removing an NHL club from favorites takes its prospect follow with it.
    const removeFavoriteTeam = (id: string) => update((s) => (
      s.teams.some((t) => t.id === id) ? unfollow({ ...s, teams: s.teams.filter((t) => t.id !== id) }, id) : s
    ));

    return {
      loaded,
      favorites,
      favoriteTeams: store.teams,
      isFavorite,
      toggle: (id) => (isFavorite(id) ? removeFavoriteTeam(id) : addFavoriteTeam({ id, league: leagueOf(id) })),
      addFavoriteTeam,
      removeFavoriteTeam,
      moveFavorite: (from, to) => update((s) => {
        if (from === to || from < 0 || to < 0 || from >= s.teams.length || to >= s.teams.length) return s;
        const teams = [...s.teams];
        const [moved] = teams.splice(from, 1);
        teams.splice(to, 0, moved);
        return { ...s, teams };
      }),
      favoritePlayers: store.players,
      isFavoritePlayer,
      togglePlayer: (id) => update((s) => ({
        ...s, players: s.players.includes(id) ? s.players.filter((x) => x !== id) : [...s.players, id],
      })),
      renamePlayer: (from, to) => update((s) => {
        if (from === to || !s.players.includes(from)) return s;
        const players = s.players.filter((x) => x !== from && x !== to);
        // Keep the star where the old key sat, so the Favorites list does not reorder under the reader.
        players.splice(Math.min(s.players.indexOf(from), players.length), 0, to);
        return { ...s, players };
      }),
      prospectFollows: store.follows,
      isFollowingProspects,
      followProspects: (team, affiliates) => update((s) => {
        const t = team.toLowerCase();
        if (s.follows.some((f) => f.team === t)) return s;
        const teams = [...s.teams];
        const added: string[] = [];
        for (const a of affiliates) {
          if (teams.some((f) => f.id === a.id)) continue;
          teams.push({ ...a, league: a.league || leagueOf(a.id), via: t });
          added.push(a.id);
        }
        return { ...s, teams: added.length ? teams : s.teams, follows: [...s.follows, { team: t, affiliates: added }] };
      }),
      unfollowProspects: (team) => update((s) => unfollow(s, team)),
      // A NEW affiliate (the org moved its AHL club) is added and tagged; one the org dropped is
      // removed only while it still carries the tag. One the user removed by hand stays removed: it
      // is in `affiliates` but absent from favorites.
      syncProspectAffiliates: (team, live) => update((s) => {
        const t = team.toLowerCase();
        const follow = s.follows.find((f) => f.team === t);
        if (!follow) return s;
        const liveIds = new Set(live.map((a) => a.id));
        let teams = s.teams;
        const dropped = follow.affiliates.filter((id) => !liveIds.has(id));
        if (dropped.length) teams = teams.filter((f) => !(f.via === t && dropped.includes(f.id)));
        const added: string[] = [];
        for (const a of live) {
          if (follow.affiliates.includes(a.id) || teams.some((f) => f.id === a.id)) continue;
          teams = [...teams, { ...a, league: a.league || leagueOf(a.id), via: t }];
          added.push(a.id);
        }
        const nextList = [...follow.affiliates.filter((id) => liveIds.has(id)), ...added];
        const follows = nextList.length !== follow.affiliates.length || added.length
          ? s.follows.map((f) => (f.team === t ? { ...f, affiliates: nextList } : f))
          : s.follows;
        if (teams === s.teams && follows === s.follows) return s;
        return { ...s, teams, follows };
      }),
    };
  }, [store, loaded, update]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export const useFavorites = () => useContext(FavoritesContext);
