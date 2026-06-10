import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** Require typing this exact phrase to enable confirm button. */
  confirmPhrase?: string;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  const [phraseInput, setPhraseInput] = useState("");

  const confirm = useCallback<ConfirmFn>((opts) => {
    setPhraseInput("");
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const close = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
    setPhraseInput("");
  };

  const phraseRequired = !!pending?.confirmPhrase;
  const phraseOk = !phraseRequired || phraseInput === pending?.confirmPhrase;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") close(false);
            if (e.key === "Enter" && phraseOk) close(true);
          }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b">
              <h2 id="confirm-title" className="font-semibold text-slate-800">
                {pending.title ?? "Please confirm"}
              </h2>
            </div>
            <div className="p-5 text-sm text-slate-700 space-y-3">
              <div>{pending.message}</div>
              {phraseRequired && (
                <div>
                  <label className="label">
                    Type <span className="font-mono">{pending.confirmPhrase}</span> to
                    confirm
                  </label>
                  <input
                    autoFocus
                    className="input"
                    value={phraseInput}
                    onChange={(e) => setPhraseInput(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => close(false)}
              >
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                disabled={!phraseOk}
                className={pending.tone === "danger" ? "btn-danger" : "btn-primary"}
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
