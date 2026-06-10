import { useEffect, useRef, type ReactNode } from "react";

export default function Modal({
  open,
  title,
  children,
  onClose,
  widthClass = "max-w-2xl",
  dirty = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  widthClass?: string;
  /** If true, ESC and backdrop will warn before closing. */
  dirty?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    // Focus the first focusable element in the dialog
    const t = setTimeout(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        'input,select,textarea,button:not([aria-label="Close"]),[tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 50);
    return () => {
      clearTimeout(t);
      previousFocus.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        attemptClose();
      } else if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty]);

  const attemptClose = () => {
    if (
      dirty &&
      !window.confirm("Discard your unsaved changes?")
    ) {
      return;
    }
    onClose();
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-4 overflow-y-auto"
      onClick={attemptClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`bg-white rounded-lg shadow-xl w-full ${widthClass} my-8`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 id="modal-title" className="font-semibold text-slate-800">
            {title}
          </h2>
          <button
            type="button"
            onClick={attemptClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
