// Followed leagues: what Home shows besides favorite teams. Stored locally (AsyncStorage) like favorites.
//
// The CHL is followed by member league — OHL, WHL, QMJHL — because they play on different nights and
// many fans care about one of them. "CHL" is accepted as shorthand for all three (follow/unfollow, and
// anything stored that way) but is never what gets stored. Mirrors lib/user-preferences.ts on the web.
//
// Absent key → NHL, so a first-time user sees a real slate. An explicitly empty list is a real state
// (favorites only) and is stored as "[]" rather than falling back.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type FollowedLeague = 'NHL' | 'AHL' | 'ECHL' | 'NCAA' | 'USHL' | 'OHL' | 'WHL' | 'QMJHL';
export type FollowTarget = FollowedLeague | 'CHL';

export const CHL_MEMBER_LEAGUES: readonly FollowedLeague[] = ['OHL', 'WHL', 'QMJHL'];
export const FOLLOWABLE_LEAGUES: readonly FollowedLeague[] = ['NHL', 'AHL', 'ECHL', 'NCAA', 'USHL', ...CHL_MEMBER_LEAGUES];
export const DEFAULT_FOLLOWED_LEAGUES: readonly FollowedLeague[] = ['NHL'];

const KEY = 'followedLeagues';

const isFollowable = (v: unknown): v is FollowedLeague =>
  typeof v === 'string' && (FOLLOWABLE_LEAGUES as readonly string[]).includes(v);

/** A stored or requested value → the concrete leagues it means. Unknown values mean nothing. */
export function expandFollowTarget(v: unknown): FollowedLeague[] {
  if (v === 'CHL') return [...CHL_MEMBER_LEAGUES];
  return isFollowable(v) ? [v] : [];
}

type Ctx = {
  followed: FollowedLeague[];
  /** False until AsyncStorage has answered — render nothing preference-dependent before then. */
  loaded: boolean;
  /** True once the user has ever changed the list — false means the NHL default is in effect. */
  customized: boolean;
  follow: (target: FollowTarget) => void;
  unfollow: (target: FollowTarget) => void;
  /** True when every league the target stands for is followed — so "CHL" means all three. */
  isFollowed: (target: FollowTarget) => boolean;
};

const FollowedLeaguesContext = createContext<Ctx>({
  followed: [...DEFAULT_FOLLOWED_LEAGUES], loaded: false, customized: false, follow: () => {}, unfollow: () => {}, isFollowed: () => false,
});

export function FollowedLeaguesProvider({ children }: { children: ReactNode }) {
  const [followed, setFollowed] = useState<FollowedLeague[]>([...DEFAULT_FOLLOWED_LEAGUES]);
  const [loaded, setLoaded] = useState(false);
  const [customized, setCustomized] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v != null) {
          setCustomized(true);
          try {
            const a: unknown = JSON.parse(v);
            if (Array.isArray(a)) setFollowed([...new Set(a.flatMap(expandFollowTarget))]);
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const write = useCallback((next: FollowedLeague[]) => {
    setFollowed(next);
    setCustomized(true);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const follow = useCallback((target: FollowTarget) => {
    const add = expandFollowTarget(target).filter((l) => !followed.includes(l));
    if (add.length) write([...followed, ...add]);
  }, [followed, write]);

  const unfollow = useCallback((target: FollowTarget) => {
    const drop = new Set(expandFollowTarget(target));
    write(followed.filter((l) => !drop.has(l)));
  }, [followed, write]);

  const isFollowed = useCallback((target: FollowTarget) => {
    const wanted = expandFollowTarget(target);
    return wanted.length > 0 && wanted.every((l) => followed.includes(l));
  }, [followed]);

  const value = useMemo(
    () => ({ followed, loaded, customized, follow, unfollow, isFollowed }),
    [followed, loaded, customized, follow, unfollow, isFollowed],
  );
  return <FollowedLeaguesContext.Provider value={value}>{children}</FollowedLeaguesContext.Provider>;
}

export const useFollowedLeagues = () => useContext(FollowedLeaguesContext);
