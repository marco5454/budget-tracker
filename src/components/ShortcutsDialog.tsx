import { useEffect } from "react";
import { SHORTCUTS } from "../hooks/useKeyboardShortcuts";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutsDialog({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 id="shortcuts-title" className="font-semibold text-slate-800">
            Keyboard shortcuts
          </h2>
          <button
            className="text-slate-500 hover:text-slate-700"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4">
          <ul className="divide-y divide-slate-200">
            {SHORTCUTS.map((s) => (
              <li
                key={s.combo}
                className="py-2 flex items-center justify-between gap-3"
              >
                <span className="text-sm text-slate-700">{s.description}</span>
                <kbd className="px-2 py-0.5 text-xs font-mono rounded border border-slate-300 bg-slate-50 text-slate-700 whitespace-nowrap">
                  {s.combo}
                </kbd>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Tip: shortcuts are ignored while you're typing in a form field.
          </p>
        </div>
      </div>
    </div>
  );
}
