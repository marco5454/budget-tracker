import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Transaction, type TransactionStatus } from "../db/db";
import {
  formatCurrency,
  parseLocalDate,
  quarterFromDate,
  yearFromDate,
} from "../utils/format";
import Modal from "../components/Modal";
import TransactionForm from "../components/TransactionForm";
import ReceiptViewer from "../components/ReceiptViewer";
import { downloadCsv } from "../utils/backup";
import { useSetting } from "../hooks/useSetting";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/Confirm";
import { restoreTransaction, softDeleteTransaction } from "../utils/trash";
import CsvImportModal from "../components/CsvImportModal";
import {
  addSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
  type SavedSearch,
  type SavedSearchFilters,
} from "../utils/savedSearches";

const STATUSES: TransactionStatus[] = ["pending", "approved", "paid", "reimbursed"];

interface FilterState {
  search: string;
  filterYear: number | "";
  filterQuarter: "" | "1" | "2" | "3" | "4";
  filterType: "" | "expense" | "income";
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  orgIds: number[];
  categoryIds: number[];
  statuses: TransactionStatus[];
  hasReceipt: "" | "yes" | "no";
}

const DEFAULT_FILTERS: FilterState = {
  search: "",
  filterYear: new Date().getFullYear(),
  filterQuarter: "",
  filterType: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
  orgIds: [],
  categoryIds: [],
  statuses: [],
  hasReceipt: "",
};

export default function Transactions() {
  const currency = useSetting<string>("currency", "PHP");
  const txns = useLiveQuery(
    () => db.transactions.filter((t) => !t.deletedAt).toArray(),
    [],
  );
  const orgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const cats = useLiveQuery(() => db.categories.toArray(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [editing, setEditing] = useState<Transaction | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [addDirty, setAddDirty] = useState(false);
  const [editDirty, setEditDirty] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  // Saved searches.
  const [saved, setSaved] = useState<SavedSearch[]>(() => listSavedSearches());
  const [savedName, setSavedName] = useState("");
  const refreshSaved = () => setSaved(listSavedSearches());

  // Sync saved-search list across tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "wbt:savedSearches") refreshSaved();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // "N" shortcut opens Add Transaction modal.
  useEffect(() => {
    const onShortcut = () => setAdding(true);
    window.addEventListener("wbt:shortcut-new-transaction", onShortcut);
    return () =>
      window.removeEventListener("wbt:shortcut-new-transaction", onShortcut);
  }, []);

  const update = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const toggleInList = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const clearAll = () => setFilters(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    let list = [...(txns ?? [])];
    const {
      search,
      filterYear,
      filterQuarter,
      filterType,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
      orgIds,
      categoryIds,
      statuses,
      hasReceipt,
    } = filters;

    if (filterYear !== "") list = list.filter((t) => yearFromDate(t.date) === filterYear);
    if (filterQuarter !== "") {
      const q = Number(filterQuarter);
      list = list.filter((t) => quarterFromDate(t.date) === q);
    }
    if (filterType !== "") list = list.filter((t) => t.type === filterType);
    if (orgIds.length) list = list.filter((t) => orgIds.includes(t.organizationId));
    if (categoryIds.length)
      list = list.filter((t) => t.categoryId != null && categoryIds.includes(t.categoryId));
    if (statuses.length) list = list.filter((t) => statuses.includes(t.status));
    if (dateFrom) list = list.filter((t) => parseLocalDate(t.date) >= parseLocalDate(dateFrom));
    if (dateTo) list = list.filter((t) => parseLocalDate(t.date) <= parseLocalDate(dateTo));
    const minN = amountMin === "" ? null : Number(amountMin);
    const maxN = amountMax === "" ? null : Number(amountMax);
    if (minN !== null && Number.isFinite(minN)) list = list.filter((t) => t.amount >= minN);
    if (maxN !== null && Number.isFinite(maxN)) list = list.filter((t) => t.amount <= maxN);
    if (hasReceipt === "yes") list = list.filter((t) => !!t.receiptDataUrl);
    if (hasReceipt === "no") list = list.filter((t) => !t.receiptDataUrl);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter((t) =>
        [t.description, t.payee, t.reference, t.notes]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(s)),
      );
    }
    list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id ?? 0) - (a.id ?? 0)));
    return list;
  }, [txns, filters]);

  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    (txns ?? []).forEach((t) => set.add(yearFromDate(t.date)));
    return Array.from(set).sort((a, b) => b - a);
  }, [txns]);

  const totalExpenses = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalIncome = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);

  const remove = async (id?: number) => {
    if (!id) return;
    const ok = await confirm({
      title: "Move transaction to Trash?",
      message: "You can restore it from the Trash within 30 days.",
      tone: "danger",
      confirmLabel: "Move to Trash",
    });
    if (!ok) return;
    try {
      await softDeleteTransaction(id);
      toast.success("Transaction moved to Trash.", {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await restoreTransaction(id);
              toast.success("Restored.");
            } catch (err) {
              toast.error(`Undo failed: ${(err as Error).message}`);
            }
          },
        },
      });
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  const exportFiltered = () => {
    const headers = [
      "Date",
      "Type",
      "Amount",
      "Organization",
      "Category",
      "Payee/Source",
      "Description",
      "Reference",
      "Status",
      "Notes",
    ];
    const rows = filtered.map((t) => {
      const org = orgs?.find((o) => o.id === t.organizationId)?.name ?? "";
      const cat = cats?.find((c) => c.id === t.categoryId)?.name ?? "";
      return [
        t.date,
        t.type,
        t.amount.toFixed(2),
        org,
        cat,
        t.payee ?? "",
        t.description ?? "",
        t.reference ?? "",
        t.status,
        t.notes ?? "",
      ];
    });
    downloadCsv(`transactions-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const saveCurrentSearch = () => {
    const name = savedName.trim();
    if (!name) {
      toast.error("Give the saved search a name first.");
      return;
    }
    try {
      const filtersToSave: SavedSearchFilters = { ...filters };
      addSavedSearch(name, filtersToSave);
      setSavedName("");
      refreshSaved();
      toast.success(`Saved search "${name}".`);
    } catch (err) {
      toast.error(`Could not save: ${(err as Error).message}`);
    }
  };

  const applySaved = (s: SavedSearch) => {
    setFilters({ ...DEFAULT_FILTERS, ...s.filters } as FilterState);
    setShowAdvanced(true);
    toast.info(`Applied "${s.name}".`);
  };

  const removeSaved = async (s: SavedSearch) => {
    const ok = await confirm({
      title: `Delete saved search?`,
      message: `Remove "${s.name}" from your saved searches.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    deleteSavedSearch(s.id);
    refreshSaved();
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search) n++;
    if (filters.filterYear !== "") n++;
    if (filters.filterQuarter !== "") n++;
    if (filters.filterType !== "") n++;
    if (filters.dateFrom) n++;
    if (filters.dateTo) n++;
    if (filters.amountMin) n++;
    if (filters.amountMax) n++;
    if (filters.orgIds.length) n++;
    if (filters.categoryIds.length) n++;
    if (filters.statuses.length) n++;
    if (filters.hasReceipt) n++;
    return n;
  }, [filters]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Transactions</h1>
          <p className="text-sm text-slate-500">All recorded income and expenses.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setCsvOpen(true)}>
            Import CSV
          </button>
          <button className="btn-secondary" onClick={exportFiltered}>
            Export CSV
          </button>
          <button className="btn-primary" onClick={() => setAdding(true)}>
            + Add Transaction
          </button>
        </div>
      </div>

      {/* Quick filter row */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div>
          <label className="label">Search</label>
          <input
            className="input"
            placeholder="Description, payee, ref, notes…"
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Year</label>
          <select
            className="input"
            value={filters.filterYear}
            onChange={(e) => update("filterYear", e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">All</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Quarter</label>
          <select
            className="input"
            value={filters.filterQuarter}
            onChange={(e) =>
              update("filterQuarter", e.target.value as "" | "1" | "2" | "3" | "4")
            }
          >
            <option value="">All</option>
            <option value="1">Q1</option>
            <option value="2">Q2</option>
            <option value="3">Q3</option>
            <option value="4">Q4</option>
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select
            className="input"
            value={filters.filterType}
            onChange={(e) =>
              update("filterType", e.target.value as "" | "expense" | "income")
            }
          >
            <option value="">All</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div className="sm:col-span-2 flex items-end gap-2">
          <button
            className="btn-secondary w-full"
            onClick={() => setShowAdvanced((v) => !v)}
            type="button"
          >
            {showAdvanced ? "Hide advanced filters" : "Show advanced filters"}
            {activeFilterCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-semibold rounded-full bg-brand-100 text-brand-800">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button className="btn-secondary" onClick={clearAll} type="button" title="Clear all filters">
            Clear
          </button>
        </div>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label">Date from</label>
              <input
                type="date"
                className="input"
                value={filters.dateFrom}
                onChange={(e) => update("dateFrom", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Date to</label>
              <input
                type="date"
                className="input"
                value={filters.dateTo}
                onChange={(e) => update("dateTo", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Amount min</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="0.00"
                value={filters.amountMin}
                onChange={(e) => update("amountMin", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Amount max</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="0.00"
                value={filters.amountMax}
                onChange={(e) => update("amountMax", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Has receipt</label>
              <select
                className="input"
                value={filters.hasReceipt}
                onChange={(e) =>
                  update("hasReceipt", e.target.value as "" | "yes" | "no")
                }
              >
                <option value="">All</option>
                <option value="yes">With receipt</option>
                <option value="no">Without receipt</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <div className="label">Organizations</div>
              <div className="border border-slate-200 rounded p-2 max-h-44 overflow-auto space-y-1 bg-white">
                {orgs?.length ? (
                  orgs.map((o) => (
                    <label
                      key={o.id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.orgIds.includes(o.id!)}
                        onChange={() =>
                          update("orgIds", toggleInList(filters.orgIds, o.id!))
                        }
                      />
                      <span>{o.name}</span>
                    </label>
                  ))
                ) : (
                  <div className="text-xs text-slate-500">No organizations.</div>
                )}
              </div>
            </div>
            <div>
              <div className="label">Categories</div>
              <div className="border border-slate-200 rounded p-2 max-h-44 overflow-auto space-y-1 bg-white">
                {cats?.length ? (
                  cats.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.categoryIds.includes(c.id!)}
                        onChange={() =>
                          update(
                            "categoryIds",
                            toggleInList(filters.categoryIds, c.id!),
                          )
                        }
                      />
                      <span>{c.name}</span>
                    </label>
                  ))
                ) : (
                  <div className="text-xs text-slate-500">No categories.</div>
                )}
              </div>
            </div>
            <div>
              <div className="label">Statuses</div>
              <div className="border border-slate-200 rounded p-2 space-y-1 bg-white">
                {STATUSES.map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-2 text-sm cursor-pointer capitalize"
                  >
                    <input
                      type="checkbox"
                      checked={filters.statuses.includes(s)}
                      onChange={() =>
                        update("statuses", toggleInList(filters.statuses, s))
                      }
                    />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Saved searches */}
          <div className="border-t border-slate-200 pt-3">
            <div className="flex flex-wrap items-end gap-2 mb-2">
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="saved-name" className="label">
                  Save current filters as
                </label>
                <input
                  id="saved-name"
                  className="input"
                  placeholder="e.g. Pending reimbursements"
                  value={savedName}
                  onChange={(e) => setSavedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveCurrentSearch();
                  }}
                />
              </div>
              <button className="btn-secondary" onClick={saveCurrentSearch}>
                Save search
              </button>
            </div>
            {saved.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {saved.map((s) => (
                  <div
                    key={s.id}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 pl-3 pr-1 py-0.5 text-xs"
                  >
                    <button
                      className="hover:underline"
                      title="Apply saved search"
                      onClick={() => applySaved(s)}
                    >
                      {s.name}
                    </button>
                    <button
                      className="ml-1 text-slate-500 hover:text-red-600 px-1"
                      title="Delete saved search"
                      onClick={() => removeSaved(s)}
                      aria-label={`Delete saved search ${s.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                No saved searches yet. Set up filters above and click Save search.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-3">
          <div className="text-xs uppercase text-slate-500">Filtered count</div>
          <div className="text-lg font-bold">{filtered.length}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs uppercase text-slate-500">Filtered Income</div>
          <div className="text-lg font-bold text-emerald-700">
            {formatCurrency(totalIncome, currency)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs uppercase text-slate-500">Filtered Expenses</div>
          <div className="text-lg font-bold text-red-600">
            {formatCurrency(totalExpenses, currency)}
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600 border-b">
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3 text-right">Amount</th>
              <th className="py-2 px-3">Organization</th>
              <th className="py-2 px-3">Category</th>
              <th className="py-2 px-3">Payee/Source</th>
              <th className="py-2 px-3">Description</th>
              <th className="py-2 px-3">Ref</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Receipt</th>
              <th className="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-500">
                  No transactions match the filters.
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const org = orgs?.find((o) => o.id === t.organizationId);
                const cat = cats?.find((c) => c.id === t.categoryId);
                return (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 px-3 whitespace-nowrap">{t.date}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`badge ${
                          t.type === "expense"
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-medium ${
                        t.type === "expense" ? "text-red-600" : "text-emerald-700"
                      }`}
                    >
                      {t.type === "expense" ? "-" : "+"}
                      {formatCurrency(t.amount, currency)}
                    </td>
                    <td className="py-2 px-3">{org?.name ?? "—"}</td>
                    <td className="py-2 px-3">{cat?.name ?? "—"}</td>
                    <td className="py-2 px-3">{t.payee ?? ""}</td>
                    <td className="py-2 px-3 max-w-xs truncate" title={t.description}>
                      {t.description ?? ""}
                    </td>
                    <td className="py-2 px-3">{t.reference ?? ""}</td>
                    <td className="py-2 px-3">
                      <span className="badge bg-slate-100 text-slate-700 capitalize">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {t.receiptDataUrl ? (
                        <button
                          type="button"
                          className="text-brand-700 hover:underline"
                          onClick={() => setViewingReceipt(t.receiptDataUrl ?? null)}
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button
                        className="text-brand-700 hover:underline"
                        onClick={() => setEditing(t)}
                      >
                        Edit
                      </button>
                      <span className="mx-2 text-slate-300">|</span>
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => remove(t.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={adding}
        title="Add Transaction"
        onClose={() => {
          setAdding(false);
          setAddDirty(false);
        }}
        dirty={addDirty}
      >
        <TransactionForm
          onSaved={() => {
            setAdding(false);
            setAddDirty(false);
          }}
          onCancel={() => {
            setAdding(false);
            setAddDirty(false);
          }}
          onDirtyChange={setAddDirty}
        />
      </Modal>

      <Modal
        open={!!editing}
        title="Edit Transaction"
        onClose={() => {
          setEditing(undefined);
          setEditDirty(false);
        }}
        dirty={editDirty}
      >
        {editing && (
          <TransactionForm
            initial={editing}
            onSaved={() => {
              setEditing(undefined);
              setEditDirty(false);
            }}
            onCancel={() => {
              setEditing(undefined);
              setEditDirty(false);
            }}
            onDirtyChange={setEditDirty}
          />
        )}
      </Modal>

      <CsvImportModal
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        onImported={() => {
          /* live query refreshes automatically */
        }}
      />

      <ReceiptViewer
        open={!!viewingReceipt}
        dataUrl={viewingReceipt ?? undefined}
        onClose={() => setViewingReceipt(null)}
      />
    </div>
  );
}
