import { useState } from "react";
import { useSetting, setSetting } from "../hooks/useSetting";
import {
  DISCLAIMER_PARAGRAPHS,
  DISCLAIMER_TITLE,
} from "../utils/disclaimer";

const ACK_KEY = "disclaimerAcknowledgedAt";
const APP_VERSION = "1.0.0";
// Bump this if the disclaimer wording changes meaningfully so users re-ack.
const ACK_VERSION = "1";

export default function DisclaimerGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const acknowledgedAtSetting = useSetting<string>(ACK_KEY, "");
  const ackVersionSetting = useSetting<string>("disclaimerAckVersion", "");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  // Loading state: settings still being read.
  if (
    acknowledgedAtSetting === undefined ||
    ackVersionSetting === undefined
  ) {
    return null;
  }

  const acknowledged =
    !!acknowledgedAtSetting && ackVersionSetting === ACK_VERSION;

  if (acknowledged) return <>{children}</>;

  async function accept() {
    if (!agree || busy) return;
    setBusy(true);
    try {
      await setSetting(ACK_KEY, new Date().toISOString());
      await setSetting("disclaimerAckVersion", ACK_VERSION);
      await setSetting("disclaimerAppVersion", APP_VERSION);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/80 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="card w-full max-w-2xl my-8 shadow-2xl border-amber-300 dark:border-amber-700">
        <div className="bg-amber-100 dark:bg-amber-900/40 border-l-4 border-amber-500 px-5 py-3 mb-4 rounded">
          <h2
            id="disclaimer-title"
            className="text-lg font-bold text-amber-900 dark:text-amber-100"
          >
            {DISCLAIMER_TITLE}
          </h2>
        </div>
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
          {DISCLAIMER_PARAGRAPHS.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <label className="mt-5 flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-1 h-4 w-4 accent-brand-600"
          />
          <span className="text-sm text-slate-800 dark:text-slate-100">
            I understand this is a <strong>personal, unofficial</strong> tool —
            not affiliated with the Church — and I will reconcile all data with
            MLS/LCR.
          </span>
        </label>
        <div className="mt-5 flex justify-end">
          <button
            className="btn-primary"
            onClick={accept}
            disabled={!agree || busy}
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          You can re-read this notice any time from Settings → About.
        </p>
      </div>
    </div>
  );
}
