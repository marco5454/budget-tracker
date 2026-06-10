/**
 * Failed-attempt lockout for the app lock screen.
 *
 * Lives in module state so it survives LockGate remounts within a session
 * but resets when the page is fully reloaded (which is acceptable — a
 * full reload is itself a user action that already requires the device).
 *
 * Policy (per Phase 1):
 *   - Each failed attempt adds a small cooldown before the next try.
 *     Sequence: 0s, 1s, 2s, 5s, 10s, 30s, 60s, 60s, 60s, ...
 *   - After 10 failed attempts: a hard 15-minute lockout.
 *   - Successful unlock resets everything.
 */

const COOLDOWNS_MS = [0, 1_000, 2_000, 5_000, 10_000, 30_000, 60_000];
const HARD_LOCKOUT_AT = 10;
const HARD_LOCKOUT_MS = 15 * 60 * 1000;

interface State {
  fails: number;
  /** Timestamp (ms) until which any unlock attempt is rejected. */
  blockedUntil: number;
  /** Timestamp (ms) until which the next attempt should wait (cooldown). */
  cooldownUntil: number;
  /** True if the hard 15-min lockout has been triggered. */
  hardLocked: boolean;
}

const state: State = {
  fails: 0,
  blockedUntil: 0,
  cooldownUntil: 0,
  hardLocked: false,
};

export interface LockoutSnapshot {
  fails: number;
  remainingMs: number;
  hardLocked: boolean;
  /** Friendly message for the UI when locked out, else null. */
  message: string | null;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.ceil(s / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

export function getLockoutSnapshot(): LockoutSnapshot {
  const now = Date.now();
  if (state.hardLocked && state.blockedUntil > now) {
    return {
      fails: state.fails,
      remainingMs: state.blockedUntil - now,
      hardLocked: true,
      message: `Too many failed attempts. Try again in ${formatDuration(state.blockedUntil - now)}.`,
    };
  }
  if (state.cooldownUntil > now) {
    return {
      fails: state.fails,
      remainingMs: state.cooldownUntil - now,
      hardLocked: false,
      message: `Please wait ${formatDuration(state.cooldownUntil - now)} before trying again.`,
    };
  }
  return { fails: state.fails, remainingMs: 0, hardLocked: false, message: null };
}

/** Call when an unlock attempt fails. Returns the new snapshot. */
export function registerFailedAttempt(): LockoutSnapshot {
  state.fails += 1;
  if (state.fails >= HARD_LOCKOUT_AT) {
    state.hardLocked = true;
    state.blockedUntil = Date.now() + HARD_LOCKOUT_MS;
    state.cooldownUntil = state.blockedUntil;
  } else {
    const idx = Math.min(state.fails, COOLDOWNS_MS.length - 1);
    state.cooldownUntil = Date.now() + COOLDOWNS_MS[idx];
  }
  return getLockoutSnapshot();
}

/** Call after a successful unlock. */
export function resetLockout(): void {
  state.fails = 0;
  state.blockedUntil = 0;
  state.cooldownUntil = 0;
  state.hardLocked = false;
}
