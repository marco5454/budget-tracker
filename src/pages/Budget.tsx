import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { formatCurrency } from "../utils/format";
import { useSetting } from "../hooks/useSetting";

type QuarterChoice = 0 | 1 | 2 | 3 | 4;

export default function Budget() {
  const currency = useSetting<string>("currency", "PHP");
  const orgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const allocations = useLiveQuery(() => db.allocations.toArray(), []);
  const txns = useLiveQuery(() => db.transactions.toArray(), []);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState<QuarterChoice>(0);

  const [draft, setDraft] = useState<Record<number, string>>({});
  const [savingMsg, setSavingMsg] = useState<string | null>(null);

  const scopeAllocations = useMemo(() => {
    return (allocations ?? []).filter(
      (a) => a.year === year && a.quarter === quarter,
    );
  }, [allocations, year, quarter]);

  const annualAllocations = useMemo(() => {
    return (allocations ?? []).filter((a) => a.year === year);
  }, [allocations, year]);

  const allocationFor = (orgId: number) =>
    scopeAllocations.find((a) => a.organizationId === orgId)?.amount ?? 0;

  const annualForOrg = (orgId: number) =>
    annualAllocations
      .filter((a) => a.organizationId === orgId)
      .reduce((s, a) => s + a.amount, 0);

  const spentFor = (orgId: number) => {
    const list = (txns ?? []).filter((t) => {
      if (t.organizationId !== orgId) return false;
      if (t.type !== "expense") return false;
      const ty = new Date(t.date).getFullYear();
      if (ty !== year) return false;
      if (quarter === 0) return true;
      const q = Math.floor(new Date(t.date).getMonth() / 3) + 1;
      return q === quarter;
    });
    return list.reduce((s, t) => s + t.amount, 0);
  };

  const incomeFor = (orgId: number) => {
    const list = (txns ?? []).filter((t) => {
      if (t.organizationId !== orgId) return false;
      if (t.type !== "income") return false;
      const ty = new Date(t.date).getFullYear();
      if (ty !== year) return false;
      if (quarter === 0) return true;
      const q = Math.floor(new Date(t.date).getMonth() / 3) + 1;
      return q === quarter;
    });
    return list.reduce((s, t) => s + t.amount, 0);
  };

  const startEdit = (orgId: number) => {
    setDraft((d) => ({ ...d, [orgId]: String(allocationFor(orgId) || "") }));
  };

  const saveOne = async (orgId: number) => {
    const raw = draft[orgId] ?? "";
    const amt = parseFloat(raw);
    if (!Number.isFinite(amt) || amt < 0) {
      alert("Please enter a valid non-negative amount.");
      return;
    }
    const existing = scopeAllocations.find((a) => a.organizationId === orgId);
    if (existing?.id) {
      await db.allocations.update(existing.id, { amount: amt });
    } else {
      await db.allocations.add({
        year,
        quarter,
        organizationId: orgId,
        amount: amt,
      });
    }
    setDraft((d) => {
      const c = { ...d };
      delete c[orgId];
      return c;
    });
    flashMsg("Saved");
  };

  const cancelEdit = (orgId: number) => {
    setDraft((d) => {
      const c = { ...d };
      delete c[orgId];
      return c;
    });
  };

  const copyFromAnnual = async () => {
    if (quarter === 0) {
      alert("Switch to a specific quarter first.");
      return;
    }
    if (!confirm(`Split annual allocations evenly across Q${quarter}?`)) return;
    const annualByOrg = new Map<number, number>();
    annualAllocations
      .filter((a) => a.quarter === 0)
      .forEach((a) => annualByOrg.set(a.organizationId, (annualByOrg.get(a.organizationId) ?? 0) + a.amount));
    for (const [orgId, total] of annualByOrg) {
      const split = Math.round((total / 4) * 100) / 100;
      const existing = scopeAllocations.find((a) => a.organizationId === orgId);
      if (existing?.id) {
        await db.allocations.update(existing.id, { amount: split });
      } else {
        await db.allocations.add({ year, quarter, organizationId: orgId, amount: split });
      }
    }
    flashMsg("Quarterly allocations set from annual / 4");
  };

  const flashMsg = (m: string) => {
    setSavingMsg(m);
    setTimeout(() => setSavingMsg(null), 1500);
  };

  const totalAlloc = scopeAllocations.reduce((s, a) => s + a.amount, 0);
  const totalAnnual = annualAllocations
    .filter((a) => a.quarter === 0)
    .reduce((s, a) => s + a.amount, 0);

  const years = Array.from(
    new Set([
      now.getFullYear(),
      ...(allocations ?? []).map((a) => a.year),
      ...(txns ?? []).map((t) => new Date(t.date).getFullYear()),
    ]),
  ).sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Budget Allocations</h1>
          <p className="text-sm text-slate-500">
            Set the allocated budget per organization. Choose <em>Annual</em> for
            yearly totals, or a specific quarter.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">Year</label>
            <select
              className="input"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
              {!years.includes(now.getFullYear() + 1) && (
                <option value={now.getFullYear() + 1}>{now.getFullYear() + 1}</option>
              )}
            </select>
          </div>
          <div>
            <label className="label">Period</label>
            <select
              className="input"
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value) as QuarterChoice)}
            >
              <option value={0}>Annual</option>
              <option value={1}>Q1 (Jan–Mar)</option>
              <option value={2}>Q2 (Apr–Jun)</option>
              <option value={3}>Q3 (Jul–Sep)</option>
              <option value={4}>Q4 (Oct–Dec)</option>
            </select>
          </div>
          {quarter !== 0 && (
            <button className="btn-secondary" onClick={copyFromAnnual}>
              Split annual / 4
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="card p-3">
          <div className="text-xs uppercase text-slate-500">
            {quarter === 0 ? "Annual total" : `Q${quarter} total`}
          </div>
          <div className="text-lg font-bold">{formatCurrency(totalAlloc, currency)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs uppercase text-slate-500">Annual ({year}) total</div>
          <div className="text-lg font-bold">{formatCurrency(totalAnnual, currency)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs uppercase text-slate-500">Status</div>
          <div className="text-sm text-emerald-700 h-6">{savingMsg ?? ""}</div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left border-b">
              <th className="py-2 px-3">Organization</th>
              <th className="py-2 px-3 text-right">
                {quarter === 0 ? "Annual Allocation" : `Q${quarter} Allocation`}
              </th>
              <th className="py-2 px-3 text-right">Spent (in period)</th>
              <th className="py-2 px-3 text-right">Income (in period)</th>
              <th className="py-2 px-3 text-right">Remaining</th>
              <th className="py-2 px-3 text-right">Annual ({year})</th>
              <th className="py-2 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {orgs?.map((o) => {
              const orgId = o.id!;
              const alloc = allocationFor(orgId);
              const spent = spentFor(orgId);
              const income = incomeFor(orgId);
              const annual = annualForOrg(orgId);
              const isEditing = orgId in draft;
              const remaining = alloc + income - spent;
              return (
                <tr key={orgId} className="border-b last:border-0">
                  <td className="py-2 px-3">{o.name}</td>
                  <td className="py-2 px-3 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input w-32 inline-block"
                        value={draft[orgId]}
                        onChange={(e) => setDraft((d) => ({ ...d, [orgId]: e.target.value }))}
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{formatCurrency(alloc, currency)}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">{formatCurrency(spent, currency)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(income, currency)}</td>
                  <td className={`py-2 px-3 text-right ${remaining < 0 ? "text-red-600 font-semibold" : ""}`}>
                    {formatCurrency(remaining, currency)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-500">{formatCurrency(annual, currency)}</td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    {isEditing ? (
                      <>
                        <button className="text-brand-700 hover:underline" onClick={() => saveOne(orgId)}>
                          Save
                        </button>
                        <span className="mx-2 text-slate-300">|</span>
                        <button className="text-slate-600 hover:underline" onClick={() => cancelEdit(orgId)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button className="text-brand-700 hover:underline" onClick={() => startEdit(orgId)}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
