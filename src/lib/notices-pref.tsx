// Whether the notice strip shows at all — one switch, remembered per device, on by default. It
// replaces per-item dismissal: a reader who does not want notices turns them off once, and one who
// does sees every notice. Mirrors lib/use-notices-pref.ts on the web. A provider rather than a hook
// reading storage on its own, so the header's toggle and Home's strip agree at once.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const KEY = 'notices';

const Ctx = createContext<{ on: boolean; loaded: boolean; setOn: (v: boolean) => void }>({ on: true, loaded: false, setOn: () => {} });

export function NoticesPrefProvider({ children }: { children: ReactNode }) {
  const [on, setOnState] = useState(true);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === 'off') setOnState(false); }).catch(() => {}).finally(() => setLoaded(true));
  }, []);
  const value = useMemo(() => ({
    on, loaded,
    setOn: (v: boolean) => { setOnState(v); AsyncStorage.setItem(KEY, v ? 'on' : 'off').catch(() => {}); },
  }), [on, loaded]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useNoticesPref = () => useContext(Ctx);
