import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type AuditLogEntry } from "../db/db";
import { downloadCsv } from "../utils/backup";

/**
 * Audit Log viewer. Shows a filterable list of every recorded change.
 * Auto-prunes entries older than 365 days at startup (see main.tsx).
 */
export default function AuditLog() {
  const all = useLiveQuery<AuditLogEntry[]>(
    () => db.auditLog.orderBy("at").reverse().toArray(),
    [],
  );

  const [filterEntity, setFilterEntity] = useState<string>("");
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterActor, setFilterActor] = useState<string>("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = all ?? [];
    if (filterEntity) list = list.filter((e) => e.entity === filterEntity);
    if (filterAction) list = list.filter((e) => e.action === filterAction);
    if (filterActor) list = list.filter((e) => e.actor === filterActor);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.summary.toLowerCase().includes(s) ||
          String(e.targetId).toLowerCase().includes(s) ||
          e.actor.toLowerCase().includes(s),
      );
    }
    return list;
  }, [all, filterEntity, filterAction, filterActor, search]);

  const actors = useMemo(() => {
    const set = new Set<string>();
    (all ?? []).forEach((e) => set.add(e.actor));
    return Array.from(set).sort();
  }, [all]);

  const exportCsv = () => {
    downloadCsv(
      `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      ["When", "Actor", "Entity", "Action", "Target", "Summary"],
      filtered.map((e) => [
        e.at,
        e.actor,
        e.entity,
        e.action,
        String(e.targetId),
        e.summary,
      ]),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
          <p className="text-sm text-slate-500">
            Recent changes to the budget data. Entries older than 365 days are auto-pruned.
          </p>
        </div>
        <button className="btn-secondary" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="label" htmlFor="aud-search">Search</label>
          <input
            id="aud-search"
            className="input"
            placeholder="Summary, target id, actor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="aud-entity">Entity</label>
          <select
            id="aud-entity"
            className="input"
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
          >
            <option value="">All</option>
            <option value="transaction">Transaction</option>
            <option value="allocation">Allocation</option>
            <option value="organization">Organization</option>
            <option value="category">Category</option>
            <option value="setting">Setting</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="aud-action">Action</label>
          <select
            id="aud-action"
            className="input"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="">All</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="restore">Restore</option>
            <option value="purge">Purge</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="aud-actor">Actor</label>
          <select
            id="aud-actor"
            className="input"
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
          >
            <option value="">All</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left border-b text-slate-600">
              <th className="py-2 px-3">When</th>
              <th className="py-2 px-3">Actor</th>
              <th className="py-2 px-3">Entity</th>
              <th className="py-2 px-3">Action</th>
              <th className="py-2 px-3">Target</th>
              <th className="py-2 px-3">Summary</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  {all === undefined ? "Loading…" : "No audit entries match the filters."}
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-slate-50 align-top">
                  <td className="py-2 px-3 whitespace-nowrap text-slate-500">
                    {new Date(e.at).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">{e.actor}</td>
                  <td className="py-2 px-3">
                    <span className="badge bg-slate-100 text-slate-700">{e.entity}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`badge ${
                        e.action === "delete" || e.action === "purge"
                          ? "bg-red-100 text-red-700"
                          : e.action === "create"
                            ? "bg-emerald-100 text-emerald-700"
                            : e.action === "restore"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {e.action}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-500">{String(e.targetId)}</td>
                  <td className="py-2 px-3">{e.summary}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
