import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeouts = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
    const handle = timeouts.current.get(id);
    if (handle) clearTimeout(handle);
    timeouts.current.delete(id);
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "info", duration = 3000) => {
      const id = nextId++;
      setToasts((cur) => [...cur, { id, message, tone, duration }]);
      const handle = setTimeout(() => remove(id), duration);
      timeouts.current.set(id, handle);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (m, d) => show(m, "success", d),
      error: (m, d) => show(m, "error", d ?? 5000),
      info: (m, d) => show(m, "info", d),
      warning: (m, d) => show(m, "warning", d ?? 4500),
    }),
    [show],
  );

  useEffect(() => {
    const t = timeouts.current;
    return () => {
      t.forEach((h) => clearTimeout(h));
      t.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded-md shadow-lg border p-3 text-sm flex items-start gap-2 bg-white ${
              t.tone === "success"
                ? "border-emerald-300"
                : t.tone === "error"
                  ? "border-red-300"
                  : t.tone === "warning"
                    ? "border-amber-300"
                    : "border-slate-300"
            }`}
          >
            <div
              className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                t.tone === "success"
                  ? "bg-emerald-500"
                  : t.tone === "error"
                    ? "bg-red-500"
                    : t.tone === "warning"
                      ? "bg-amber-500"
                      : "bg-brand-500"
              }`}
            />
            <div className="flex-1 text-slate-800">{t.message}</div>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-700"
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
