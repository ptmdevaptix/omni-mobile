// User-controllable "compact mode" (persisted). When on, the Scores and Home tabs render games two
// across using team abbreviations instead of full-width cards. Toggled from the top bar.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const KEY = 'compactMode';

const CompactContext = createContext<{ compact: boolean; setCompact: (v: boolean) => void }>({
  compact: false, setCompact: () => {},
});

export function CompactModeProvider({ children }: { children: ReactNode }) {
  const [compact, setCompactState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === '1') setCompactState(true); }).catch(() => {});
  }, []);

  const setCompact = (v: boolean) => { setCompactState(v); AsyncStorage.setItem(KEY, v ? '1' : '0').catch(() => {}); };

  return <CompactContext.Provider value={{ compact, setCompact }}>{children}</CompactContext.Provider>;
}

export function useCompact() { return useContext(CompactContext); }
