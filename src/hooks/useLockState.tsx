import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { db } from "../db/db";
import type { LockHash } from "../utils/crypto";

/**
 * Global lock state shared across the app.
 *
 * - `lockHash`        : current configured lock (or null if no lock).
 * - `unlocked`        : whether the user has currently unlocked.
 * - `lock()`          : force-relock immediately.
 * - `markUnlocked()`  : called by LockGate after successful verify.
 * - `idleMinutes`     : configurable idle timeout (1..60). 0 disables idle lock.
 * - `lockOnHide`      : if true, locks when the tab/page is hidden.
 *
 * Failed-attempt tracking lives in module-scope state because it must
 * survive remount of the gate component within the same session.
 */

interface LockStateValue {
  lockHash: LockHash | null;
  loading: boolean;
  unlocked: boolean;
  idleMinutes: number;
  lockOnHide: boolean;
  lock: () => void;
  markUnlocked: () => void;
  refreshLockHash: () => Promise<void>;
}

const Ctx = createContext<LockStateValue | null>(null);

const KEYS = {
  hash: "lockHash",
  idleMin: "lockIdleMinutes",
  lockOnHide: "lockOnTabHide",
};

const DEFAULT_IDLE_MIN = 10;

export function LockStateProvider({ children }: { children: ReactNode }) {
  const [lockHash, setLockHash] = useState<LockHash | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [idleMinutes, setIdleMinutes] = useState<number>(DEFAULT_IDLE_MIN);
  const [lockOnHide, setLockOnHide] = useState<boolean>(true);

  const refreshLockHash = useCallback(async () => {
    try {
      const [hashRow, idleRow, hideRow] = await Promise.all([
        db.settings.get(KEYS.hash),
        db.settings.get(KEYS.idleMin),
        db.settings.get(KEYS.lockOnHide),
      ]);
      setLockHash((hashRow?.value ?? null) as LockHash | null);
      const idle = idleRow?.value;
      if (typeof idle === "number" && idle >= 0 && idle <= 60) {
        setIdleMinutes(idle);
      } else {
        setIdleMinutes(DEFAULT_IDLE_MIN);
      }
      const hide = hideRow?.value;
      setLockOnHide(typeof hide === "boolean" ? hide : true);
    } catch {
      setLockHash(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLockHash();
  }, [refreshLockHash]);

  // Re-fetch on storage changes via Dexie hooks would be heavier; just
  // poll lightly — Settings page also calls refreshLockHash directly via
  // a custom event for snappy UI.
  useEffect(() => {
    const handler = () => void refreshLockHash();
    window.addEventListener("wbt:lock-settings-changed", handler);
    return () => window.removeEventListener("wbt:lock-settings-changed", handler);
  }, [refreshLockHash]);

  const lock = useCallback(() => setUnlocked(false), []);
  const markUnlocked = useCallback(() => setUnlocked(true), []);

  const value = useMemo<LockStateValue>(
    () => ({
      lockHash,
      loading,
      unlocked,
      idleMinutes,
      lockOnHide,
      lock,
      markUnlocked,
      refreshLockHash,
    }),
    [lockHash, loading, unlocked, idleMinutes, lockOnHide, lock, markUnlocked, refreshLockHash],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLockState(): LockStateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLockState must be used within LockStateProvider");
  return v;
}

/**
 * Idle / tab-hide auto-lock. Active only when the lock is configured AND
 * the user is currently unlocked. Calls `lock()` after `idleMinutes` of
 * no user activity, or on visibilitychange when `lockOnHide` is true.
 */
export function useIdleAutoLock(): void {
  const { lockHash, unlocked, idleMinutes, lockOnHide, lock } = useLockState();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Only run when there is a lock configured AND we're currently unlocked.
    if (!lockHash || !unlocked) return;

    const minutes = Math.max(0, Math.min(60, idleMinutes));
    const reset = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (minutes > 0) {
        timerRef.current = window.setTimeout(() => lock(), minutes * 60 * 1000);
      }
    };

    const onActivity = () => reset();
    const onVisibility = () => {
      if (document.hidden && lockOnHide) {
        lock();
      } else if (!document.hidden) {
        reset();
      }
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
    ];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    reset();

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [lockHash, unlocked, idleMinutes, lockOnHide, lock]);
}

/** Helper for Settings page to broadcast a refresh after changing lock settings. */
export function notifyLockSettingsChanged(): void {
  window.dispatchEvent(new CustomEvent("wbt:lock-settings-changed"));
}
