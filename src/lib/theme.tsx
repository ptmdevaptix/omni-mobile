// Native-iOS-flavored semantic palette (HIG-ish system colors) with the omni-blue accent, plus a
// user-controllable light/dark preference (persisted; overrides the system setting).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme as NavDark, DefaultTheme as NavLight } from 'expo-router';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

type Scheme = 'light' | 'dark' | null | undefined | string;

export type Theme = {
  mode: 'light' | 'dark';
  bg: string; card: string; text: string; sub: string; subtle: string;
  border: string; accent: string; onAccent: string; live: string;
};

const light: Theme = {
  mode: 'light',
  bg: '#f2f2f7', card: '#ffffff', text: '#000000', sub: '#6c6c70', subtle: '#a1a1a6',
  border: '#d1d1d6', accent: '#208aef', onAccent: '#ffffff', live: '#34c759', // green = in-progress (not an alert)
};
const dark: Theme = {
  mode: 'dark',
  bg: '#000000', card: '#1c1c1e', text: '#ffffff', sub: '#98989f', subtle: '#68686e',
  // Dark mode uses gold for active/selected (harmonizes with the metallic "My Teams" frame); onAccent is
  // dark so text on gold pills stays readable. Light mode keeps blue (below) for now.
  border: '#2c2c2e', accent: '#e8bb46', onAccent: '#1a1400', live: '#30d158', // green = in-progress (not an alert)
};

export function palette(scheme: Scheme): Theme {
  return scheme === 'dark' ? dark : light;
}

// React Navigation theme so native headers, large titles, and the tab bar match our palette.
export function navTheme(scheme: Scheme): typeof NavLight {
  const t = palette(scheme);
  const base = scheme === 'dark' ? NavDark : NavLight;
  return {
    ...base,
    colors: { ...base.colors, primary: t.accent, background: t.bg, card: t.card, text: t.text, border: t.border, notification: t.live },
  };
}

// --- Theme mode preference (light / dark / system), persisted ----------------
export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'themePref';

const ModeContext = createContext<{ scheme: 'light' | 'dark'; pref: ThemePref; setPref: (p: ThemePref) => void }>({
  scheme: 'light', pref: 'system', setPref: () => {},
});

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v); }).catch(() => {});
  }, []);

  const setPref = (p: ThemePref) => { setPrefState(p); AsyncStorage.setItem(KEY, p).catch(() => {}); };
  const scheme: 'light' | 'dark' = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;

  return <ModeContext.Provider value={{ scheme, pref, setPref }}>{children}</ModeContext.Provider>;
}

export function useThemeMode() { return useContext(ModeContext); }

// Screens use this — it reflects the effective (preference-aware) scheme.
export function useTheme(): Theme {
  return palette(useContext(ModeContext).scheme);
}
