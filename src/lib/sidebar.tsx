// Collapsed/expanded state for the iPad side rail (persisted). Collapsed shows icons only, which
// hands the content column back ~160pt. Irrelevant on a phone, where the tabs sit at the bottom.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const KEY = 'sidebarCollapsed';

// Rail widths live here rather than in the rail component so `useLayout` can subtract them without
// importing the view layer.
export const RAIL_WIDTH = 232;
export const RAIL_WIDTH_COLLAPSED = 76;

const SidebarContext = createContext<{ collapsed: boolean; toggle: () => void }>({
  collapsed: false, toggle: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === '1') setCollapsed(true); }).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      AsyncStorage.setItem(KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() { return useContext(SidebarContext); }
