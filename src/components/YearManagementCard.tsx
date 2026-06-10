import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useClosedYears } from "../hooks/useClosedYears";
import { useToast } from "./Toast";
import { useConfirm } from "./Confirm";
import Modal from "./Modal";
import {
  buildCarryOverPreview,
  closeYear,
  reopenYear,
  type CarryOverRow,
} from "../utils/yearClose";
import { formatCurrency, yearFromDate } from "../utils/format";
import { useSetting } from "../hooks/useSetting";

/**
 * Settings → Year Management card.
 *
 * Lists every year that has data (transactions or allocations) plus the
 * current calendar year. Each row shows its status (Open / Closed) and a
 * Close or Reopen button. Closing a year opens a carry-over preview modal
 * where the clerk can edit per-org amounts before committing.
 */
export default function YearManagementCard() {
  const closedYears = useClosedYears();
  const toast = useToast();
  const confirm = useConfirm();
  const currency = useSetting<string>("currency", "PHP");

  // Years that have any data. Live so the list updates after import/wipe.
  const yearsWithData = useLiveQuery(async () => {
    const [txns, allocs] = await Promise.all([
      db.transactions.toArray(),
      db.allocations.toArray(),
    ]);
    const set = new Set<number>();
    txns.forEach((t) => set.add(yearFromDate(t.date)));
    allocs.forEach((a) => set.add(a.year));
    return [...set].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  }, []);

  const allYears = useMemo(() => {
    const now = new Date().getFullYear();
    const set = new Set<number>(yearsWithData ?? []);
    set.add(now);
    closedYears.forEach((y) => set.add(y));
    return [...set].sort((a, b) => b - a);
  }, [yearsWithData, closedYears]);

  // Carry-over modal state
  const [carryOpen, setCarryOpen] = useState(false);
  const [carryYear, setCarryYear] = useState<number | null>(null);
  const [carryRows, setCarryRows] = useState<CarryOverRow[]>([]);
  const [carryLoading, setCarryLoading] = useState(false);
  const [carrySubmitting, setCarrySubmitting] = useState(false);

  const openCloseFlow = async (year: number) => {
    setCarryYear(year);
    setCarryRows([]);
    setCarryOpen(true);
    setCarryLoading(true);
    try {
      const rows = await buildCarryOverPreview(year);
      setCarryRows(rows);
    } catch (err) {
      toast.error(`Failed to build preview: ${(err as Error).message}`);
      setCarryOpen(false);
    } finally {
      setCarryLoading(false);
    }
  };

  const reopen = async (year: number) => {
    const ok = await confirm({
      title: `Reopen ${year}?`,
      message:
        "Edits will be allowed again for this year. Carry-over allocations already created on the next year will not be undone.",
      confirmLabel: "Reopen",
      cancelLabel: "Cancel",
    });
    if (!ok) return;
    try {
      await reopenYear(year);
      toast.success(`Year ${year} reopened.`);
    } catch (err) {
      toast.error(`Reopen failed: ${(err as Error).message}`);
    }
  };

  const updateRow = (orgId: number, patch: Partial<CarryOverRow>) => {
    setCarryRows((prev) =>
      prev.map((r) => (r.organizationId === orgId ? { ...r, ...patch } : r)),
    );
  };

  const totalCarry = carryRows
    .filter((r) => r.include)
    .reduce((s, r) => s + (Number.isFinite(r.carryAmount) ? r.carryAmount : 0), 0);

  const submitClose = async () => {
    if (carryYear == null) return;
    const includedCount = carryRows.filter((r) => r.include && r.carryAmount > 0).length;
    const ok = await confirm({
      title: `Close year ${carryYear}?`,
      message: includedCount
        ? `This will lock ${carryYear} for editing and add ${includedCount} carry-over allocation(s) to ${carryYear + 1}. You can reopen the year later from this section.`
        : `This will lock ${carryYear} for editing. No carry-overs will be applied. You can reopen the year later from this section.`,
      tone: "danger",
      confirmLabel: "Close year",
      cancelLabel: "Cancel",
      confirmPhrase: "CLOSE",
    });
    if (!ok) return;
    setCarrySubmitting(true);
    try {
      const r = await closeYear(carryYear, carryRows);
      toast.success(
        `Year ${carryYear} closed${
          r.carryAdded ? ` · ${r.carryAdded} carry-over(s) applied` : ""
        }.`,
      );
      setCarryOpen(false);
    } catch (err) {
      toast.error(`Close failed: ${(err as Error).message}`);
    } finally {
      setCarrySubmitting(false);
    }
  };

  // Make sure modal is closed when component unmounts
  useEffect(() => () => setCarryOpen(false), []);

  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-semibold text-slate-800">Year Management</h3>
      <p className="text-sm text-slate-600">
        Close a fiscal year to lock further edits to its transactions,
        allocations, and quarterly allotments. Closed years stay visible in
        Dashboards and Reports. You can reopen a year at any time.
      </p>

      {allYears.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No years yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600 border-b border-slate-200">
                <th className="py-2 pr-3">Year</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {allYears.map((y) => {
                const closed = closedYears.includes(y);
                return (
                  <tr key={y} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium">{y}</td>
                    <td className="py-2 pr-3">
                      {closed ? (
                        <span className="badge bg-amber-100 text-amber-800 border-amber-200">
                          Closed
                        </span>
                      ) : (
                        <span className="badge bg-emerald-100 text-emerald-800 border-emerald-200">
                          Open
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {closed ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => reopen(y)}
                        >
                          Reopen
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openCloseFlow(y)}
                        >
                          Close year…
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={carryOpen}
        title={`Close year ${carryYear ?? ""}`}
        onClose={() => (carrySubmitting ? undefined : setCarryOpen(false))}
        widthClass="max-w-3xl"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Review each organization&apos;s remaining balance for{" "}
            <strong>{carryYear}</strong>. Select which amounts to carry forward
            into the annual (Q0) allocation for{" "}
            <strong>{carryYear != null ? carryYear + 1 : ""}</strong>.
          </p>

          {carryLoading ? (
            <p className="text-sm text-slate-500">Loading preview…</p>
          ) : carryRows.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              No organizations found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b border-slate-200">
                    <th className="py-2 pr-3">
                      <span className="sr-only">Carry over?</span>
                    </th>
                    <th className="py-2 pr-3">Organization</th>
                    <th className="py-2 pr-3 text-right">Allocated</th>
                    <th className="py-2 pr-3 text-right">Income</th>
                    <th className="py-2 pr-3 text-right">Spent</th>
                    <th className="py-2 pr-3 text-right">Remaining</th>
                    <th className="py-2 pr-3 text-right">Carry to Q0</th>
                  </tr>
                </thead>
                <tbody>
                  {carryRows.map((r) => (
                    <tr
                      key={r.organizationId}
                      className="border-b border-slate-100"
                    >
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={(e) =>
                            updateRow(r.organizationId, {
                              include: e.target.checked,
                            })
                          }
                          aria-label={`Carry over ${r.organizationName}`}
                        />
                      </td>
                      <td className="py-2 pr-3">{r.organizationName}</td>
                      <td className="py-2 pr-3 text-right">
                        {formatCurrency(r.allocated, currency)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {formatCurrency(r.income, currency)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {formatCurrency(r.spent, currency)}
                      </td>
                      <td
                        className={`py-2 pr-3 text-right ${
                          r.remaining < 0 ? "text-red-700" : ""
                        }`}
                      >
                        {formatCurrency(r.remaining, currency)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="input w-32 text-right"
                          value={Number.isFinite(r.carryAmount) ? r.carryAmount : 0}
                          disabled={!r.include}
                          onChange={(e) =>
                            updateRow(r.organizationId, {
                              carryAmount: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} className="py-2 pr-3 text-right font-semibold">
                      Total carry-over
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">
                      {formatCurrency(totalCarry, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-end pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCarryOpen(false)}
              disabled={carrySubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={submitClose}
              disabled={carryLoading || carrySubmitting}
            >
              {carrySubmitting ? "Closing…" : `Close ${carryYear ?? ""}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
