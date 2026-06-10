import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useToast } from "./Toast";
import { useConfirm } from "./Confirm";
import { useSetting } from "../hooks/useSetting";
import { formatCurrency, MAX_AMOUNT } from "../utils/format";
import {
  deleteCategoryLimit,
  getCategorySpentYTD,
  upsertCategoryLimit,
} from "../utils/categoryLimits";

/**
 * Settings → Category Limits card.
 *
 * Lets the user set a yearly cap per (org, category). The cap is a soft
 * warning only — when an expense would push spent above the cap, the
 * Add Transaction form asks the clerk to confirm. Caps are also surfaced
 * on the Dashboard's Needs Attention widget and the Reports page.
 */
export default function CategoryLimitsCard() {
  const toast = useToast();
  const confirm = useConfirm();
  const currency = useSetting<string>("currency", "PHP");

  const orgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const cats = useLiveQuery(() => db.categories.toArray(), []);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);

  const limits = useLiveQuery(
    () => db.categoryLimits.where("year").equals(year).toArray(),
    [year],
  );

  // Add-form state
  const [orgId, setOrgId] = useState<number | "">("");
  const [catId, setCatId] = useState<number | "">("");
  const [amount, setAmount] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // Spend lookup keyed by `${orgId}|${catId}`
  const [spendMap, setSpendMap] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    const run = async () => {
      const next: Record<string, number> = {};
      for (const lim of limits ?? []) {
        const v = await getCategorySpentYTD(
          lim.year,
          lim.organizationId,
          lim.categoryId,
        );
        next[`${lim.organizationId}|${lim.categoryId}`] = v;
      }
      if (alive) setSpendMap(next);
    };
    run().catch(() => {});
    return () => {
      alive = false;
    };
  }, [limits]);

  const orgName = (id: number) =>
    (orgs ?? []).find((o) => o.id === id)?.name ?? `#${id}`;
  const catName = (id: number) =>
    (cats ?? []).find((c) => c.id === id)?.name ?? `#${id}`;

  const availableCats = useMemo(() => {
    if (orgId === "") return [];
    const list = cats ?? [];
    // Categories scoped to that org first, then global (organizationId === null)
    return list.filter(
      (c) => c.active && (c.organizationId === orgId || c.organizationId == null),
    );
  }, [cats, orgId]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>([currentYear, currentYear - 1, currentYear + 1]);
    (limits ?? []).forEach((l) => set.add(l.year));
    return [...set].sort((a, b) => b - a);
  }, [limits, currentYear]);

  const addLimit = async () => {
    if (orgId === "") {
      toast.error("Choose an organization.");
      return;
    }
    if (catId === "") {
      toast.error("Choose a category.");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a positive amount.");
      return;
    }
    if (amt > MAX_AMOUNT) {
      toast.error("Amount exceeds the maximum allowed.");
      return;
    }
    setBusy(true);
    try {
      const r = await upsertCategoryLimit({
        year,
        organizationId: orgId,
        categoryId: catId,
        amount: amt,
      });
      toast.success(
        r.action === "create" ? "Limit added." : "Limit updated.",
      );
      setOrgId("");
      setCatId("");
      setAmount("");
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const removeLimit = async (id: number, label: string) => {
    const ok = await confirm({
      title: "Remove category limit?",
      message: `Remove the limit for ${label}? Past transactions are unaffected.`,
      tone: "danger",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      await deleteCategoryLimit(id);
      toast.success("Limit removed.");
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-slate-800">
          Category Limits (soft warnings)
        </h3>
        <div className="flex items-center gap-2">
          <label className="label" htmlFor="catlimit-year">
            Year
          </label>
          <select
            id="catlimit-year"
            className="input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Set a yearly cap per organization + category. When a new transaction
        would push spending above the cap, the Add Transaction form will warn
        you (you can still save). Caps also appear on the Dashboard&apos;s
        Needs Attention list and on Reports.
      </p>

      <div className="grid sm:grid-cols-4 gap-2 items-end">
        <div>
          <label className="label" htmlFor="catlimit-org">
            Organization
          </label>
          <select
            id="catlimit-org"
            className="input"
            value={orgId}
            onChange={(e) => {
              const v = e.target.value;
              setOrgId(v === "" ? "" : Number(v));
              setCatId("");
            }}
          >
            <option value="">Select…</option>
            {(orgs ?? [])
              .filter((o) => o.active)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="catlimit-cat">
            Category
          </label>
          <select
            id="catlimit-cat"
            className="input"
            value={catId}
            onChange={(e) => {
              const v = e.target.value;
              setCatId(v === "" ? "" : Number(v));
            }}
            disabled={orgId === ""}
          >
            <option value="">Select…</option>
            {availableCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="catlimit-amount">
            Annual cap
          </label>
          <input
            id="catlimit-amount"
            type="number"
            min={0}
            step="0.01"
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addLimit();
            }}
          />
        </div>
        <div>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={addLimit}
            disabled={busy}
          >
            {busy ? "Saving…" : "Add / Update"}
          </button>
        </div>
      </div>

      {(limits ?? []).length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No category limits set for {year}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600 border-b border-slate-200">
                <th className="py-2 pr-3">Organization</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3 text-right">Limit</th>
                <th className="py-2 pr-3 text-right">Spent YTD</th>
                <th className="py-2 pr-3 text-right">Remaining</th>
                <th className="py-2 pr-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(limits ?? []).map((l) => {
                const spent = spendMap[`${l.organizationId}|${l.categoryId}`] ?? 0;
                const remaining = l.amount - spent;
                const pct = l.amount > 0 ? (spent / l.amount) * 100 : 0;
                const tone =
                  pct > 100
                    ? "text-red-700"
                    : pct >= 80
                      ? "text-amber-700"
                      : "text-emerald-700";
                const label = `${orgName(l.organizationId)} · ${catName(
                  l.categoryId,
                )}`;
                return (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{orgName(l.organizationId)}</td>
                    <td className="py-2 pr-3">{catName(l.categoryId)}</td>
                    <td className="py-2 pr-3 text-right">
                      {formatCurrency(l.amount, currency)}
                    </td>
                    <td className={`py-2 pr-3 text-right ${tone}`}>
                      {formatCurrency(spent, currency)}{" "}
                      <span className="text-xs text-slate-500">
                        ({pct.toFixed(0)}%)
                      </span>
                    </td>
                    <td
                      className={`py-2 pr-3 text-right ${
                        remaining < 0 ? "text-red-700" : ""
                      }`}
                    >
                      {formatCurrency(remaining, currency)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => removeLimit(l.id!, label)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
