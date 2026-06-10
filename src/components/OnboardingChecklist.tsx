import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useSetting, setSetting } from "../hooks/useSetting";
import { getAutoBackupState } from "../utils/autoBackup";

interface ChecklistItem {
  key: string;
  title: string;
  description: string;
  done: boolean;
  to: string;
  cta: string;
}

/**
 * OnboardingChecklist — short setup checklist shown at the top of the
 * Dashboard. Auto-detects progress from settings + DB so the user never
 * has to manually tick anything; once everything is done (or the user
 * dismisses it) it disappears.
 *
 * Dismissal is persisted via the `onboardingDismissed` setting so it
 * survives reloads. The user can still re-show it from Settings if we
 * add that toggle later.
 */
export default function OnboardingChecklist() {
  const wardName = useSetting<string>("wardName", "");
  const actor = useSetting<string>("currentActor", "");
  const dismissed = useSetting<boolean>("onboardingDismissed", false);

  const allocCount = useLiveQuery(
    () => db.allocations.filter((a) => !a.deletedAt).count(),
    [],
  );

  const [autoBackupConfigured, setAutoBackupConfigured] = useState<boolean | null>(
    null,
  );

  // Read auto-backup state once; it's cheap and rarely changes.
  // useState + simple promise here avoids a new hook just for this.
  if (autoBackupConfigured === null) {
    getAutoBackupState()
      .then((s) => setAutoBackupConfigured(!!s.hasHandle))
      .catch(() => setAutoBackupConfigured(false));
  }

  if (dismissed) return null;

  const items: ChecklistItem[] = [
    {
      key: "ward",
      title: "Set your ward name",
      description: "Shown in the header and on printed reports.",
      done: !!wardName.trim(),
      to: "/settings",
      cta: "Open Settings",
    },
    {
      key: "actor",
      title: "Pick the active actor",
      description: "So audit log entries are attributed correctly.",
      done: !!actor.trim(),
      to: "/settings",
      cta: "Open Settings",
    },
    {
      key: "backup",
      title: "Set up an auto-backup folder",
      description:
        "Pick a cloud-synced folder (OneDrive, Drive, iCloud, Dropbox, Syncthing) so backups are safe.",
      done: !!autoBackupConfigured,
      to: "/settings",
      cta: "Open Settings",
    },
    {
      key: "alloc",
      title: "Add your first allocation",
      description:
        "Set the annual or quarterly budget per organization on the Budget page.",
      done: !!allocCount && allocCount > 0,
      to: "/budget",
      cta: "Open Budget",
    },
  ];

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  if (completed === total) return null; // All done — hide it.

  const dismiss = () => {
    void setSetting("onboardingDismissed", true);
  };

  const pct = Math.round((completed / total) * 100);

  return (
    <div className="card p-4 border-brand-200 bg-brand-50/50">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-800">
            Welcome — let's finish setup
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {completed} of {total} done
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-slate-500 hover:text-slate-700 underline"
          onClick={dismiss}
        >
          Hide checklist
        </button>
      </div>
      <div className="w-full bg-white border border-slate-200 rounded-full h-2 mb-3 overflow-hidden">
        <div
          className="bg-brand-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-3 bg-white rounded border border-slate-200 p-2"
          >
            <span
              className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full mt-0.5 ${
                item.done
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
              aria-hidden
            >
              {item.done ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                ""
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm font-medium ${
                  item.done ? "text-slate-500 line-through" : "text-slate-800"
                }`}
              >
                {item.title}
              </div>
              <div className="text-xs text-slate-600">{item.description}</div>
            </div>
            {!item.done && (
              <Link
                to={item.to}
                className="text-xs font-semibold text-brand-700 hover:underline whitespace-nowrap"
              >
                {item.cta} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
