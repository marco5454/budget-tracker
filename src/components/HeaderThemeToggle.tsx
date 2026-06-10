import { useTheme } from "../hooks/useTheme";
import type { ThemeMode } from "../utils/theme";

const ORDER: ThemeMode[] = ["auto", "light", "dark"];

export default function HeaderThemeToggle() {
  const { mode, effective, setMode } = useTheme();
  const next = () => {
    const idx = ORDER.indexOf(mode);
    setMode(ORDER[(idx + 1) % ORDER.length]);
  };
  const label =
    mode === "auto"
      ? `Theme: Auto (${effective})`
      : mode === "light"
        ? "Theme: Light"
        : "Theme: Dark";
  return (
    <button
      type="button"
      onClick={next}
      title={label + " — click to cycle"}
      aria-label={label}
      className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
    >
      {mode === "auto" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M8 20h8M12 18v2" />
        </svg>
      ) : mode === "light" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
