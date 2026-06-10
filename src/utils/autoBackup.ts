import { db } from "../db/db";
import { exportBackup } from "./backup";
import { sha256Hex } from "./crypto";

/**
 * Auto-backup module.
 *
 * Uses the File System Access API (Chrome / Edge / Opera on desktop) to
 * persist a chosen folder handle and write JSON backups into it on a
 * user-configurable cadence.
 *
 * Settings keys used:
 *   - autoBackupHandle:    FileSystemDirectoryHandle (structured-cloned into IndexedDB)
 *   - autoBackupEnabled:   boolean
 *   - autoBackupFreqDays:  number (default 1 = daily)
 *   - autoBackupRetention: number (default 30; 1..180)
 *   - autoBackupLastAt:    ISO string of last successful auto-backup
 *   - autoBackupLastError: last error message, if any
 */

const KEYS = {
  handle: "autoBackupHandle",
  enabled: "autoBackupEnabled",
  freq: "autoBackupFreqDays",
  retention: "autoBackupRetention",
  lastAt: "autoBackupLastAt",
  lastError: "autoBackupLastError",
} as const;

const RETENTION_DEFAULT = 30;
const RETENTION_MIN = 1;
const RETENTION_MAX = 180;

/** Filename pattern produced by this module. Used for retention pruning. */
const BACKUP_FILENAME_RE = /^ward-budget-backup-.+\.json$/;

type DirHandle = FileSystemDirectoryHandle;

export function isAutoBackupSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
      "function"
  );
}

async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}
async function putSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export async function pickAutoBackupFolder(): Promise<DirHandle> {
  if (!isAutoBackupSupported()) {
    throw new Error("Your browser does not support choosing a folder. Use Chrome or Edge.");
  }
  const handle = await (
    window as unknown as {
      showDirectoryPicker: (opts?: { mode?: "read" | "readwrite" }) => Promise<DirHandle>;
    }
  ).showDirectoryPicker({ mode: "readwrite" });
  await putSetting(KEYS.handle, handle);
  // Default to enabled and daily when the user explicitly picks a folder.
  const existingEnabled = await getSetting<boolean>(KEYS.enabled);
  if (existingEnabled === undefined) await putSetting(KEYS.enabled, true);
  const existingFreq = await getSetting<number>(KEYS.freq);
  if (existingFreq === undefined) await putSetting(KEYS.freq, 1);
  const existingRetention = await getSetting<number>(KEYS.retention);
  if (existingRetention === undefined) await putSetting(KEYS.retention, RETENTION_DEFAULT);
  return handle;
}

export async function clearAutoBackupFolder(): Promise<void> {
  await db.settings.delete(KEYS.handle);
  await putSetting(KEYS.enabled, false);
  await db.settings.delete(KEYS.lastError);
}

export async function setAutoBackupEnabled(enabled: boolean): Promise<void> {
  await putSetting(KEYS.enabled, enabled);
}
export async function setAutoBackupFrequencyDays(days: number): Promise<void> {
  const safe = Math.max(1, Math.min(30, Math.round(days)));
  await putSetting(KEYS.freq, safe);
}
export async function setAutoBackupRetention(count: number): Promise<void> {
  const safe = Math.max(RETENTION_MIN, Math.min(RETENTION_MAX, Math.round(count)));
  await putSetting(KEYS.retention, safe);
}

export interface AutoBackupState {
  supported: boolean;
  hasHandle: boolean;
  enabled: boolean;
  frequencyDays: number;
  retention: number;
  lastAt: string | null;
  lastError: string | null;
  folderName: string | null;
  permission: PermissionState | "unknown";
}

export async function getAutoBackupState(): Promise<AutoBackupState> {
  const supported = isAutoBackupSupported();
  const handle = await getSetting<DirHandle>(KEYS.handle);
  const enabled = (await getSetting<boolean>(KEYS.enabled)) ?? false;
  const frequencyDays = (await getSetting<number>(KEYS.freq)) ?? 1;
  const retention = (await getSetting<number>(KEYS.retention)) ?? RETENTION_DEFAULT;
  const lastAt = (await getSetting<string>(KEYS.lastAt)) ?? null;
  const lastError = (await getSetting<string>(KEYS.lastError)) ?? null;

  let permission: PermissionState | "unknown" = "unknown";
  if (handle && typeof handle.queryPermission === "function") {
    try {
      permission = await handle.queryPermission({ mode: "readwrite" });
    } catch {
      permission = "unknown";
    }
  }

  return {
    supported,
    hasHandle: !!handle,
    enabled,
    frequencyDays,
    retention,
    lastAt,
    lastError,
    folderName: handle?.name ?? null,
    permission,
  };
}

/** Re-request permission if needed; returns true if granted. */
export async function ensurePermission(handle: DirHandle): Promise<boolean> {
  if (typeof handle.queryPermission !== "function") return true;
  const q = await handle.queryPermission({ mode: "readwrite" });
  if (q === "granted") return true;
  if (typeof handle.requestPermission !== "function") return false;
  const r = await handle.requestPermission({ mode: "readwrite" });
  return r === "granted";
}

function backupFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `ward-budget-backup-${stamp}.json`;
}

interface DirEntry {
  kind: "file" | "directory";
  name: string;
}

interface DirAsyncIterable {
  values(): AsyncIterable<DirEntry>;
}

async function listBackupFiles(handle: DirHandle): Promise<string[]> {
  const out: string[] = [];
  const iter = (handle as unknown as DirAsyncIterable).values?.();
  if (!iter) return out;
  for await (const entry of iter) {
    if (entry.kind === "file" && BACKUP_FILENAME_RE.test(entry.name)) {
      out.push(entry.name);
    }
  }
  return out;
}

/** Keep newest `keep` files, delete the rest. Filenames sort lexically by timestamp. */
async function pruneOldBackups(handle: DirHandle, keep: number): Promise<number> {
  const files = await listBackupFiles(handle);
  if (files.length <= keep) return 0;
  // Newest first because timestamp is in the filename.
  files.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const toDelete = files.slice(keep);
  let deleted = 0;
  for (const name of toDelete) {
    try {
      await handle.removeEntry(name);
      deleted++;
    } catch {
      // best-effort; ignore individual failures
    }
  }
  return deleted;
}

/** Write a string to a file in the directory. */
async function writeFile(handle: DirHandle, filename: string, contents: string): Promise<void> {
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}

/** Read back a file and return its text. */
async function readFile(handle: DirHandle, filename: string): Promise<string> {
  const fileHandle = await handle.getFileHandle(filename, { create: false });
  const file = await fileHandle.getFile();
  return await file.text();
}

/** Force a backup now. Performs read-back verification and retention pruning. */
export async function runAutoBackupNow(): Promise<{
  ok: true;
  filename: string;
  pruned: number;
}> {
  const handle = await getSetting<DirHandle>(KEYS.handle);
  if (!handle) throw new Error("No auto-backup folder selected.");
  const granted = await ensurePermission(handle);
  if (!granted) {
    await putSetting(KEYS.lastError, "Permission to write to folder was denied.");
    throw new Error("Permission to write to the chosen folder was denied.");
  }

  const data = await exportBackup();
  const json = JSON.stringify(data, null, 2);
  const expectedHash = await sha256Hex(json);
  const filename = backupFilename();

  try {
    await writeFile(handle, filename, json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown write error";
    await putSetting(KEYS.lastError, msg);
    throw new Error(`Failed to write backup file: ${msg}`);
  }

  // Read-back verification.
  try {
    const readBack = await readFile(handle, filename);
    const actualHash = await sha256Hex(readBack);
    if (actualHash !== expectedHash) {
      const msg = "Backup verification failed: file on disk does not match what was written.";
      await putSetting(KEYS.lastError, msg);
      throw new Error(msg);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown verification error";
    await putSetting(KEYS.lastError, msg);
    throw new Error(`Backup verification failed: ${msg}`);
  }

  // Retention pruning (best-effort, doesn't fail the backup).
  let pruned = 0;
  try {
    const retention = (await getSetting<number>(KEYS.retention)) ?? RETENTION_DEFAULT;
    pruned = await pruneOldBackups(handle, retention);
  } catch {
    // ignore prune errors
  }

  const now = new Date().toISOString();
  await putSetting(KEYS.lastAt, now);
  await db.settings.delete(KEYS.lastError);
  // Also update the regular lastBackupAt so the reminder banner clears.
  await putSetting("lastBackupAt", now);
  return { ok: true, filename, pruned };
}

/**
 * If auto-backup is enabled and the cadence is due, run a backup.
 * Silent on failure (records lastError instead). Safe to call on app start.
 */
export async function maybeRunAutoBackup(): Promise<void> {
  try {
    const state = await getAutoBackupState();
    if (!state.supported || !state.hasHandle || !state.enabled) return;

    const last = state.lastAt ? new Date(state.lastAt).getTime() : 0;
    const dueAfter = state.frequencyDays * 24 * 60 * 60 * 1000;
    if (Date.now() - last < dueAfter) return;

    const handle = await getSetting<DirHandle>(KEYS.handle);
    if (!handle) return;
    // Non-interactive: only proceed if permission already granted.
    if (typeof handle.queryPermission === "function") {
      const q = await handle.queryPermission({ mode: "readwrite" });
      if (q !== "granted") {
        await putSetting(
          KEYS.lastError,
          "Permission was not granted automatically. Open Settings and click 'Backup now' to grant access.",
        );
        return;
      }
    }
    await runAutoBackupNow();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await putSetting(KEYS.lastError, msg);
  }
}
