/**
 * Theme management. Three modes:
 *   - 'auto'  : follow OS preference (prefers-color-scheme)
 *   - 'light' : force light
 *   - 'dark'  : force dark
 *
 * The selected mode is persisted in localStorage (NOT IndexedDB) so the
 * correct theme can be applied synchronously before the React tree mounts —
 * avoiding a flash of the wrong colour scheme.
 */

export type ThemeMode = "auto" | "light" | "dark";

export const THEME_STORAGE_KEY = "wbt:theme";

const VALID_MODES: ThemeMode[] = ["auto", "light", "dark"];

export function getStoredThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v && (VALID_MODES as string[]).includes(v)) return v as ThemeMode;
  } catch {
    /* localStorage may be unavailable */
  }
  return "auto";
}

export function setStoredThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Returns the effective theme ('light' | 'dark') given a mode. */
export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

export function applyTheme(mode: ThemeMode): "light" | "dark" {
  const effective = resolveTheme(mode);
  const root = document.documentElement;
  if (effective === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  // Keep <meta name="theme-color"> in sync for PWA chrome on mobile.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", effective === "dark" ? "#0f172a" : "#006fc6");
  }
  return effective;
}

/**
 * Watch system preference changes when in 'auto' mode. Returns an
 * unsubscribe function. Caller is responsible for removing the listener
 * when the mode changes away from auto.
 */
export function watchSystemTheme(onChange: (effective: "light" | "dark") => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (ev: MediaQueryListEvent) => {
    onChange(ev.matches ? "dark" : "light");
  };
  // Older Safari uses addListener/removeListener.
  if (mql.addEventListener) mql.addEventListener("change", handler);
  else if ((mql as unknown as { addListener?: (cb: (ev: MediaQueryListEvent) => void) => void }).addListener) {
    (mql as unknown as { addListener: (cb: (ev: MediaQueryListEvent) => void) => void }).addListener(handler);
  }
  return () => {
    if (mql.removeEventListener) mql.removeEventListener("change", handler);
    else if ((mql as unknown as { removeListener?: (cb: (ev: MediaQueryListEvent) => void) => void }).removeListener) {
      (mql as unknown as { removeListener: (cb: (ev: MediaQueryListEvent) => void) => void }).removeListener(handler);
    }
  };
}

/** Apply the stored mode immediately (intended for boot before React mounts). */
export function bootTheme(): void {
  applyTheme(getStoredThemeMode());
}
