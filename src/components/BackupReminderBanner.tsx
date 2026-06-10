import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSetting } from "../hooks/useSetting";

const SESSION_DISMISS_KEY = "wbt:dismissedBackupReminder";

export default function BackupReminderBanner() {
  const lastBackupAt = useSetting<string | null>("lastBackupAt", null);
  const lastDataChangeAt = useSetting<string | null>("lastDataChangeAt", null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(SESSION_DISMISS_KEY) === "1");
  }, []);

  const shouldShow = (() => {
    if (dismissed) return false;
    if (!lastDataChangeAt) return false; // No data changed yet.
    if (!lastBackupAt) return true; // Data changed, never backed up.
    const changeMs = Date.parse(lastDataChangeAt);
    const backupMs = Date.parse(lastBackupAt);
    if (changeMs > backupMs) {
      // Changed since last backup — remind if it's been a week
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      return Date.now() - backupMs > weekMs || changeMs > backupMs;
    }
    return false;
  })();

  if (!shouldShow) return null;

  const dismiss = () => {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <strong>Backup reminder:</strong>{" "}
          {lastBackupAt
            ? "Your data has changed since your last backup."
            : "You haven't downloaded a backup yet."}{" "}
          <Link to="/settings" className="underline font-medium">
            Go to Settings to download one
          </Link>
          .
        </div>
        <button
          type="button"
          className="text-amber-800 hover:text-amber-900 underline"
          onClick={dismiss}
        >
          Dismiss for this session
        </button>
      </div>
    </div>
  );
}
