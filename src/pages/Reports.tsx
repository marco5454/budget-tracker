import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { downloadCsv } from "../utils/backup";
import {
  formatCurrency,
  monthIndexFromDate,
  MONTH_NAMES,
  quarterFromDate,
  yearFromDate,
} from "../utils/format";
import { useSetting } from "../hooks/useSetting";

export default function Reports() {
  const currency = useSetting<string>("currency", "PHP");
  const orgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const cats = useLiveQuery(() => db.categories.toArray(), []);
  const txns = useLiveQuery(
    () => db.transactions.filter((t) => !t.deletedAt).toArray(),
    [],
  );
  const allocations = useLiveQuery(
    () => db.allocations.filter((a) => !a.deletedAt).toArray(),
    [],
  );

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const yearTxns = (txns ?? []).filter((t) => yearFromDate(t.date) === year);
  const yearAllocs = (allocations ?? []).filter((a) => a.year === year);

  const orgRows = useMemo(() => {
    return (orgs ?? []).map((o) => {
      const allocAnnual = yearAllocs
        .filter((a) => a.organizationId === o.id && a.quarter === 0)
        .reduce((s, a) => s + a.amount, 0);
      const allocQuarters = [1, 2, 3, 4].map((q) =>
        yearAllocs
          .filter((a) => a.organizationId === o.id && a.quarter === q)
          .reduce((s, a) => s + a.amount, 0),
      );
      const spentQuarters = [1, 2, 3, 4].map((q) =>
        yearTxns
          .filter(
            (t) =>
              t.organizationId === o.id &&
              t.type === "expense" &&
              quarterFromDate(t.date) === q,
          )
          .reduce((s, t) => s + t.amount, 0),
      );
      const incomeYear = yearTxns
        .filter((t) => t.organizationId === o.id && t.type === "income")
        .reduce((s, t) => s + t.amount, 0);
      const spentYear = spentQuarters.reduce((s, v) => s + v, 0);
      const totalAlloc = allocAnnual + allocQuarters.reduce((s, v) => s + v, 0);
      return {
        id: o.id!,
        name: o.name,
        allocAnnual,
        allocQuarters,
        spentQuarters,
        spentYear,
        incomeYear,
        totalAlloc,
        remaining: totalAlloc + incomeYear - spentYear,
      };
    });
  }, [orgs, yearTxns, yearAllocs]);

  const categoryRows = useMemo(() => {
    const map = new Map<number | null, number>();
    for (const t of yearTxns) {
      if (t.type !== "expense") continue;
      const k = t.categoryId ?? null;
      map.set(k, (map.get(k) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({
        name: cats?.find((c) => c.id === k)?.name ?? "Uncategorized",
        amount: v,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [yearTxns, cats]);

  const monthlyRows = useMemo(() => {
    const arr = MONTH_NAMES.map((m) => ({ month: m, income: 0, expense: 0 }));
    for (const t of yearTxns) {
      const i = monthIndexFromDate(t.date);
      if (t.type === "income") arr[i].income += t.amount;
      else arr[i].expense += t.amount;
    }
    return arr;
  }, [yearTxns]);

  const exportAnnual = () => {
    const headers = [
      "Organization",
      "Annual Allocation",
      "Q1 Alloc",
      "Q2 Alloc",
      "Q3 Alloc",
      "Q4 Alloc",
      "Q1 Spent",
      "Q2 Spent",
      "Q3 Spent",
      "Q4 Spent",
      "Year Spent",
      "Year Income",
      "Total Budget",
      "Remaining",
    ];
    const rows = orgRows.map((r) => [
      r.name,
      r.allocAnnual.toFixed(2),
      r.allocQuarters[0].toFixed(2),
      r.allocQuarters[1].toFixed(2),
      r.allocQuarters[2].toFixed(2),
      r.allocQuarters[3].toFixed(2),
      r.spentQuarters[0].toFixed(2),
      r.spentQuarters[1].toFixed(2),
      r.spentQuarters[2].toFixed(2),
      r.spentQuarters[3].toFixed(2),
      r.spentYear.toFixed(2),
      r.incomeYear.toFixed(2),
      (r.totalAlloc + r.incomeYear).toFixed(2),
      r.remaining.toFixed(2),
    ]);
    downloadCsv(`annual-report-${year}.csv`, headers, rows);
  };

  const exportCategories = () => {
    downloadCsv(
      `category-report-${year}.csv`,
      ["Category", "Total Spent"],
      categoryRows.map((r) => [r.name, r.amount.toFixed(2)]),
    );
  };

  const exportMonthly = () => {
    downloadCsv(
      `monthly-report-${year}.csv`,
      ["Month", "Income", "Expense", "Net"],
      monthlyRows.map((r) => [
        r.month,
        r.income.toFixed(2),
        r.expense.toFixed(2),
        (r.income - r.expense).toFixed(2),
      ]),
    );
  };

  const totalAlloc = orgRows.reduce((s, r) => s + r.totalAlloc, 0);
  const totalIncome = orgRows.reduce((s, r) => s + r.incomeYear, 0);
  const totalSpent = orgRows.reduce((s, r) => s + r.spentYear, 0);

  const years = Array.from(
    new Set([
      now.getFullYear(),
      ...(txns ?? []).map((t) => yearFromDate(t.date)),
      ...(allocations ?? []).map((a) => a.year),
    ]),
  ).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
          <p className="text-sm text-slate-500">
            Annual and quarterly breakdown. All reports can be exported to CSV
            and opened in Excel or Google Sheets.
          </p>
        </div>
        <div>
          <label className="label">Year</label>
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total Allocations" value={formatCurrency(totalAlloc, currency)} />
        <Stat label="Total Income" value={formatCurrency(totalIncome, currency)} />
        <Stat label="Total Spent" value={formatCurrency(totalSpent, currency)} />
        <Stat
          label="Remaining"
          value={formatCurrency(totalAlloc + totalIncome - totalSpent, currency)}
        />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800">Annual by Organization ({year})</h3>
          <button className="btn-secondary" onClick={exportAnnual}>
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left border-b">
                <th className="py-2 px-3">Organization</th>
                <th className="py-2 px-3 text-right">Annual Alloc.</th>
                <th className="py-2 px-3 text-right">Q1 Spent</th>
                <th className="py-2 px-3 text-right">Q2 Spent</th>
                <th className="py-2 px-3 text-right">Q3 Spent</th>
                <th className="py-2 px-3 text-right">Q4 Spent</th>
                <th className="py-2 px-3 text-right">Year Spent</th>
                <th className="py-2 px-3 text-right">Income</th>
                <th className="py-2 px-3 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {orgRows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 px-3">{r.name}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(r.allocAnnual, currency)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(r.spentQuarters[0], currency)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(r.spentQuarters[1], currency)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(r.spentQuarters[2], currency)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(r.spentQuarters[3], currency)}</td>
                  <td className="py-2 px-3 text-right font-medium">
                    {formatCurrency(r.spentYear, currency)}
                  </td>
                  <td className="py-2 px-3 text-right">{formatCurrency(r.incomeYear, currency)}</td>
                  <td className={`py-2 px-3 text-right ${r.remaining < 0 ? "text-red-600 font-semibold" : ""}`}>
                    {formatCurrency(r.remaining, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Spending by Category</h3>
            <button className="btn-secondary" onClick={exportCategories}>
              Export CSV
            </button>
          </div>
          {categoryRows.length === 0 ? (
            <p className="text-sm text-slate-500">No expenses recorded for {year}.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left border-b">
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((r) => (
                  <tr key={r.name} className="border-b last:border-0">
                    <td className="py-2 px-3">{r.name}</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(r.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Monthly Summary</h3>
            <button className="btn-secondary" onClick={exportMonthly}>
              Export CSV
            </button>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left border-b">
                <th className="py-2 px-3">Month</th>
                <th className="py-2 px-3 text-right">Income</th>
                <th className="py-2 px-3 text-right">Expense</th>
                <th className="py-2 px-3 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.map((r) => (
                <tr key={r.month} className="border-b last:border-0">
                  <td className="py-2 px-3">{r.month}</td>
                  <td className="py-2 px-3 text-right text-emerald-700">{formatCurrency(r.income, currency)}</td>
                  <td className="py-2 px-3 text-right text-red-600">{formatCurrency(r.expense, currency)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(r.income - r.expense, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}
