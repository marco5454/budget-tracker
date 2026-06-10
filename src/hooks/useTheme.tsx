import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  applyTheme,
  getStoredThemeMode,
  setStoredThemeMode,
  watchSystemTheme,
  type ThemeMode,
} from "../utils/theme";

interface ThemeContextValue {
  mode: ThemeMode;
  effective: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => getStoredThemeMode());
  const [effective, setEffective] = useState<"light" | "dark">(() => {
    const root = document.documentElement;
    return root.classList.contains("dark") ? "dark" : "light";
  });
  const unwatchRef = useRef<(() => void) | null>(null);

  const refreshEffective = useCallback(() => {
    const cur = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setEffective(cur);
  }, []);

  // Apply when mode changes; rewatch system preference when in auto.
  useEffect(() => {
    applyTheme(mode);
    refreshEffective();
    unwatchRef.current?.();
    unwatchRef.current = null;
    if (mode === "auto") {
      unwatchRef.current = watchSystemTheme(() => {
        applyTheme("auto");
        refreshEffective();
      });
    }
    return () => {
      unwatchRef.current?.();
      unwatchRef.current = null;
    };
  }, [mode, refreshEffective]);

  const setMode = useCallback((m: ThemeMode) => {
    setStoredThemeMode(m);
    setModeState(m);
  }, []);

  const value = useMemo(() => ({ mode, effective, setMode }), [mode, effective, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
