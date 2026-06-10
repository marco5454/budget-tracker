import { useEffect, useState, type ReactNode } from "react";
import { db } from "../db/db";
import { type LockHash, verifyLockHash } from "../utils/crypto";

interface Props {
  children: ReactNode;
}

/**
 * Wrap the app and require the user to enter the configured PIN/passphrase
 * before showing the children. If no lock is configured, this is a no-op.
 */
export default function LockGate({ children }: Props) {
  const [checking, setChecking] = useState(true);
  const [lock, setLock] = useState<LockHash | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const row = await db.settings.get("lockHash");
        const stored = (row?.value ?? null) as LockHash | null;
        setLock(stored);
      } catch {
        setLock(null);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  if (checking) {
    return (
      <div className="min-h-full grid place-items-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!lock || unlocked) {
    return <>{children}</>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const ok = await verifyLockHash(pass, lock);
      if (!ok) {
        setError("Incorrect PIN or passphrase.");
        setPass("");
        return;
      }
      setUnlocked(true);
    } catch (err) {
      setError((err as Error).message ?? "Unable to verify.");
    } finally {
      setBusy(false);
    }
  };

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
            required
          />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Verifying…" : "Unlock"}
        </button>
        <p className="text-xs text-slate-500 text-center">
          Forgot it? Restore from a backup on a fresh browser, or clear the
          app's site data to reset (you will lose unbacked-up data).
        </p>
      </form>
    </div>
  );
}
