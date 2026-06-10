import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { downloadBackup, importBackup } from "../utils/backup";
import {
  pickAutoBackupFolder,
  clearAutoBackupFolder,
  setAutoBackupEnabled,
  setAutoBackupFrequencyDays,
  getAutoBackupState,
  runAutoBackupNow,
  type AutoBackupState,
} from "../utils/autoBackup";
import { setSetting, useSetting } from "../hooks/useSetting";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/Confirm";
import { createLockHash, type LockHash } from "../utils/crypto";

export default function Settings() {
  const wardName = useSetting<string>("wardName", "");
  const currency = useSetting<string>("currency", "PHP");
  const lastBackupAt = useSetting<string | null>("lastBackupAt", null);
  const lockHash = useSetting<LockHash | null>("lockHash", null);

  const orgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const cats = useLiveQuery(() => db.categories.toArray(), []);

  const toast = useToast();
  const confirm = useConfirm();

  // Local drafts so users see explicit Save buttons.
  const [wardDraft, setWardDraft] = useState(wardName);
  const [currencyDraft, setCurrencyDraft] = useState(currency);
  useEffect(() => setWardDraft(wardName), [wardName]);
  useEffect(() => setCurrencyDraft(currency), [currency]);

  const [orgDraft, setOrgDraft] = useState<Record<number, string>>({});
  const [newOrg, setNewOrg] = useState("");
  const [newCat, setNewCat] = useState("");
  const [newCatOrg, setNewCatOrg] = useState<number | "">("");

  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const fileRef = useRef<HTMLInputElement>(null);

  // App-lock UI state
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);

  // Auto-backup state
  const [autoState, setAutoState] = useState<AutoBackupState | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const refreshAutoState = async () => {
    try {
      setAutoState(await getAutoBackupState());
    } catch {
      // ignore
    }
  };
  useEffect(() => {
    refreshAutoState();
  }, []);

  const wardDirty = wardDraft !== wardName;
  const currencyDirty = currencyDraft !== currency;

  const saveWardInfo = async () => {
    try {
      if (wardDirty) await setSetting("wardName", wardDraft);
      if (currencyDirty) await setSetting("currency", currencyDraft);
      toast.success("Ward info saved.");
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
    }
  };

  const startOrgEdit = (id: number, currentName: string) =>
    setOrgDraft((d) => ({ ...d, [id]: currentName }));
  const cancelOrgEdit = (id: number) =>
    setOrgDraft((d) => {
      const c = { ...d };
      delete c[id];
      return c;
    });
  const saveOrg = async (id: number) => {
    const name = (orgDraft[id] ?? "").trim();
    if (!name) {
      toast.error("Organization name cannot be empty.");
      return;
    }
    try {
      await db.organizations.update(id, { name });
      cancelOrgEdit(id);
      toast.success("Organization renamed.");
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
    }
  };

  const addOrg = async () => {
    const name = newOrg.trim();
    if (!name) return;
    try {
      const maxOrder = (orgs ?? []).reduce((m, o) => Math.max(m, o.order), 0);
      await db.organizations.add({ name, order: maxOrder + 1, active: true });
      setNewOrg("");
      toast.success("Organization added.");
    } catch (err) {
      toast.error(`Add failed: ${(err as Error).message}`);
    }
  };
  const toggleOrg = async (id: number, active: boolean) => {
    try {
      await db.organizations.update(id, { active });
    } catch (err) {
      toast.error(`Update failed: ${(err as Error).message}`);
    }
  };
  const deleteOrg = async (id: number, name: string) => {
    const used = await db.transactions.where("organizationId").equals(id).count();
    if (used > 0) {
      toast.warning(
        `Cannot delete '${name}': ${used} transaction(s) reference it. Deactivate it instead.`,
      );
      return;
    }
    const ok = await confirm({
      title: "Delete organization?",
      message: `Permanently delete '${name}'?`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await db.organizations.delete(id);
      toast.success("Organization deleted.");
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  const addCat = async () => {
    const name = newCat.trim();
    if (!name) return;
    try {
      await db.categories.add({
        name,
        organizationId: newCatOrg === "" ? null : Number(newCatOrg),
        active: true,
      });
      setNewCat("");
      toast.success("Category added.");
    } catch (err) {
      toast.error(`Add failed: ${(err as Error).message}`);
    }
  };
  const toggleCat = async (id: number, active: boolean) => {
    try {
      await db.categories.update(id, { active });
    } catch (err) {
      toast.error(`Update failed: ${(err as Error).message}`);
    }
  };
  const deleteCat = async (id: number, name: string) => {
    const used = await db.transactions.where("categoryId").equals(id).count();
    if (used > 0) {
      toast.warning(
        `Cannot delete '${name}': ${used} transaction(s) reference it. Deactivate it instead.`,
      );
      return;
    }
    const ok = await confirm({
      title: "Delete category?",
      message: `Permanently delete '${name}'?`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await db.categories.delete(id);
      toast.success("Category deleted.");
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  const onImport = async (file: File | null) => {
    if (!file) return;
    if (importMode === "replace") {
      const ok = await confirm({
        title: "Replace all data?",
        message:
          "This will WIPE everything currently in the app and replace it with the contents of the backup file. Make sure you have a separate backup first.",
        tone: "danger",
        confirmLabel: "Replace",
        confirmPhrase: "REPLACE",
      });
      if (!ok) {
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
    }
    try {
      const result = await importBackup(file, importMode);
      const counts = result.imported;
      toast.success(
        `Imported: ${counts.transactions} txns, ${counts.allocations} allocations, ${counts.organizations} orgs, ${counts.categories} cats.`,
      );
      if (result.warnings.length > 0) {
        toast.warning(
          `${result.warnings.length} row(s) skipped due to invalid data. See console for details.`,
        );
        // eslint-disable-next-line no-console
        console.warn("Backup import warnings:", result.warnings);
      }
    } catch (err) {
      toast.error(`Import failed: ${(err as Error).message}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const wipeAll = async () => {
    const ok = await confirm({
      title: "Wipe all data?",
      message:
        "This will permanently delete ALL transactions, allocations, organizations, categories, and settings on this device. Type WIPE to confirm.",
      tone: "danger",
      confirmLabel: "Wipe everything",
      confirmPhrase: "WIPE",
    });
    if (!ok) return;
    try {
      await db.transaction(
        "rw",
        [db.organizations, db.categories, db.transactions, db.allocations, db.settings],
        async () => {
          await Promise.all([
            db.transactions.clear(),
            db.allocations.clear(),
            db.categories.clear(),
            db.organizations.clear(),
            db.settings.clear(),
          ]);
        },
      );
      toast.success("All data wiped. Reloading…");
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast.error(`Wipe failed: ${(err as Error).message}`);
    }
  };

  // ---- App lock handlers ----
  const enableLock = async () => {
    if (pin1.length < 4) {
      toast.error("Use at least 4 characters for the PIN/passphrase.");
      return;
    }
    if (pin1 !== pin2) {
      toast.error("Entries do not match.");
      return;
    }
    const ok = await confirm({
      title: "Enable app lock?",
      message:
        "If you forget this PIN/passphrase, the only way to recover your data is to restore from a backup on a fresh browser, or clear the app's data. Continue?",
      confirmLabel: "Enable lock",
    });
    if (!ok) return;
    setPinSubmitting(true);
    try {
      const hash = await createLockHash(pin1);
      await setSetting("lockHash", hash);
      setPin1("");
      setPin2("");
      toast.success("App lock enabled. It will be required next time you open the app.");
    } catch (err) {
      toast.error(`Failed to enable lock: ${(err as Error).message}`);
    } finally {
      setPinSubmitting(false);
    }
  };

  const disableLock = async () => {
    const ok = await confirm({
      title: "Remove app lock?",
      message: "Anyone with access to this browser will be able to view your data without a prompt.",
      tone: "danger",
      confirmLabel: "Remove lock",
    });
    if (!ok) return;
    try {
      await db.settings.delete("lockHash");
      toast.success("App lock removed.");
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">
          Configure ward info, organizations, categories, security, and backups.
        </p>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Ward Information</h3>
          {(wardDirty || currencyDirty) && (
            <span className="text-xs text-amber-700">Unsaved changes</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ward-name">
              Ward name (shown in header)
            </label>
            <input
              id="ward-name"
              className="input"
              value={wardDraft}
              onChange={(e) => setWardDraft(e.target.value)}
              placeholder="e.g., Sample Ward"
            />
          </div>
          <div>
            <label className="label" htmlFor="ward-currency">Currency code</label>
            <select
              id="ward-currency"
              className="input"
              value={currencyDraft}
              onChange={(e) => setCurrencyDraft(e.target.value)}
            >
              <option value="PHP">PHP — Philippine Peso (₱)</option>
              <option value="USD">USD — US Dollar ($)</option>
              <option value="EUR">EUR — Euro (€)</option>
              <option value="GBP">GBP — British Pound (£)</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={!wardDirty && !currencyDirty}
            onClick={() => {
              setWardDraft(wardName);
              setCurrencyDraft(currency);
            }}
          >
            Reset
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!wardDirty && !currencyDirty}
            onClick={saveWardInfo}
          >
            Save
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold text-slate-800">Auto-Backup to Folder</h3>
          {autoState?.supported === false && (
            <span className="badge bg-amber-100 text-amber-800 border-amber-200">
              Not supported in this browser
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600">
          Automatically write a JSON backup into a folder you choose
          {" "}(works in Chrome, Edge, and other Chromium-based browsers). When
          your data has changed and the cadence is due, the next time the app
          opens it will save a fresh backup file there. You can also click{" "}
          <em>Backup now</em> at any time.
        </p>

        {!autoState?.supported ? (
          <p className="text-sm text-slate-500">
            Use the manual <strong>Download backup</strong> button below
            instead, and save the file to a safe location yourself.
          </p>
        ) : !autoState?.hasHandle ? (
          <div>
            <button
              className="btn-primary"
              disabled={autoBusy}
              onClick={async () => {
                setAutoBusy(true);
                try {
                  await pickAutoBackupFolder();
                  toast.success("Auto-backup folder selected.");
                  await refreshAutoState();
                } catch (err) {
                  const msg = (err as Error).message || "";
                  if (!msg.toLowerCase().includes("abort")) {
                    toast.error(`Could not select folder: ${msg}`);
                  }
                } finally {
                  setAutoBusy(false);
                }
              }}
            >
              Choose backup folder…
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-slate-700">
              <div>
                <strong>Folder:</strong> {autoState.folderName ?? "(unknown)"}
              </div>
              <div>
                <strong>Permission:</strong>{" "}
                <span
                  className={
                    autoState.permission === "granted"
                      ? "text-green-700"
                      : "text-amber-700"
                  }
                >
                  {autoState.permission}
                </span>
              </div>
              {autoState.lastAt && (
                <div>
                  <strong>Last auto-backup:</strong>{" "}
                  {new Date(autoState.lastAt).toLocaleString()}
                </div>
              )}
              {autoState.lastError && (
                <div className="text-red-700">
                  <strong>Last error:</strong> {autoState.lastError}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoState.enabled}
                  onChange={async (e) => {
                    await setAutoBackupEnabled(e.target.checked);
                    await refreshAutoState();
                  }}
                />
                Enabled
              </label>

              <div>
                <label className="label" htmlFor="auto-freq">
                  Run every (days)
                </label>
                <input
                  id="auto-freq"
                  type="number"
                  min={1}
                  max={30}
                  className="input w-24"
                  value={autoState.frequencyDays}
                  onChange={async (e) => {
                    const n = Number(e.target.value) || 1;
                    await setAutoBackupFrequencyDays(n);
                    await refreshAutoState();
                  }}
                />
              </div>

              <button
                className="btn btn-secondary"
                disabled={autoBusy}
                onClick={async () => {
                  setAutoBusy(true);
                  try {
                    const r = await runAutoBackupNow();
                    toast.success(`Backup written: ${r.filename}`);
                    await refreshAutoState();
                  } catch (err) {
                    toast.error((err as Error).message);
                    await refreshAutoState();
                  } finally {
                    setAutoBusy(false);
                  }
                }}
              >
                Backup now
              </button>

              <button
                className="btn btn-danger"
                disabled={autoBusy}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Forget auto-backup folder?",
                    message:
                      "The app will stop writing automatic backups. Your existing backup files will not be deleted.",
                    tone: "danger",
                    confirmLabel: "Forget folder",
                  });
                  if (!ok) return;
                  await clearAutoBackupFolder();
                  toast.success("Auto-backup folder cleared.");
                  await refreshAutoState();
                }}
              >
                Forget folder
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-4 space-y-4">
        <h3 className="font-semibold text-slate-800">Backup &amp; Restore</h3>
        <p className="text-sm text-slate-600">
          All data is stored only on this device. Always keep a recent backup.
          {lastBackupAt && (
            <>
              {" "}
              <span className="text-slate-500">
                Last backup: {new Date(lastBackupAt).toLocaleString()}
              </span>
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <button
            className="btn-primary"
            onClick={async () => {
              try {
                await downloadBackup();
                toast.success("Backup downloaded.");
              } catch (err) {
                toast.error(`Backup failed: ${(err as Error).message}`);
              }
            }}
          >
            Download backup (JSON)
          </button>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="import-mode">Import mode</label>
              <select
                id="import-mode"
                className="input"
                value={importMode}
                onChange={(e) =>
                  setImportMode(e.target.value as "merge" | "replace")
                }
              >
                <option value="merge">Merge (keep existing, overwrite by ID)</option>
                <option value="replace">Replace (wipe then import)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="import-file">Backup file</label>
              <input
                id="import-file"
                ref={fileRef}
                type="file"
                accept="application/json"
                onChange={(e) => onImport(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-3">
          <button className="btn-danger" onClick={wipeAll}>
            Wipe all data
          </button>
          <p className="text-xs text-slate-500 mt-2">
            Use this to start over. Make a backup first.
          </p>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <h3 className="font-semibold text-slate-800">App Lock (optional)</h3>
        <p className="text-sm text-slate-600">
          Require a PIN or passphrase before the app data is shown. This guards
          against casual access if someone else uses this browser. It does
          <strong> not</strong> encrypt your data — for full confidentiality,
          use OS-level disk encryption.
        </p>
        {lockHash ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge bg-emerald-100 text-emerald-700">
              Lock is enabled
            </span>
            <button className="btn-danger" onClick={disableLock}>
              Remove lock
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="pin1">
                  PIN or passphrase
                </label>
                <input
                  id="pin1"
                  type="password"
                  className="input"
                  value={pin1}
                  onChange={(e) => setPin1(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="label" htmlFor="pin2">Confirm</label>
                <input
                  id="pin2"
                  type="password"
                  className="input"
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                className="btn-primary"
                onClick={enableLock}
                disabled={pinSubmitting}
              >
                {pinSubmitting ? "Saving…" : "Enable lock"}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Only a salted hash is stored — your PIN is never written to disk.
            </p>
          </div>
        )}
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-slate-800">Organizations</h3>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="New organization name"
            value={newOrg}
            onChange={(e) => setNewOrg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addOrg()}
            aria-label="New organization name"
          />
          <button className="btn-primary" onClick={addOrg}>
            Add
          </button>
        </div>
        <ul className="divide-y">
          {orgs?.map((o) => {
            const editing = o.id! in orgDraft;
            return (
              <li key={o.id} className="py-2 flex items-center gap-2 flex-wrap">
                {editing ? (
                  <>
                    <input
                      className="input flex-1 min-w-[12rem]"
                      value={orgDraft[o.id!]}
                      onChange={(e) =>
                        setOrgDraft((d) => ({ ...d, [o.id!]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveOrg(o.id!);
                        if (e.key === "Escape") cancelOrgEdit(o.id!);
                      }}
                      autoFocus
                      aria-label={`Edit name of ${o.name}`}
                    />
                    <button
                      className="text-sm text-brand-700 hover:underline"
                      onClick={() => saveOrg(o.id!)}
                    >
                      Save
                    </button>
                    <button
                      className="text-sm text-slate-600 hover:underline"
                      onClick={() => cancelOrgEdit(o.id!)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{o.name}</span>
                    <button
                      className="text-sm text-brand-700 hover:underline"
                      onClick={() => startOrgEdit(o.id!, o.name)}
                    >
                      Rename
                    </button>
                  </>
                )}
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={o.active}
                    onChange={(e) => toggleOrg(o.id!, e.target.checked)}
                  />
                  Active
                </label>
                <button
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => deleteOrg(o.id!, o.name)}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-slate-800">Categories</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            className="input sm:col-span-1"
            placeholder="New category name"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            aria-label="New category name"
          />
          <select
            className="input"
            value={newCatOrg}
            onChange={(e) =>
              setNewCatOrg(e.target.value ? Number(e.target.value) : "")
            }
            aria-label="Category organization scope"
          >
            <option value="">Global (any organization)</option>
            {orgs?.map((o) => (
              <option key={o.id} value={o.id}>
                Only for: {o.name}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={addCat}>
            Add Category
          </button>
        </div>
        <ul className="divide-y">
          {cats?.map((c) => {
            const org = orgs?.find((o) => o.id === c.organizationId);
            return (
              <li key={c.id} className="py-2 flex items-center gap-2 flex-wrap">
                <span className="flex-1">{c.name}</span>
                <span className="text-xs text-slate-500">
                  {org ? `for ${org.name}` : "Global"}
                </span>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={c.active}
                    onChange={(e) => toggleCat(c.id!, e.target.checked)}
                  />
                  Active
                </label>
                <button
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => deleteCat(c.id!, c.name)}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
