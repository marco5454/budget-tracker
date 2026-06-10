import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { db } from "../db/db";
import {
  formatCurrency,
  MONTH_NAMES,
  monthIndexFromDate,
  quarterFromDate,
  yearFromDate,
} from "../utils/format";
import Modal from "../components/Modal";
import TransactionForm from "../components/TransactionForm";
import AllotmentQuickAdd from "../components/AllotmentQuickAdd";
import AttentionWidget from "../components/AttentionWidget";
import PrintHeader from "../components/PrintHeader";
import { useSetting } from "../hooks/useSetting";
import { useClosedYears } from "../hooks/useClosedYears";

const COLORS = [
  "#006fc6",
  "#0c8ce8",
  "#36a8f6",
  "#7cc5fb",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

export default function Dashboard() {
  const currency = useSetting<string>("currency", "PHP");
  const closedYears = useClosedYears();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState<0 | 1 | 2 | 3 | 4>(
    quarterFromDate(now.toISOString()) as 1 | 2 | 3 | 4,
  );
  const [showAdd, setShowAdd] = useState(false);
  const [addDirty, setAddDirty] = useState(false);
  const [showAllotment, setShowAllotment] = useState(false);

  const txns = useLiveQuery(
    () => db.transactions.filter((t) => !t.deletedAt).toArray(),
    [],
  );
  const orgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const allocations = useLiveQuery(
    () => db.allocations.filter((a) => !a.deletedAt).toArray(),
    [],
  );

  const filteredTxns = useMemo(() => {
    if (!txns) return [];
    return txns.filter((t) => {
      if (yearFromDate(t.date) !== year) return false;
      if (quarter !== 0 && quarterFromDate(t.date) !== quarter) return false;
      return true;
    });
  }, [txns, year, quarter]);

  const ytdTxns = useMemo(
    () => (txns ?? []).filter((t) => yearFromDate(t.date) === year),
    [txns, year],
  );

  // Allocations for current scope
  const scopeAllocations = useMemo(() => {
    if (!allocations) return [];
    if (quarter === 0) {
      return allocations.filter((a) => a.year === year);
    }
    return allocations.filter((a) => a.year === year && a.quarter === quarter);
  }, [allocations, year, quarter]);

  const totalAllocated = scopeAllocations.reduce((s, a) => s + a.amount, 0);
  const totalIncome = filteredTxns
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalSpent = filteredTxns
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const totalBudget = totalAllocated + totalIncome;
  const remaining = totalBudget - totalSpent;
  const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Per-org breakdown
  const perOrg = useMemo(() => {
    if (!orgs) return [];
    return orgs.map((o) => {
      const allocated = scopeAllocations
        .filter((a) => a.organizationId === o.id)
        .reduce((s, a) => s + a.amount, 0);
      const income = filteredTxns
        .filter((t) => t.organizationId === o.id && t.type === "income")
        .reduce((s, t) => s + t.amount, 0);
      const spent = filteredTxns
        .filter((t) => t.organizationId === o.id && t.type === "expense")
        .reduce((s, t) => s + t.amount, 0);
      const budget = allocated + income;
      const remaining = budget - spent;
      const pct = budget > 0 ? (spent / budget) * 100 : spent > 0 ? 999 : 0;
      return {
        id: o.id!,
        name: o.name,
        allocated,
        income,
        spent,
        budget,
        remaining,
        pct,
      };
    });
  }, [orgs, scopeAllocations, filteredTxns]);

  const orgBarData = perOrg
    .filter((o) => o.budget > 0 || o.spent > 0)
    .map((o) => ({
      name: o.name,
      Spent: Math.round(o.spent),
      Remaining: Math.max(0, Math.round(o.remaining)),
    }));

  // Spending by category (expenses only)
  const cats = useLiveQuery(() => db.categories.toArray(), []);
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filteredTxns) {
      if (t.type !== "expense") continue;
      const cat = cats?.find((c) => c.id === t.categoryId);
      const name = cat?.name ?? "Uncategorized";
      map.set(name, (map.get(name) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTxns, cats]);

  // Monthly trend (always whole year)
  const monthlyTrend = useMemo(() => {
    const data = MONTH_NAMES.map((m, i) => ({ name: m, Income: 0, Expense: 0, idx: i }));
    for (const t of ytdTxns) {
      const i = monthIndexFromDate(t.date);
      if (t.type === "income") data[i].Income += t.amount;
      else data[i].Expense += t.amount;
    }
    return data.map((d) => ({
      ...d,
      Income: Math.round(d.Income * 100) / 100,
      Expense: Math.round(d.Expense * 100) / 100,
    }));
  }, [ytdTxns]);

  const recent = useMemo(() => {
    return [...(txns ?? [])]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 8);
  }, [txns]);

  const alerts = perOrg.filter((o) => o.budget > 0 && (o.pct >= 80 || o.spent > o.budget));

  const years = Array.from(
    new Set([
      now.getFullYear(),
      ...(txns ?? []).map((t) => yearFromDate(t.date)),
      ...(allocations ?? []).map((a) => a.year),
    ]),
  ).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <PrintHeader
        title="Budget Dashboard"
        subtitle={`${year} · ${quarter === 0 ? "Annual" : `Q${quarter}`}`}
      />
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Overview of ward budget and spending.
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
            </select>
          </div>
          {closedYears.includes(year) && (
            <span
              className="badge bg-amber-100 text-amber-800 border-amber-200 self-end mb-1"
              title="This year is closed; edits are locked. Reopen from Settings → Year Management."
            >
              Year {year} closed
            </span>
          )}
          <div>
            <label className="label">Period</label>
            <select
              className="input"
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value) as 0 | 1 | 2 | 3 | 4)}
            >
              <option value={0}>Annual</option>
              <option value={1}>Q1 (Jan–Mar)</option>
              <option value={2}>Q2 (Apr–Jun)</option>
              <option value={3}>Q3 (Jul–Sep)</option>
              <option value={4}>Q4 (Oct–Dec)</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={() => setShowAllotment(true)}>
            + Allotment
          </button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            + Add Transaction
          </button>
          <button className="btn-secondary" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print-keep-together">
        <KpiCard label="Total Budget" value={formatCurrency(totalBudget, currency)} sub="Allocations + Income" />
        <KpiCard label="Spent" value={formatCurrency(totalSpent, currency)} sub={`${percentUsed.toFixed(1)}% of budget`} />
        <KpiCard
          label="Remaining"
          value={formatCurrency(remaining, currency)}
          sub={remaining < 0 ? "Over budget" : "Available"}
          tone={remaining < 0 ? "danger" : "ok"}
        />
        <KpiCard label="Income" value={formatCurrency(totalIncome, currency)} sub="Allotments / transfers" />
      </div>

      <AttentionWidget year={year} />

      {alerts.length > 0 && (
        <div className="card p-4 border-l-4 border-amber-500">
          <div className="font-semibold text-slate-800 mb-2">Alerts</div>
          <ul className="space-y-1 text-sm">
            {alerts.map((a) => (
              <li key={a.id} className="flex justify-between">
                <span>
                  <span className="font-medium">{a.name}</span> —{" "}
                  {a.spent > a.budget ? (
                    <span className="text-red-600">over budget by {formatCurrency(a.spent - a.budget, currency)}</span>
                  ) : (
                    <span className="text-amber-700">{a.pct.toFixed(0)}% of budget used</span>
                  )}
                </span>
                <span className="text-slate-500">
                  {formatCurrency(a.spent, currency)} / {formatCurrency(a.budget, currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-3">
            Budget vs Spent by Organization
          </h3>
          {orgBarData.length === 0 ? (
            <EmptyHint message="No data for this period yet." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={orgBarData} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={130} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                <Legend />
                <Bar dataKey="Spent" stackId="a" fill="#0c8ce8" />
                <Bar dataKey="Remaining" stackId="a" fill="#cbd5e1" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Spending by Category</h3>
          {byCategory.length === 0 ? (
            <EmptyHint message="No expenses recorded yet." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={90} label>
                  {byCategory.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-3">
            Monthly Trend ({year})
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
              <Legend />
              <Line type="monotone" dataKey="Income" stroke="#22c55e" strokeWidth={2} />
              <Line type="monotone" dataKey="Expense" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Recent Transactions</h3>
            <Link to="/transactions" className="text-sm text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyHint message="No transactions yet." />
          ) : (
            <ul className="divide-y text-sm">
              {recent.map((t) => {
                const org = orgs?.find((o) => o.id === t.organizationId);
                return (
                  <li key={t.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800">
                        {t.description || t.payee || "(no description)"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {t.date} · {org?.name ?? "—"}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        t.type === "expense" ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {t.type === "expense" ? "-" : "+"}
                      {formatCurrency(t.amount, currency)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Per-Organization Detail</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-3">Organization</th>
                <th className="py-2 pr-3 text-right">Allocated</th>
                <th className="py-2 pr-3 text-right">Income</th>
                <th className="py-2 pr-3 text-right">Total Budget</th>
                <th className="py-2 pr-3 text-right">Spent</th>
                <th className="py-2 pr-3 text-right">Remaining</th>
                <th className="py-2 pr-3">Usage</th>
              </tr>
            </thead>
            <tbody>
              {perOrg.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{o.name}</td>
                  <td className="py-2 pr-3 text-right">{formatCurrency(o.allocated, currency)}</td>
                  <td className="py-2 pr-3 text-right">{formatCurrency(o.income, currency)}</td>
                  <td className="py-2 pr-3 text-right font-medium">{formatCurrency(o.budget, currency)}</td>
                  <td className="py-2 pr-3 text-right">{formatCurrency(o.spent, currency)}</td>
                  <td
                    className={`py-2 pr-3 text-right ${
                      o.remaining < 0 ? "text-red-600 font-semibold" : ""
                    }`}
                  >
                    {formatCurrency(o.remaining, currency)}
                  </td>
                  <td className="py-2 pr-3 w-44">
                    <ProgressBar pct={o.pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={showAdd}
        title="Add Transaction"
        onClose={() => {
          setShowAdd(false);
          setAddDirty(false);
        }}
        dirty={addDirty}
      >
        <TransactionForm
          onSaved={() => {
            setShowAdd(false);
            setAddDirty(false);
          }}
          onCancel={() => {
            setShowAdd(false);
            setAddDirty(false);
          }}
          onDirtyChange={setAddDirty}
        />
      </Modal>

      <AllotmentQuickAdd
        open={showAllotment}
        onClose={() => setShowAllotment(false)}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "ok" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "ok"
        ? "text-emerald-700"
        : "text-slate-900";
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-200 rounded">
        <div className={`h-2 rounded ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <div className="text-xs text-slate-600 w-10 text-right">
        {pct >= 999 ? "—" : `${pct.toFixed(0)}%`}
      </div>
    </div>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="grid place-items-center text-sm text-slate-500 py-10">
      {message}
    </div>
  );
}
