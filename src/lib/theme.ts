// Tiny light/dark palette so screens don't depend on the template internals. Use useTheme() in a screen.
import { useColorScheme } from "react-native";

export type Theme = {
  bg: string; card: string; text: string; sub: string; border: string; accent: string; live: string;
};

const light: Theme = { bg: "#f6f7f9", card: "#ffffff", text: "#0b0d12", sub: "#5b6472", border: "#e6e8ec", accent: "#0a7", live: "#e11d48" };
const dark: Theme = { bg: "#0b0d12", card: "#151922", text: "#f2f4f7", sub: "#9aa4b2", border: "#232a36", accent: "#2dd4bf", live: "#fb7185" };

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
