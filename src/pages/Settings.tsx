import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { downloadBackup, importBackup } from "../utils/backup";
import { setSetting, useSetting } from "../hooks/useSetting";

export default function Settings() {
  const wardName = useSetting<string>("wardName", "");
  const currency = useSetting<string>("currency", "PHP");
  const lastBackupAt = useSetting<string | null>("lastBackupAt", null);

  const orgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const cats = useLiveQuery(() => db.categories.toArray(), []);

  const [newOrg, setNewOrg] = useState("");
  const [newCat, setNewCat] = useState("");
  const [newCatOrg, setNewCatOrg] = useState<number | "">("");

  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveWardName = async (v: string) => {
    await setSetting("wardName", v);
  };
  const saveCurrency = async (v: string) => {
    await setSetting("currency", v);
  };

  const addOrg = async () => {
    const name = newOrg.trim();
    if (!name) return;
    const maxOrder = (orgs ?? []).reduce((m, o) => Math.max(m, o.order), 0);
    await db.organizations.add({ name, order: maxOrder + 1, active: true });
    setNewOrg("");
  };
  const toggleOrg = async (id: number, active: boolean) => {
    await db.organizations.update(id, { active });
  };
  const renameOrg = async (id: number, name: string) => {
    if (!name.trim()) return;
    await db.organizations.update(id, { name: name.trim() });
  };
  const deleteOrg = async (id: number) => {
    const used = await db.transactions.where("organizationId").equals(id).count();
    if (used > 0) {
      alert(`Cannot delete: ${used} transaction(s) reference this organization. Deactivate it instead.`);
      return;
    }
    if (!confirm("Delete this organization?")) return;
    await db.organizations.delete(id);
  };

  const addCat = async () => {
    const name = newCat.trim();
    if (!name) return;
    await db.categories.add({
      name,
      organizationId: newCatOrg === "" ? null : Number(newCatOrg),
      active: true,
    });
    setNewCat("");
  };
  const toggleCat = async (id: number, active: boolean) => {
    await db.categories.update(id, { active });
  };
  const deleteCat = async (id: number) => {
    const used = await db.transactions.where("categoryId").equals(id).count();
    if (used > 0) {
      alert(`Cannot delete: ${used} transaction(s) reference this category. Deactivate it instead.`);
      return;
    }
    if (!confirm("Delete this category?")) return;
    await db.categories.delete(id);
  };

  const onImport = async (file: File | null) => {
    if (!file) return;
    setImportMsg(null);
    try {
      await importBackup(file, importMode);
      setImportMsg("Backup imported successfully.");
    } catch (err) {
      setImportMsg(`Import failed: ${(err as Error).message}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const wipeAll = async () => {
    if (
      !confirm(
        "This will permanently delete ALL data: transactions, allocations, organizations, categories, and settings. Continue?",
      )
    )
      return;
    if (!confirm("Final confirmation: are you absolutely sure?")) return;
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
    location.reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">
          Configure ward info, organizations, categories, and backups.
        </p>
      </div>

      <div className="card p-4 space-y-4">
        <h3 className="font-semibold text-slate-800">Ward Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Ward name (shown in header)</label>
            <input
              className="input"
              value={wardName}
              onChange={(e) => saveWardName(e.target.value)}
              placeholder="e.g., Sample Ward"
            />
          </div>
          <div>
            <label className="label">Currency code</label>
            <select className="input" value={currency} onChange={(e) => saveCurrency(e.target.value)}>
              <option value="PHP">PHP — Philippine Peso (₱)</option>
              <option value="USD">USD — US Dollar ($)</option>
              <option value="EUR">EUR — Euro (€)</option>
              <option value="GBP">GBP — British Pound (£)</option>
            </select>
          </div>
        </div>
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
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => downloadBackup()}>
            Download backup (JSON)
          </button>
          <div className="flex items-center gap-2">
            <select
              className="input"
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as "merge" | "replace")}
            >
              <option value="merge">Merge (keep existing, overwrite by ID)</option>
              <option value="replace">Replace (wipe then import)</option>
            </select>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              onChange={(e) => onImport(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
        </div>
        {importMsg && <div className="text-sm text-slate-700">{importMsg}</div>}

        <div className="border-t pt-3">
          <button className="btn-danger" onClick={wipeAll}>
            Wipe all data
          </button>
          <p className="text-xs text-slate-500 mt-2">
            Use this to start over. Make a backup first.
          </p>
        </div>
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
          />
          <button className="btn-primary" onClick={addOrg}>
            Add
          </button>
        </div>
        <ul className="divide-y">
          {orgs?.map((o) => (
            <li key={o.id} className="py-2 flex items-center gap-2">
              <input
                className="input flex-1"
                defaultValue={o.name}
                onBlur={(e) => {
                  if (e.target.value !== o.name) renameOrg(o.id!, e.target.value);
                }}
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={o.active}
                  onChange={(e) => toggleOrg(o.id!, e.target.checked)}
                />
                Active
              </label>
              <button className="text-sm text-red-600 hover:underline" onClick={() => deleteOrg(o.id!)}>
                Delete
              </button>
            </li>
          ))}
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
          />
          <select
            className="input"
            value={newCatOrg}
            onChange={(e) => setNewCatOrg(e.target.value ? Number(e.target.value) : "")}
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
              <li key={c.id} className="py-2 flex items-center gap-2">
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
                <button className="text-sm text-red-600 hover:underline" onClick={() => deleteCat(c.id!)}>
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
