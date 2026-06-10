import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import {
  formatCurrency,
  quarterFromDate,
  yearFromDate,
} from "../utils/format";
import { useSetting } from "../hooks/useSetting";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/Confirm";
import { markDataChanged } from "../utils/backup";

type QuarterChoice = 0 | 1 | 2 | 3 | 4;

export default function Budget() {
  const currency = useSetting<string>("currency", "PHP");
  const orgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const allocations = useLiveQuery(() => db.allocations.toArray(), []);
  const txns = useLiveQuery(() => db.transactions.toArray(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState<QuarterChoice>(0);

  const [draft, setDraft] = useState<Record<number, string>>({});

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
      .filter((a) => a.quarter === 0 && a.organizationId === orgId)
      .reduce((s, a) => s + a.amount, 0);

  const matchesScope = (dateIso: string): boolean => {
    if (yearFromDate(dateIso) !== year) return false;
    if (quarter === 0) return true;
    return quarterFromDate(dateIso) === quarter;
  };

  const spentFor = (orgId: number) =>
    (txns ?? [])
      .filter(
        (t) =>
          t.organizationId === orgId &&
          t.type === "expense" &&
          matchesScope(t.date),
      )
      .reduce((s, t) => s + t.amount, 0);

  const incomeFor = (orgId: number) =>
    (txns ?? [])
      .filter(
        (t) =>
          t.organizationId === orgId &&
          t.type === "income" &&
          matchesScope(t.date),
      )
      .reduce((s, t) => s + t.amount, 0);

  const startEdit = (orgId: number) => {
    setDraft((d) => ({ ...d, [orgId]: String(allocationFor(orgId) || "") }));
  };

  /**
   * Atomic upsert: read-then-write inside a single Dexie transaction
   * scoped to the [year, quarter, organizationId] compound index, so
   * concurrent edits don't create duplicate allocations.
   */
  const upsertAllocation = async (orgId: number, amt: number) => {
    await db.transaction("rw", db.allocations, async () => {
      const existing = await db.allocations
        .where("[year+quarter+organizationId]")
        .equals([year, quarter, orgId])
        .first();
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
    });
  };

  const saveOne = async (orgId: number) => {
    const raw = draft[orgId] ?? "";
    const amt = parseFloat(raw);
    if (!Number.isFinite(amt) || amt < 0) {
      toast.error("Please enter a valid non-negative amount.");
      return;
    }
    if (amt > 100_000_000) {
      toast.error("Amount looks too large. Please double-check.");
      return;
    }
    try {
      await upsertAllocation(orgId, amt);
      await markDataChanged();
      setDraft((d) => {
        const c = { ...d };
        delete c[orgId];
        return c;
      });
      toast.success("Allocation saved.");
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
    }
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
      toast.warning("Switch to a specific quarter first.");
      return;
    }
    const ok = await confirm({
      title: `Split annual into Q${quarter}?`,
      message: `This will set the Q${quarter} allocation for every organization to its annual amount divided by 4. Existing Q${quarter} values will be overwritten.`,
      confirmLabel: `Split into Q${quarter}`,
    });
    if (!ok) return;
    try {
      const annualByOrg = new Map<number, number>();
      annualAllocations
        .filter((a) => a.quarter === 0)
        .forEach((a) =>
          annualByOrg.set(
            a.organizationId,
            (annualByOrg.get(a.organizationId) ?? 0) + a.amount,
          ),
        );
      for (const [orgId, total] of annualByOrg) {
        const split = Math.round((total / 4) * 100) / 100;
        await upsertAllocation(orgId, split);
      }
      await markDataChanged();
      toast.success(`Q${quarter} allocations set from annual / 4.`);
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  const totalAlloc = scopeAllocations.reduce((s, a) => s + a.amount, 0);
  const totalAnnual = annualAllocations
    .filter((a) => a.quarter === 0)
    .reduce((s, a) => s + a.amount, 0);

  const years = Array.from(
    new Set([
      now.getFullYear(),
      ...(allocations ?? []).map((a) => a.year),
      ...(txns ?? []).map((t) => yearFromDate(t.date)),
    ]),
  ).sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Budget Allocations</h1>
          <p className="text-sm text-slate-500">
            Set the allocated budget per organization. Choose <em>Annual</em>{" "}
            for yearly totals, or a specific quarter.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="budget-year">Year</label>
            <select
              id="budget-year"
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
                <option value={now.getFullYear() + 1}>
                  {now.getFullYear() + 1}
                </option>
              )}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="budget-period">Period</label>
            <select
              id="budget-period"
              className="input"
              value={quarter}
              onChange={(e) =>
                setQuarter(Number(e.target.value) as QuarterChoice)
              }
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
          <div className="text-lg font-bold">
            {formatCurrency(totalAlloc, currency)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs uppercase text-slate-500">
            Annual ({year}) total
          </div>
          <div className="text-lg font-bold">
            {formatCurrency(totalAnnual, currency)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs uppercase text-slate-500">Tip</div>
          <div className="text-xs text-slate-600">
            Click <strong>Edit</strong> on a row, type the amount, then press
            <strong> Save</strong>.
          </div>
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
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [orgId]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveOne(orgId);
                          if (e.key === "Escape") cancelEdit(orgId);
                        }}
                        aria-label={`${o.name} allocation`}
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">
                        {formatCurrency(alloc, currency)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {formatCurrency(spent, currency)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {formatCurrency(income, currency)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right ${
                      remaining < 0 ? "text-red-600 font-semibold" : ""
                    }`}
                  >
                    {formatCurrency(remaining, currency)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-500">
                    {formatCurrency(annual, currency)}
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    {isEditing ? (
                      <>
                        <button
                          className="text-brand-700 hover:underline"
                          onClick={() => saveOne(orgId)}
                        >
                          Save
                        </button>
                        <span className="mx-2 text-slate-300">|</span>
                        <button
                          className="text-slate-600 hover:underline"
                          onClick={() => cancelEdit(orgId)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="text-brand-700 hover:underline"
                        onClick={() => startEdit(orgId)}
                      >
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
