import { useState } from "react";
import {
  DISCLAIMER_PARAGRAPHS,
  DISCLAIMER_SHORT,
  DISCLAIMER_TITLE,
} from "../utils/disclaimer";
import { useToast } from "./Toast";

const APP_VERSION = "1.0.0";

export default function AboutCard() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function copyDisclaimer() {
    const text = `${DISCLAIMER_TITLE}\n\n${DISCLAIMER_PARAGRAPHS.join(
      "\n\n",
    )}\n\nWard Budget Tracker v${APP_VERSION}`;
    setBusy(true);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Disclaimer copied to clipboard.");
    } catch {
      toast.error("Could not copy to clipboard. Select and copy manually.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="text-lg font-semibold mb-2">About this app</h2>
      <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 px-4 py-3 mb-3 rounded text-sm">
        <strong className="text-amber-900 dark:text-amber-100">
          {DISCLAIMER_TITLE}
        </strong>
        <p className="mt-1 text-amber-900 dark:text-amber-100">
          {DISCLAIMER_SHORT}
        </p>
      </div>
      <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
        {DISCLAIMER_PARAGRAPHS.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>Version {APP_VERSION}</span>
        <span>·</span>
        <span>Local data only</span>
        <span>·</span>
        <button
          type="button"
          className="btn-secondary text-xs px-3 py-1"
          onClick={copyDisclaimer}
          disabled={busy}
        >
          {busy ? "Copying…" : "Copy disclaimer to clipboard"}
        </button>
      </div>
    </section>
  );
}
