// Favorite teams + players, stored locally (AsyncStorage). Team ids are /teams route ids (e.g. "ana",
// "ahl-440", "chl-ohl-7"); player ids are /players route ids (e.g. "nhl-8478402"). Local-first per the
// spec; optional web sync (pairing code) is a later addition.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const KEY_TEAMS = 'favoriteTeams';
const KEY_PLAYERS = 'favoritePlayers';

const FavoritesContext = createContext<{
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
  favoritePlayers: string[];
  isFavoritePlayer: (id: string) => boolean;
  togglePlayer: (id: string) => void;
}>({
  favorites: [], isFavorite: () => false, toggle: () => {},
  favoritePlayers: [], isFavoritePlayer: () => false, togglePlayer: () => {},
});

// A persisted list of ids with add/remove-toggle semantics.
function usePersistedSet(key: string) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(key).then((v) => {
      if (v) { try { const a = JSON.parse(v); if (Array.isArray(a)) setIds(a); } catch {} }
    }).catch(() => {});
  }, [key]);
  const toggle = (id: string) => setIds((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
    return next;
  });
  const has = (id: string) => ids.includes(id);
  return { ids, toggle, has };
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const teams = usePersistedSet(KEY_TEAMS);
  const players = usePersistedSet(KEY_PLAYERS);
  return (
    <FavoritesContext.Provider
      value={{
        favorites: teams.ids, isFavorite: teams.has, toggle: teams.toggle,
        favoritePlayers: players.ids, isFavoritePlayer: players.has, togglePlayer: players.toggle,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export const useFavorites = () => useContext(FavoritesContext);
