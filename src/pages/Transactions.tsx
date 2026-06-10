import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Transaction } from "../db/db";
import { formatCurrency, quarterFromDate, yearFromDate } from "../utils/format";
import Modal from "../components/Modal";
import TransactionForm from "../components/TransactionForm";
import { downloadCsv } from "../utils/backup";
import { useSetting } from "../hooks/useSetting";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/Confirm";
import { restoreTransaction, softDeleteTransaction } from "../utils/trash";
import CsvImportModal from "../components/CsvImportModal";

export default function Transactions() {
  const currency = useSetting<string>("currency", "PHP");
  // Hide soft-deleted (trashed) rows from the main list.
  const txns = useLiveQuery(
    () => db.transactions.filter((t) => !t.deletedAt).toArray(),
    [],
  );
  const orgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const cats = useLiveQuery(() => db.categories.toArray(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [search, setSearch] = useState("");
  const [filterOrg, setFilterOrg] = useState<number | "">("");
  const [filterType, setFilterType] = useState<"" | "expense" | "income">("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterYear, setFilterYear] = useState<number | "">(new Date().getFullYear());
  const [filterQuarter, setFilterQuarter] = useState<"" | "1" | "2" | "3" | "4">("");

  const [editing, setEditing] = useState<Transaction | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [addDirty, setAddDirty] = useState(false);
  const [editDirty, setEditDirty] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = [...(txns ?? [])];
    if (filterYear !== "") list = list.filter((t) => yearFromDate(t.date) === filterYear);
    if (filterQuarter !== "") {
      const q = Number(filterQuarter);
      list = list.filter((t) => quarterFromDate(t.date) === q);
    }
    if (filterOrg !== "") list = list.filter((t) => t.organizationId === filterOrg);
    if (filterType !== "") list = list.filter((t) => t.type === filterType);
    if (filterStatus !== "") list = list.filter((t) => t.status === filterStatus);
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
  }, [txns, search, filterOrg, filterType, filterStatus, filterYear, filterQuarter]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Transactions</h1>
          <p className="text-sm text-slate-500">All recorded income and expenses.</p>
        </div>
        <div className="flex gap-2">
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

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div>
          <label className="label">Search</label>
          <input
            className="input"
            placeholder="Description, payee, ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Year</label>
          <select className="input" value={filterYear} onChange={(e) => setFilterYear(e.target.value ? Number(e.target.value) : "")}>
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
          <select className="input" value={filterQuarter} onChange={(e) => setFilterQuarter(e.target.value as "" | "1" | "2" | "3" | "4")}>
            <option value="">All</option>
            <option value="1">Q1</option>
            <option value="2">Q2</option>
            <option value="3">Q3</option>
            <option value="4">Q4</option>
          </select>
        </div>
        <div>
          <label className="label">Organization</label>
          <select className="input" value={filterOrg} onChange={(e) => setFilterOrg(e.target.value ? Number(e.target.value) : "")}>
            <option value="">All</option>
            {orgs?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={filterType} onChange={(e) => setFilterType(e.target.value as "" | "expense" | "income")}>
            <option value="">All</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="reimbursed">Reimbursed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-3">
          <div className="text-xs uppercase text-slate-500">Filtered count</div>
          <div className="text-lg font-bold">{filtered.length}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs uppercase text-slate-500">Filtered Income</div>
          <div className="text-lg font-bold text-emerald-700">{formatCurrency(totalIncome, currency)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs uppercase text-slate-500">Filtered Expenses</div>
          <div className="text-lg font-bold text-red-600">{formatCurrency(totalExpenses, currency)}</div>
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
              <th className="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-500">
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
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button className="text-brand-700 hover:underline" onClick={() => setEditing(t)}>
                        Edit
                      </button>
                      <span className="mx-2 text-slate-300">|</span>
                      <button className="text-red-600 hover:underline" onClick={() => remove(t.id)}>
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
    </div>
  );
}
