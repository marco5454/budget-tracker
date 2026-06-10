import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLockState } from "./useLockState";

export interface ShortcutBinding {
  combo: string;
  description: string;
}

/**
 * Common shortcuts available across the app. Used by both the runtime
 * handler and the help dialog so the lists never drift apart.
 */
export const SHORTCUTS: ShortcutBinding[] = [
  { combo: "G then D", description: "Go to Dashboard" },
  { combo: "G then T", description: "Go to Transactions" },
  { combo: "G then B", description: "Go to Budget" },
  { combo: "G then R", description: "Go to Reports" },
  { combo: "G then S", description: "Go to Settings" },
  { combo: "G then H", description: "Go to Help" },
  { combo: "N", description: "Add a new transaction (on Transactions or Dashboard)" },
  { combo: "L", description: "Lock the app (if a PIN is set)" },
  { combo: "?", description: "Show this shortcuts dialog" },
  { combo: "Esc", description: "Close dialogs" },
];

/**
 * isTypingTarget — true when the focused element is an editable field, in
 * which case we should not steal keystrokes for shortcuts.
 */
function isTypingTarget(t: EventTarget | null): boolean {
  if (!t) return false;
  const el = t as HTMLElement;
  if (el.isContentEditable) return true;
  const tag = (el.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * useKeyboardShortcuts wires global keyboard navigation. Two-key sequences
 * use a "G then X" pattern (Vim-like) where pressing G arms a 1.5-second
 * window for the second key. Single-key shortcuts work as-is.
 *
 * The hook also exposes shortcutsOpen state and an openShortcuts() callback
 * so a help dialog rendered by the Layout can show the cheatsheet.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const lockState = useLockState();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

  useEffect(() => {
    let armedG = false;
    let armTimer: number | null = null;

    const disarm = () => {
      armedG = false;
      if (armTimer !== null) {
        window.clearTimeout(armTimer);
        armTimer = null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore while typing in inputs (allow Esc to bubble to modal handlers).
      if (isTypingTarget(e.target)) return;
      // Ignore when modifiers are held — these are reserved for browser/OS.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const k = e.key;

      // "?" — show shortcuts. (Shift-/ on US layouts.)
      if (k === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // G-prefixed navigation.
      if (armedG) {
        const dest: Record<string, string> = {
          d: "/",
          t: "/transactions",
          b: "/budget",
          r: "/reports",
          s: "/settings",
          h: "/help",
        };
        const target = dest[k.toLowerCase()];
        if (target) {
          e.preventDefault();
          disarm();
          navigate(target);
          return;
        }
        // Anything else cancels arming.
        disarm();
      }

      if (k.toLowerCase() === "g") {
        armedG = true;
        armTimer = window.setTimeout(disarm, 1500);
        return;
      }

      // Single-letter shortcuts.
      if (k.toLowerCase() === "n") {
        // Dispatch a custom event the active page can listen to.
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("wbt:shortcut-new-transaction"));
        return;
      }

      if (k.toLowerCase() === "l") {
        if (lockState.lockHash) {
          e.preventDefault();
          lockState.lock();
        }
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      disarm();
    };
  }, [navigate, lockState]);

  return { shortcutsOpen, openShortcuts, closeShortcuts };
}
