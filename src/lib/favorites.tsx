// Favorite teams, stored locally (AsyncStorage). Ids are the /teams route ids (e.g. "ana", "ahl-440",
// "chl-ohl-7", "ncaa-air-force") so they match both team pages and the teamsById keys in scores feeds.
// Local-first per the spec; optional web sync (pairing code) is a later addition.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const KEY = 'favoriteTeams';

const FavoritesContext = createContext<{
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
}>({ favorites: [], isFavorite: () => false, toggle: () => {} });

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v) { try { const arr = JSON.parse(v); if (Array.isArray(arr)) setFavorites(arr); } catch {} }
    }).catch(() => {});
  }, []);

  const toggle = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const isFavorite = (id: string) => favorites.includes(id);

  return <FavoritesContext.Provider value={{ favorites, isFavorite, toggle }}>{children}</FavoritesContext.Provider>;
}

export const useFavorites = () => useContext(FavoritesContext);
