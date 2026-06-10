import { useEffect, useState, useCallback } from "react";

interface ReceiptViewerProps {
  open: boolean;
  dataUrl?: string;
  filenameHint?: string;
  onClose: () => void;
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.25;

function detectKind(dataUrl: string): "image" | "pdf" | "other" {
  const m = /^data:([^;,]+)/.exec(dataUrl);
  const mime = m?.[1] ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  return "other";
}

export default function ReceiptViewer({
  open,
  dataUrl,
  filenameHint,
  onClose,
}: ReceiptViewerProps) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!open) {
      setZoom(1);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || (e.key === "=" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
      }
      if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
      }
      if (e.key === "0") {
        setZoom(1);
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
    setZoom((z) => {
      const n = +(z + dir * ZOOM_STEP).toFixed(2);
      return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, n));
    });
  }, []);

  if (!open || !dataUrl) return null;

  const kind = detectKind(dataUrl);
  const filename =
    filenameHint ||
    (kind === "image" ? "receipt.png" : kind === "pdf" ? "receipt.pdf" : "receipt");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Receipt viewer"
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/85"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900 text-slate-100 border-b border-slate-700">
        <div className="text-sm truncate">
          <span className="font-semibold">Receipt</span>
          <span className="ml-2 text-slate-400 text-xs uppercase">{kind}</span>
        </div>
        <div className="flex items-center gap-1">
          {kind === "image" && (
            <>
              <button
                type="button"
                title="Zoom out (-)"
                aria-label="Zoom out"
                className="px-2 py-1 rounded hover:bg-slate-800"
                onClick={() =>
                  setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))
                }
              >
                −
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded hover:bg-slate-800 text-xs tabular-nums"
                title="Reset zoom (0)"
                aria-label="Reset zoom"
                onClick={() => setZoom(1)}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                title="Zoom in (+)"
                aria-label="Zoom in"
                className="px-2 py-1 rounded hover:bg-slate-800"
                onClick={() =>
                  setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))
                }
              >
                +
              </button>
              <span className="mx-1 h-5 w-px bg-slate-700" />
            </>
          )}
          <a
            href={dataUrl}
            download={filename}
            className="px-2 py-1 rounded hover:bg-slate-800 text-sm"
            title="Download receipt"
          >
            Download
          </a>
          <a
            href={dataUrl}
            target="_blank"
            rel="noreferrer"
            className="px-2 py-1 rounded hover:bg-slate-800 text-sm"
            title="Open in new tab"
          >
            Open
          </a>
          <button
            type="button"
            aria-label="Close viewer"
            title="Close (Esc)"
            className="px-2 py-1 rounded hover:bg-slate-800 text-sm"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-auto"
        onWheel={onWheel}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {kind === "image" ? (
          <div className="min-h-full grid place-items-center p-4">
            <img
              src={dataUrl}
              alt="Receipt"
              className="block select-none"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
                maxWidth: zoom === 1 ? "100%" : "none",
                maxHeight: zoom === 1 ? "100%" : "none",
                transition: "transform 100ms ease-out",
              }}
              draggable={false}
            />
          </div>
        ) : kind === "pdf" ? (
          <iframe
            src={dataUrl}
            title="Receipt PDF"
            className="w-full h-full bg-white"
          />
        ) : (
          <div className="min-h-full grid place-items-center p-6 text-slate-200">
            <div className="text-center">
              <p>Unsupported receipt format.</p>
              <a
                href={dataUrl}
                download={filename}
                className="text-brand-300 underline mt-2 inline-block"
              >
                Download file
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-1.5 bg-slate-900/90 text-slate-400 text-xs border-t border-slate-700 flex justify-between">
        <span>
          {kind === "image"
            ? "Zoom: + / − / 0 to reset · Ctrl+Wheel to zoom"
            : "Press Esc to close"}
        </span>
        <span>Esc to close</span>
      </div>
    </div>
  );
}
