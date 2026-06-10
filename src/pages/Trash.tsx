import { useEffect, useState, useMemo } from "react";
import { db } from "../db/db";
import {
  listTrashedAllocations,
  listTrashedTransactions,
  restoreTransaction,
  restoreAllocation,
  permanentlyDeleteTransaction,
  permanentlyDeleteAllocation,
  emptyTrash,
  TRASH_RETENTION_DAYS_CONST,
  type TrashedAllocation,
  type TrashedTransaction,
} from "../utils/trash";
import { formatCurrency } from "../utils/format";
import { useSetting } from "../hooks/useSetting";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/Confirm";
import { useLiveQuery } from "dexie-react-hooks";

/**
 * Trash page: list soft-deleted transactions and allocations, allow restore
 * or permanent deletion, and offer "Empty Trash" for bulk cleanup.
 *
 * Items here are auto-purged after 30 days at app startup.
 */
export default function Trash() {
  const currency = useSetting<string>("currency", "PHP");
  const toast = useToast();
  const confirm = useConfirm();

  // Live-query the deleted rows so this page reflects new soft-deletes / restores
  // happening anywhere in the app or in another tab.
  const trashedTxns =
    useLiveQuery<TrashedTransaction[]>(async () => {
      return (await listTrashedTransactions()) as TrashedTransaction[];
    }, []) ?? [];
  const trashedAllocs =
    useLiveQuery<TrashedAllocation[]>(async () => {
      return (await listTrashedAllocations()) as TrashedAllocation[];
    }, []) ?? [];

  const orgs = useLiveQuery(() => db.organizations.toArray(), []);
  const cats = useLiveQuery(() => db.categories.toArray(), []);

  const [tab, setTab] = useState<"transactions" | "allocations">("transactions");

  // Refresh ticker so deletion countdown updates while the user watches.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const onRestoreTxn = async (id: number) => {
    try {
      await restoreTransaction(id);
      toast.success("Transaction restored.");
    } catch (err) {
      toast.error(`Restore failed: ${(err as Error).message}`);
    }
  };

  const onPurgeTxn = async (id: number) => {
    const ok = await confirm({
      title: "Permanently delete?",
      message: "This transaction will be removed forever and cannot be recovered.",
      confirmLabel: "Delete forever",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await permanentlyDeleteTransaction(id);
      toast.success("Permanently deleted.");
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  const onRestoreAlloc = async (id: number) => {
    try {
      await restoreAllocation(id);
      toast.success("Allocation restored.");
    } catch (err) {
      toast.error(`Restore failed: ${(err as Error).message}`);
    }
  };

  const onPurgeAlloc = async (id: number) => {
    const ok = await confirm({
      title: "Permanently delete?",
      message: "This allocation will be removed forever.",
      confirmLabel: "Delete forever",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await permanentlyDeleteAllocation(id);
      toast.success("Permanently deleted.");
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  const onEmptyTrash = async () => {
    if (trashedTxns.length === 0 && trashedAllocs.length === 0) return;
    const ok = await confirm({
      title: "Empty the entire Trash?",
      message: `${trashedTxns.length} transaction(s) and ${trashedAllocs.length} allocation(s) will be permanently deleted.`,
      confirmLabel: "Empty Trash",
      tone: "danger",
      confirmPhrase: "EMPTY",
    });
    if (!ok) return;
    try {
      const r = await emptyTrash();
      toast.success(
        `Emptied: ${r.transactions} transaction(s), ${r.allocations} allocation(s).`,
      );
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  const daysLeft = (deletedAt: string): number => {
    const purgeAt = new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS_CONST * 86400000;
    const ms = purgeAt - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  };

  const orgName = useMemo(
    () => (id: number) => orgs?.find((o) => o.id === id)?.name ?? "—",
    [orgs],
  );
  const catName = useMemo(
    () => (id: number | null) => (id == null ? "—" : cats?.find((c) => c.id === id)?.name ?? "—"),
    [cats],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Trash</h1>
          <p className="text-sm text-slate-500">
            Soft-deleted items. Auto-purged after {TRASH_RETENTION_DAYS_CONST} days.
          </p>
        </div>
        <button
          className="btn-danger"
          onClick={onEmptyTrash}
          disabled={trashedTxns.length === 0 && trashedAllocs.length === 0}
        >
          Empty Trash
        </button>
      </div>

      <div className="card p-2 inline-flex gap-1">
        <button
          className={`px-3 py-1.5 rounded text-sm ${
            tab === "transactions"
              ? "bg-brand-700 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
          onClick={() => setTab("transactions")}
        >
          Transactions ({trashedTxns.length})
        </button>
        <button
          className={`px-3 py-1.5 rounded text-sm ${
            tab === "allocations"
              ? "bg-brand-700 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
          onClick={() => setTab("allocations")}
        >
          Allocations ({trashedAllocs.length})
        </button>
      </div>

      {tab === "transactions" && (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left border-b text-slate-600">
                <th className="py-2 px-3">Deleted</th>
                <th className="py-2 px-3">Auto-purge in</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3 text-right">Amount</th>
                <th className="py-2 px-3">Organization</th>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-3">Description</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trashedTxns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    The Trash is empty.
                  </td>
                </tr>
              ) : (
                [...trashedTxns]
                  .sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1))
                  .map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-2 px-3 whitespace-nowrap text-slate-500">
                        {new Date(t.deletedAt).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {daysLeft(t.deletedAt)}d
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">{t.date}</td>
                      <td className="py-2 px-3">{t.type}</td>
                      <td
                        className={`py-2 px-3 text-right ${
                          t.type === "expense" ? "text-red-600" : "text-emerald-700"
                        }`}
                      >
                        {t.type === "expense" ? "-" : "+"}
                        {formatCurrency(t.amount, currency)}
                      </td>
                      <td className="py-2 px-3">{orgName(t.organizationId)}</td>
                      <td className="py-2 px-3">{catName(t.categoryId)}</td>
                      <td className="py-2 px-3 max-w-xs truncate" title={t.description}>
                        {t.description ?? ""}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button
                          className="text-brand-700 hover:underline"
                          onClick={() => onRestoreTxn(t.id)}
                        >
                          Restore
                        </button>
                        <span className="mx-2 text-slate-300">|</span>
                        <button
                          className="text-red-600 hover:underline"
                          onClick={() => onPurgeTxn(t.id)}
                        >
                          Delete forever
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "allocations" && (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left border-b text-slate-600">
                <th className="py-2 px-3">Deleted</th>
                <th className="py-2 px-3">Auto-purge in</th>
                <th className="py-2 px-3">Year</th>
                <th className="py-2 px-3">Quarter</th>
                <th className="py-2 px-3">Organization</th>
                <th className="py-2 px-3 text-right">Amount</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trashedAllocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No deleted allocations.
                  </td>
                </tr>
              ) : (
                [...trashedAllocs]
                  .sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1))
                  .map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-2 px-3 whitespace-nowrap text-slate-500">
                        {new Date(a.deletedAt).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {daysLeft(a.deletedAt)}d
                      </td>
                      <td className="py-2 px-3">{a.year}</td>
                      <td className="py-2 px-3">
                        {a.quarter === 0 ? "Annual" : `Q${a.quarter}`}
                      </td>
                      <td className="py-2 px-3">{orgName(a.organizationId)}</td>
                      <td className="py-2 px-3 text-right">
                        {formatCurrency(a.amount, currency)}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button
                          className="text-brand-700 hover:underline"
                          onClick={() => onRestoreAlloc(a.id)}
                        >
                          Restore
                        </button>
                        <span className="mx-2 text-slate-300">|</span>
                        <button
                          className="text-red-600 hover:underline"
                          onClick={() => onPurgeAlloc(a.id)}
                        >
                          Delete forever
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
