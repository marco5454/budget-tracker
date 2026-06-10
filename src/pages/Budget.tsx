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
import { logAudit } from "../utils/audit";
import { broadcastDataChanged } from "../utils/broadcast";
import { restoreAllocation, softDeleteAllocation } from "../utils/trash";
import { useClosedYears } from "../hooks/useClosedYears";
import { WARD_BUDGET_ORG_NAME } from "../db/seed";

type QuarterChoice = 0 | 1 | 2 | 3 | 4;
// "all" = show every quarter side-by-side. number = single-period view as before.
type PeriodChoice = QuarterChoice | "all";

// Compound key: `${year}:${quarter}:${orgId}` → user-typed string draft.
type DraftMap = Record<string, string>;

const draftKey = (orgId: number, q: QuarterChoice) => `${q}:${orgId}`;

export default function Budget() {
  const currency = useSetting<string>("currency", "PHP");
  const closedYears = useClosedYears();
  const orgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  // Live, non-trashed allocations and transactions only.
  const allocations = useLiveQuery(
    () => db.allocations.filter((a) => !a.deletedAt).toArray(),
    [],
  );
  const txns = useLiveQuery(
    () => db.transactions.filter((t) => !t.deletedAt).toArray(),
    [],
  );
  const toast = useToast();
  const confirm = useConfirm();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [period, setPeriod] = useState<PeriodChoice>(0);

  const [draft, setDraft] = useState<DraftMap>({});

  // For the single-period view, we operate on `period` as a quarter number.
  const singleQuarter: QuarterChoice = period === "all" ? 0 : (period as QuarterChoice);

  const yearAllocations = useMemo(
    () => (allocations ?? []).filter((a) => a.year === year),
    [allocations, year],
  );

  const allocationFor = (orgId: number, q: QuarterChoice) =>
    yearAllocations.find(
      (a) => a.organizationId === orgId && a.quarter === q,
    )?.amount ?? 0;

  const matchesScopeForQuarter = (
    dateIso: string,
    q: QuarterChoice,
  ): boolean => {
    if (yearFromDate(dateIso) !== year) return false;
    if (q === 0) return true;
    return quarterFromDate(dateIso) === q;
  };

  const spentForScope = (orgId: number, q: QuarterChoice) =>
    (txns ?? [])
      .filter(
        (t) =>
          t.organizationId === orgId &&
          t.type === "expense" &&
          matchesScopeForQuarter(t.date, q),
      )
      .reduce((s, t) => s + t.amount, 0);

  const incomeForScope = (orgId: number, q: QuarterChoice) =>
    (txns ?? [])
      .filter(
        (t) =>
          t.organizationId === orgId &&
          t.type === "income" &&
          matchesScopeForQuarter(t.date, q),
      )
      .reduce((s, t) => s + t.amount, 0);

  const startEdit = (orgId: number, q: QuarterChoice) => {
    setDraft((d) => ({
      ...d,
      [draftKey(orgId, q)]: String(allocationFor(orgId, q) || ""),
    }));
  };

  /**
   * Atomic upsert: read-then-write inside a single Dexie transaction
   * scoped to the [year, quarter, organizationId] compound index, so
   * concurrent edits don't create duplicate allocations.
   */
  const upsertAllocation = async (
    orgId: number,
    amt: number,
    q: QuarterChoice,
  ): Promise<{ id: number; action: "create" | "update"; prevAmount?: number }> => {
    return await db.transaction("rw", db.allocations, async () => {
      const existing = await db.allocations
        .where("[year+quarter+organizationId]")
        .equals([year, q, orgId])
        .first();
      if (existing?.id) {
        const prevAmount = existing.amount;
        // Re-activate if it was previously trashed.
        await db.allocations.update(existing.id, { amount: amt, deletedAt: "" });
        return { id: existing.id, action: "update", prevAmount };
      } else {
        const id = await db.allocations.add({
          year,
          quarter: q,
          organizationId: orgId,
          amount: amt,
          deletedAt: "",
        });
        return { id, action: "create" };
      }
    });
  };

  const saveOne = async (orgId: number, q: QuarterChoice) => {
    if (closedYears.includes(year)) {
      toast.error(`Year ${year} is closed. Reopen it in Settings to edit.`);
      return;
    }
    const key = draftKey(orgId, q);
    const raw = draft[key] ?? "";
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
      const orgName = orgs?.find((o) => o.id === orgId)?.name ?? `Org#${orgId}`;
      const periodLabel = q === 0 ? "Annual" : `Q${q}`;
      const r = await upsertAllocation(orgId, amt, q);
      await logAudit(
        "allocation",
        r.action,
        r.id,
        r.action === "create"
          ? `Set ${orgName} ${periodLabel} ${year} = ${amt.toFixed(2)}`
          : `Updated ${orgName} ${periodLabel} ${year}: ${(r.prevAmount ?? 0).toFixed(2)} → ${amt.toFixed(2)}`,
      );
      await markDataChanged();
      broadcastDataChanged();
      setDraft((d) => {
        const c = { ...d };
        delete c[key];
        return c;
      });
      toast.success("Allocation saved.");
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
    }
  };

  const cancelEdit = (orgId: number, q: QuarterChoice) => {
    const key = draftKey(orgId, q);
    setDraft((d) => {
      const c = { ...d };
      delete c[key];
      return c;
    });
  };

  const removeAllocation = async (orgId: number, q: QuarterChoice) => {
    if (closedYears.includes(year)) {
      toast.error(`Year ${year} is closed. Reopen it in Settings to edit.`);
      return;
    }
    const existing = (allocations ?? []).find(
      (a) =>
        a.organizationId === orgId && a.year === year && a.quarter === q,
    );
    if (!existing?.id) {
      toast.warning("Nothing to delete in this period.");
      return;
    }
    const ok = await confirm({
      title: "Move allocation to Trash?",
      message: "You can restore it from the Trash within 30 days.",
      confirmLabel: "Move to Trash",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const id = existing.id;
      await softDeleteAllocation(id);
      toast.success("Allocation moved to Trash.", {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await restoreAllocation(id);
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

  const copyFromAnnual = async () => {
    if (closedYears.includes(year)) {
      toast.error(`Year ${year} is closed. Reopen it in Settings to edit.`);
      return;
    }
    if (singleQuarter === 0) {
      toast.warning("Switch to a specific quarter first.");
      return;
    }
    const ok = await confirm({
      title: `Split annual into Q${singleQuarter}?`,
      message: `This will set the Q${singleQuarter} allocation for every organization to its annual amount divided by 4. Existing Q${singleQuarter} values will be overwritten.`,
      confirmLabel: `Split into Q${singleQuarter}`,
    });
    if (!ok) return;
    try {
      const annualByOrg = new Map<number, number>();
      yearAllocations
        .filter((a) => a.quarter === 0)
        .forEach((a) =>
          annualByOrg.set(
            a.organizationId,
            (annualByOrg.get(a.organizationId) ?? 0) + a.amount,
          ),
        );
      for (const [orgId, total] of annualByOrg) {
        const split = Math.round((total / 4) * 100) / 100;
        await upsertAllocation(orgId, split, singleQuarter);
      }
      await logAudit(
        "allocation",
        "update",
        "bulk",
        `Split annual into Q${singleQuarter} ${year} (${annualByOrg.size} org(s))`,
      );
      await markDataChanged();
      broadcastDataChanged();
      toast.success(`Q${singleQuarter} allocations set from annual / 4.`);
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  // ─── Pool computation (mirrors Dashboard, but scoped to current year/period) ───
  const wardBudgetOrgId = useMemo(() => {
    return (
      orgs?.find(
        (o) => o.name.toLowerCase() === WARD_BUDGET_ORG_NAME.toLowerCase(),
      )?.id ?? null
    );
  }, [orgs]);

  // For the pool we evaluate income (allotment) at scope and allocations either
  // per-quarter or as the annual rollup.
  const scopeQuartersForPool: QuarterChoice[] =
    period === "all" ? [0] : [singleQuarter];

  const poolReceived = useMemo(() => {
    if (wardBudgetOrgId == null) return 0;
    return (txns ?? [])
      .filter(
        (t) =>
          t.organizationId === wardBudgetOrgId &&
          t.type === "income" &&
          (period === "all"
            ? yearFromDate(t.date) === year
            : matchesScopeForQuarter(t.date, singleQuarter)),
      )
      .reduce((s, t) => s + t.amount, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txns, wardBudgetOrgId, year, period, singleQuarter]);

  const allocatedOut = useMemo(() => {
    return yearAllocations
      .filter(
        (a) =>
          a.organizationId !== wardBudgetOrgId &&
          scopeQuartersForPool.includes(a.quarter as QuarterChoice),
      )
      .reduce((s, a) => s + a.amount, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearAllocations, wardBudgetOrgId, period, singleQuarter]);

  const orgsAllocated = useMemo(() => {
    return new Set(
      yearAllocations
        .filter(
          (a) =>
            a.organizationId !== wardBudgetOrgId &&
            scopeQuartersForPool.includes(a.quarter as QuarterChoice) &&
            a.amount > 0,
        )
        .map((a) => a.organizationId),
    ).size;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearAllocations, wardBudgetOrgId, period, singleQuarter]);

  const unallocated = poolReceived - allocatedOut;
  const allocationCoveragePct =
    poolReceived > 0
      ? (allocatedOut / poolReceived) * 100
      : allocatedOut > 0
        ? 999
        : 0;
  const overAllocated = allocatedOut > poolReceived && poolReceived > 0;
  const showPoolCard =
    wardBudgetOrgId !== null && (poolReceived > 0 || allocatedOut > 0);

  // Single-period totals (used by the totals strip).
  const totalAllocSingle = useMemo(() => {
    return yearAllocations
      .filter((a) => a.quarter === singleQuarter)
      .reduce((s, a) => s + a.amount, 0);
  }, [yearAllocations, singleQuarter]);

  const totalAnnual = useMemo(() => {
    return yearAllocations
      .filter((a) => a.quarter === 0)
      .reduce((s, a) => s + a.amount, 0);
  }, [yearAllocations]);

  const years = Array.from(
    new Set([
      now.getFullYear(),
      ...(allocations ?? []).map((a) => a.year),
      ...(txns ?? []).map((t) => yearFromDate(t.date)),
    ]),
  ).sort((a, b) => b - a);

  const periodLabel =
    period === "all"
      ? `All quarters (${year})`
      : period === 0
        ? `Annual (${year})`
        : `Q${period} ${year}`;

  return (
    <div className="space-y-4">
      {closedYears.includes(year) && (
        <div className="card p-3 border-l-4 border-amber-500 bg-amber-50">
          <div className="text-sm">
            <strong>Year {year} is closed.</strong> Allocations are read-only.
            Reopen it in <em>Settings → Year Management</em> to make changes.
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Budget Allocations</h1>
          <p className="text-sm text-slate-500">
            Plan how much each organization may spend. Allocations are{" "}
            <em>budget caps</em>; they don't move money — actual cash flow is
            recorded as transactions.
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
              value={String(period)}
              onChange={(e) => {
                const v = e.target.value;
                setPeriod(v === "all" ? "all" : (Number(v) as QuarterChoice));
              }}
            >
              <option value="all">All quarters (overview)</option>
              <option value="0">Annual</option>
              <option value="1">Q1 (Jan–Mar)</option>
              <option value="2">Q2 (Apr–Jun)</option>
              <option value="3">Q3 (Jul–Sep)</option>
              <option value="4">Q4 (Oct–Dec)</option>
            </select>
          </div>
          {period !== "all" && period !== 0 && (
            <button className="btn-secondary" onClick={copyFromAnnual}>
              Split annual / 4
            </button>
          )}
        </div>
      </div>

      {/* A. Ward Budget Pool summary (scope-aware) */}
      {showPoolCard && (
        <div
          className={`card p-4 border-l-4 ${
            overAllocated
              ? "border-red-500"
              : allocationCoveragePct >= 80
                ? "border-amber-500"
                : "border-emerald-500"
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <div>
              <div className="font-semibold text-slate-800">
                Ward Budget Pool — {periodLabel}
              </div>
              <div className="text-xs text-slate-500">
                Income tagged to <em>Ward Budget</em> versus what you've planned
                to allocate to other organizations in this period.
              </div>
            </div>
            {overAllocated ? (
              <span className="badge bg-red-100 text-red-800 border-red-200">
                Over-allocated
              </span>
            ) : allocationCoveragePct >= 80 ? (
              <span className="badge bg-amber-100 text-amber-800 border-amber-200">
                {allocationCoveragePct.toFixed(0)}% allocated
              </span>
            ) : (
              <span className="badge bg-emerald-100 text-emerald-800 border-emerald-200">
                {allocationCoveragePct >= 999
                  ? "Allocated without income"
                  : `${allocationCoveragePct.toFixed(0)}% allocated`}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <PoolStat
              label="Pool received"
              value={formatCurrency(poolReceived, currency)}
              hint={
                period === "all"
                  ? "Income to Ward Budget (any quarter)"
                  : period === 0
                    ? "Income to Ward Budget (year)"
                    : `Income to Ward Budget (Q${period})`
              }
            />
            <PoolStat
              label="Allocated to orgs"
              value={formatCurrency(allocatedOut, currency)}
              hint={`${orgsAllocated} org(s) with allocations`}
            />
            <PoolStat
              label="Unallocated"
              value={formatCurrency(unallocated, currency)}
              tone={unallocated < 0 ? "danger" : "ok"}
              hint={
                unallocated < 0
                  ? "Allocated more than received"
                  : "Available to plan"
              }
            />
            <PoolStat
              label="Coverage"
              value={
                allocationCoveragePct >= 999
                  ? "—"
                  : `${allocationCoveragePct.toFixed(0)}%`
              }
              hint="Allocated ÷ pool received"
            />
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-200 rounded overflow-hidden">
                <div
                  className={`h-2 ${
                    overAllocated
                      ? "bg-red-500"
                      : allocationCoveragePct >= 80
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(100, allocationCoveragePct)}%`,
                  }}
                />
              </div>
              <div className="text-xs text-slate-600 w-16 text-right">
                {allocationCoveragePct >= 999
                  ? "—"
                  : `${allocationCoveragePct.toFixed(0)}%`}
              </div>
            </div>
            {overAllocated && (
              <div className="mt-2 text-sm text-red-700">
                ⚠ You have allocated{" "}
                <strong>
                  {formatCurrency(allocatedOut - poolReceived, currency)}
                </strong>{" "}
                more than the pool has received in this period. Reduce
                allocations or record an additional allotment.
              </div>
            )}
            {!overAllocated &&
              allocationCoveragePct >= 80 &&
              allocationCoveragePct < 999 && (
                <div className="mt-2 text-sm text-amber-700">
                  You have allocated {allocationCoveragePct.toFixed(0)}% of the
                  pool. Only {formatCurrency(unallocated, currency)} remains to
                  plan in this period.
                </div>
              )}
          </div>
        </div>
      )}

      {/* Totals strip — only meaningful in single-period view */}
      {period !== "all" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="card p-3">
            <div className="text-xs uppercase text-slate-500">
              {period === 0 ? "Annual total" : `Q${period} total`}
            </div>
            <div className="text-lg font-bold">
              {formatCurrency(totalAllocSingle, currency)}
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
              Click <strong>Edit</strong> on a row, type the amount, then press{" "}
              <strong>Save</strong>.
            </div>
          </div>
        </div>
      )}

      {/* B. Table — single-period or all-quarters overview */}
      {period === "all" ? (
        <AllQuartersTable
          orgs={orgs ?? []}
          year={year}
          wardBudgetOrgId={wardBudgetOrgId}
          allocationFor={allocationFor}
          spentForScope={spentForScope}
          incomeForScope={incomeForScope}
          draft={draft}
          startEdit={startEdit}
          cancelEdit={cancelEdit}
          saveOne={saveOne}
          removeAllocation={removeAllocation}
          setDraft={setDraft}
          currency={currency}
          closed={closedYears.includes(year)}
        />
      ) : (
        <SinglePeriodTable
          orgs={orgs ?? []}
          year={year}
          quarter={singleQuarter}
          wardBudgetOrgId={wardBudgetOrgId}
          allocationFor={allocationFor}
          spentForScope={spentForScope}
          incomeForScope={incomeForScope}
          draft={draft}
          startEdit={startEdit}
          cancelEdit={cancelEdit}
          saveOne={saveOne}
          removeAllocation={removeAllocation}
          setDraft={setDraft}
          currency={currency}
          closed={closedYears.includes(year)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

interface OrgRowCommonProps {
  orgs: { id?: number; name: string; order: number; active: boolean }[];
  year: number;
  wardBudgetOrgId: number | null;
  allocationFor: (orgId: number, q: QuarterChoice) => number;
  spentForScope: (orgId: number, q: QuarterChoice) => number;
  incomeForScope: (orgId: number, q: QuarterChoice) => number;
  draft: DraftMap;
  startEdit: (orgId: number, q: QuarterChoice) => void;
  cancelEdit: (orgId: number, q: QuarterChoice) => void;
  saveOne: (orgId: number, q: QuarterChoice) => Promise<void>;
  removeAllocation: (orgId: number, q: QuarterChoice) => Promise<void>;
  setDraft: React.Dispatch<React.SetStateAction<DraftMap>>;
  currency: string;
  closed: boolean;
}

interface SinglePeriodTableProps extends OrgRowCommonProps {
  quarter: QuarterChoice;
}

function SinglePeriodTable({
  orgs,
  quarter,
  wardBudgetOrgId,
  allocationFor,
  spentForScope,
  incomeForScope,
  draft,
  startEdit,
  cancelEdit,
  saveOne,
  removeAllocation,
  setDraft,
  currency,
  closed,
}: SinglePeriodTableProps) {
  return (
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
            <th className="py-2 px-3 text-right">Annual</th>
            <th className="py-2 px-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((o) => {
            const orgId = o.id!;
            const isPool = orgId === wardBudgetOrgId;
            const alloc = allocationFor(orgId, quarter);
            const spent = spentForScope(orgId, quarter);
            const income = incomeForScope(orgId, quarter);
            const annual = allocationFor(orgId, 0);
            const key = `${quarter}:${orgId}`;
            const isEditing = key in draft;
            const remaining = alloc + income - spent;
            return (
              <tr
                key={orgId}
                className={`border-b last:border-0 ${
                  isPool ? "bg-sky-50" : ""
                }`}
              >
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <span className={isPool ? "font-semibold" : ""}>
                      {o.name}
                    </span>
                    {isPool && (
                      <span
                        className="badge bg-sky-100 text-sky-800 border-sky-200"
                        title="Shared pool that receives stake allotments"
                      >
                        Pool
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-3 text-right">
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input w-32 inline-block"
                      value={draft[key]}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [key]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveOne(orgId, quarter);
                        if (e.key === "Escape") cancelEdit(orgId, quarter);
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
                  {closed ? (
                    <span className="text-slate-400 text-xs">Closed</span>
                  ) : isEditing ? (
                    <>
                      <button
                        className="text-brand-700 hover:underline"
                        onClick={() => saveOne(orgId, quarter)}
                      >
                        Save
                      </button>
                      <span className="mx-2 text-slate-300">|</span>
                      <button
                        className="text-slate-600 hover:underline"
                        onClick={() => cancelEdit(orgId, quarter)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="text-brand-700 hover:underline"
                        onClick={() => startEdit(orgId, quarter)}
                      >
                        Edit
                      </button>
                      {alloc > 0 && (
                        <>
                          <span className="mx-2 text-slate-300">|</span>
                          <button
                            className="text-red-600 hover:underline"
                            onClick={() => removeAllocation(orgId, quarter)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AllQuartersTable({
  orgs,
  wardBudgetOrgId,
  allocationFor,
  spentForScope,
  incomeForScope,
  draft,
  startEdit,
  cancelEdit,
  saveOne,
  setDraft,
  currency,
  closed,
}: OrgRowCommonProps) {
  const quarters: QuarterChoice[] = [1, 2, 3, 4];

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left border-b">
            <th className="py-2 px-3 sticky left-0 bg-slate-50 z-10">
              Organization
            </th>
            {quarters.map((q) => (
              <th key={q} className="py-2 px-3 text-right">
                Q{q}
              </th>
            ))}
            <th className="py-2 px-3 text-right">Annual</th>
            <th className="py-2 px-3 text-right border-l border-slate-200">
              Spent (year)
            </th>
            <th className="py-2 px-3 text-right">Income (year)</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((o) => {
            const orgId = o.id!;
            const isPool = orgId === wardBudgetOrgId;
            const yearSpent = spentForScope(orgId, 0);
            const yearIncome = incomeForScope(orgId, 0);
            return (
              <tr
                key={orgId}
                className={`border-b last:border-0 ${
                  isPool ? "bg-sky-50" : ""
                }`}
              >
                <td
                  className={`py-2 px-3 sticky left-0 z-10 ${
                    isPool ? "bg-sky-50" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={isPool ? "font-semibold" : ""}>
                      {o.name}
                    </span>
                    {isPool && (
                      <span
                        className="badge bg-sky-100 text-sky-800 border-sky-200"
                        title="Shared pool that receives stake allotments"
                      >
                        Pool
                      </span>
                    )}
                  </div>
                </td>
                {quarters.map((q) => (
                  <AllQuartersCell
                    key={q}
                    orgId={orgId}
                    quarter={q}
                    allocationFor={allocationFor}
                    draft={draft}
                    setDraft={setDraft}
                    startEdit={startEdit}
                    cancelEdit={cancelEdit}
                    saveOne={saveOne}
                    currency={currency}
                    closed={closed}
                  />
                ))}
                <AllQuartersCell
                  orgId={orgId}
                  quarter={0}
                  allocationFor={allocationFor}
                  draft={draft}
                  setDraft={setDraft}
                  startEdit={startEdit}
                  cancelEdit={cancelEdit}
                  saveOne={saveOne}
                  currency={currency}
                  closed={closed}
                  label="Annual"
                />
                <td className="py-2 px-3 text-right border-l border-slate-200 text-slate-600">
                  {formatCurrency(yearSpent, currency)}
                </td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {formatCurrency(yearIncome, currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="text-xs text-slate-500 px-3 py-2 border-t bg-slate-50">
        Click any cell amount to edit. Press <strong>Enter</strong> to save,{" "}
        <strong>Esc</strong> to cancel. Annual is a separate rollup — not the
        sum of Q1–Q4.
      </div>
    </div>
  );
}

function AllQuartersCell({
  orgId,
  quarter,
  allocationFor,
  draft,
  setDraft,
  startEdit,
  cancelEdit,
  saveOne,
  currency,
  closed,
  label,
}: {
  orgId: number;
  quarter: QuarterChoice;
  allocationFor: (orgId: number, q: QuarterChoice) => number;
  draft: DraftMap;
  setDraft: React.Dispatch<React.SetStateAction<DraftMap>>;
  startEdit: (orgId: number, q: QuarterChoice) => void;
  cancelEdit: (orgId: number, q: QuarterChoice) => void;
  saveOne: (orgId: number, q: QuarterChoice) => Promise<void>;
  currency: string;
  closed: boolean;
  label?: string;
}) {
  const key = `${quarter}:${orgId}`;
  const isEditing = key in draft;
  const value = allocationFor(orgId, quarter);

  if (isEditing) {
    return (
      <td className="py-2 px-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <input
            type="number"
            step="0.01"
            min="0"
            className="input w-24 inline-block"
            value={draft[key]}
            onChange={(e) =>
              setDraft((d) => ({ ...d, [key]: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") saveOne(orgId, quarter);
              if (e.key === "Escape") cancelEdit(orgId, quarter);
            }}
            onBlur={() => saveOne(orgId, quarter)}
            aria-label={`Allocation ${label ?? `Q${quarter}`}`}
            autoFocus
          />
        </div>
      </td>
    );
  }

  return (
    <td
      className={`py-2 px-3 text-right ${
        closed ? "text-slate-400" : "cursor-pointer hover:bg-brand-50"
      } ${quarter === 0 ? "font-medium" : ""}`}
      onClick={() => {
        if (!closed) startEdit(orgId, quarter);
      }}
      title={closed ? "Year closed" : "Click to edit"}
    >
      {value > 0 ? (
        formatCurrency(value, currency)
      ) : (
        <span className="text-slate-300">—</span>
      )}
    </td>
  );
}

function PoolStat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "ok" | "danger";
}) {
  const toneClass =
    tone === "danger" ? "text-red-600" : "text-slate-900";
  return (
    <div className="bg-slate-50 rounded p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}
