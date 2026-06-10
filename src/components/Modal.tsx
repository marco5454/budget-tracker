import type { ReactNode } from "react";

export default function Modal({
  open,
  title,
  children,
  onClose,
  widthClass = "max-w-2xl",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  widthClass?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-full ${widthClass} my-8`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
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
