import { useEffect, useState, type ReactNode } from "react";
import { verifyLockHash } from "../utils/crypto";
import {
  getLockoutSnapshot,
  registerFailedAttempt,
  resetLockout,
  type LockoutSnapshot,
} from "../utils/lockout";
import { useIdleAutoLock, useLockState } from "../hooks/useLockState";

interface Props {
  children: ReactNode;
}

/**
 * Wraps the app and requires the user to enter the configured PIN/passphrase
 * before showing the children. If no lock is configured, this is transparent.
 *
 * Adds:
 *   - Idle auto-lock (10 min default; configurable in Settings).
 *   - Lock on tab hide (configurable in Settings).
 *   - Progressive cooldown after failed attempts.
 *   - Hard 15-min lockout after 10 failed attempts.
 */
export default function LockGate({ children }: Props) {
  const { lockHash, loading, unlocked, markUnlocked } = useLockState();
  useIdleAutoLock();

  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockoutSnap, setLockoutSnap] = useState<LockoutSnapshot>(() =>
    getLockoutSnapshot(),
  );

  // Tick the lockout countdown while the gate is shown.
  useEffect(() => {
    if (!lockHash || unlocked) return;
    const id = window.setInterval(() => {
      setLockoutSnap(getLockoutSnapshot());
    }, 500);
    return () => window.clearInterval(id);
  }, [lockHash, unlocked]);

  if (loading) {
    return (
      <div className="min-h-full grid place-items-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!lockHash || unlocked) {
    return <>{children}</>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const snap = getLockoutSnapshot();
    if (snap.message) {
      setError(snap.message);
      return;
    }
    setBusy(true);
    try {
      const ok = await verifyLockHash(pass, lockHash);
      if (!ok) {
        const next = registerFailedAttempt();
        setLockoutSnap(next);
        setError(next.message ?? "Incorrect PIN or passphrase.");
        setPass("");
        return;
      }
      resetLockout();
      markUnlocked();
    } catch (err) {
      setError((err as Error).message ?? "Unable to verify.");
    } finally {
      setBusy(false);
    }
  };

  const isCoolingDown = lockoutSnap.remainingMs > 0;

  return (
    <div className="min-h-full grid place-items-center p-6 bg-slate-100">
      <form onSubmit={submit} className="card p-6 max-w-sm w-full space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">
            Ward Budget Tracker
          </h1>
          <p className="text-sm text-slate-500">
            Enter your PIN or passphrase to unlock.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="lock-pass">
            PIN / Passphrase
          </label>
          <input
            id="lock-pass"
            type="password"
            inputMode="text"
            autoFocus
            autoComplete="current-password"
            className="input"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            disabled={busy || lockoutSnap.hardLocked}
            required
          />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!error && lockoutSnap.fails > 0 && (
          <div className="text-xs text-amber-700">
            Failed attempts: {lockoutSnap.fails}
            {lockoutSnap.hardLocked ? "" : " of 10"}
          </div>
        )}
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={busy || isCoolingDown}
        >
          {busy
            ? "Verifying…"
            : isCoolingDown
              ? "Please wait…"
              : "Unlock"}
        </button>
        <p className="text-xs text-slate-500 text-center">
          Forgot it? Restore from a backup on a fresh browser, or clear the
          app's site data to reset (you will lose unbacked-up data).
        </p>
      </form>
    </div>
  );
}
