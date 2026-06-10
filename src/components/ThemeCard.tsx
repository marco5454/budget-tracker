import { useTheme } from "../hooks/useTheme";
import type { ThemeMode } from "../utils/theme";

const OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: "auto", label: "Auto", description: "Follow system setting" },
  { value: "light", label: "Light", description: "Always light" },
  { value: "dark", label: "Dark", description: "Always dark" },
];

export default function ThemeCard() {
  const { mode, effective, setMode } = useTheme();
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-slate-800">Appearance</h3>
      <p className="text-sm text-slate-500 mt-1">
        Choose how the app should look. Auto follows your operating
        system. Currently displaying:{" "}
        <span className="font-semibold capitalize">{effective}</span>.
      </p>
      <div className="mt-3 grid sm:grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const selected = mode === opt.value;
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`text-left rounded-md border p-3 transition-colors ${
                selected
                  ? "border-brand-500 ring-1 ring-brand-500 bg-brand-50"
                  : "border-slate-300 hover:bg-slate-50"
              }`}
              aria-pressed={selected}
            >
              <div className="font-semibold text-slate-800 flex items-center gap-2">
                <ThemeIcon mode={opt.value} />
                {opt.label}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {opt.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === "light") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  if (mode === "dark") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M8 20h8M12 18v2" />
    </svg>
  );
}
