// Whose clock game start times are on — the reader's own ("mine", the default) or each arena's
// ("arena"). See lib/game-time. Stored locally, and carried between paired devices by lib/sync.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { TimeZoneMode } from '@/lib/game-time';

const KEY = 'timeZoneMode';

type Ctx = {
  mode: TimeZoneMode;
  /** The reader has picked one — sync sends a choice, never the default. */
  chosen: boolean;
  loaded: boolean;
  setMode: (mode: TimeZoneMode) => void;
};

const TimeZoneModeContext = createContext<Ctx>({ mode: 'mine', chosen: false, loaded: false, setMode: () => {} });

export function TimeZoneModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<TimeZoneMode>('mine');
  const [chosen, setChosen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'mine' || v === 'arena') { setModeState(v); setChosen(true); }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setMode = useCallback((next: TimeZoneMode) => {
    setModeState(next);
    setChosen(true);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  const value = useMemo(() => ({ mode, chosen, loaded, setMode }), [mode, chosen, loaded, setMode]);
  return <TimeZoneModeContext.Provider value={value}>{children}</TimeZoneModeContext.Provider>;
}

export const useTimeZoneMode = () => useContext(TimeZoneModeContext);
