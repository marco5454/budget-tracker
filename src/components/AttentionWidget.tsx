import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import {
  formatCurrency,
  parseLocalDate,
  yearFromDate,
} from "../utils/format";
import { useSetting } from "../hooks/useSetting";

interface Issue {
  key: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  href: string;
}

const STUCK_DAYS = 14;
const RECEIPT_THRESHOLD = 1000; // ₱1,000
const PERCENTILE = 0.95;

/**
 * Surfaces things that need the clerk's attention:
 *  - Organizations over budget for the current year-to-date.
 *  - Transactions stuck in pending / approved status > 14 days.
 *  - Expenses ≥ ₱1,000 with no attached receipt.
 *  - Unusually large expenses (top 5% YTD).
 */
export default function AttentionWidget({ year }: { year: number }) {
  const currency = useSetting<string>("currency", "PHP");
  const txns = useLiveQuery(
    () => db.transactions.filter((t) => !t.deletedAt).toArray(),
    [],
  );
  const orgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const allocations = useLiveQuery(
    () => db.allocations.filter((a) => !a.deletedAt).toArray(),
    [],
  );

  const issues = useMemo<Issue[]>(() => {
    if (!txns || !orgs || !allocations) return [];
    const out: Issue[] = [];
    const yearTxns = txns.filter((t) => yearFromDate(t.date) === year);
    const yearAllocs = allocations.filter((a) => a.year === year);
    const yearExpenses = yearTxns.filter((t) => t.type === "expense");

    // 1) Over-budget orgs
    for (const o of orgs) {
      const allocated = yearAllocs
        .filter((a) => a.organizationId === o.id)
        .reduce((s, a) => s + a.amount, 0);
      const income = yearTxns
        .filter((t) => t.organizationId === o.id && t.type === "income")
        .reduce((s, t) => s + t.amount, 0);
      const spent = yearTxns
        .filter((t) => t.organizationId === o.id && t.type === "expense")
        .reduce((s, t) => s + t.amount, 0);
      const budget = allocated + income;
      if (budget > 0 && spent > budget) {
        out.push({
          key: `over-${o.id}`,
          severity: "high",
          title: `${o.name} is over budget`,
          detail: `Spent ${formatCurrency(spent, currency)} of ${formatCurrency(budget, currency)} (${formatCurrency(spent - budget, currency)} over).`,
          href: "/budget",
        });
      }
    }

    // 2) Stuck workflow status
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STUCK_DAYS);
    for (const t of txns) {
      if (t.deletedAt) continue;
      if (t.status !== "pending" && t.status !== "approved") continue;
      const d = parseLocalDate(t.date);
      if (!Number.isNaN(d.getTime()) && d < cutoff) {
        out.push({
          key: `stuck-${t.id}`,
          severity: "medium",
          title: `${t.status === "pending" ? "Pending" : "Approved"} for ${daysAgo(d)} days`,
          detail: `${t.date} · ${t.description || t.payee || "(no description)"} · ${formatCurrency(t.amount, currency)}`,
          href: "/transactions",
        });
      }
    }

    // 3) Missing receipt on large expenses
    for (const t of yearExpenses) {
      if (t.amount >= RECEIPT_THRESHOLD && !t.receiptDataUrl) {
        out.push({
          key: `noreceipt-${t.id}`,
          severity: "medium",
          title: "Missing receipt",
          detail: `${t.date} · ${formatCurrency(t.amount, currency)} · ${t.description || t.payee || "(no description)"}`,
          href: "/transactions",
        });
      }
    }

    // 4) Unusually large (top 5%) YTD expenses
    if (yearExpenses.length >= 10) {
      const sorted = [...yearExpenses].sort((a, b) => a.amount - b.amount);
      const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * PERCENTILE)));
      const threshold = sorted[idx].amount;
      const outliers = yearExpenses.filter((t) => t.amount >= threshold);
      // Cap to avoid flooding
      for (const t of outliers.slice(0, 5)) {
        out.push({
          key: `large-${t.id}`,
          severity: "low",
          title: "Unusually large expense",
          detail: `${t.date} · ${formatCurrency(t.amount, currency)} · ${t.description || t.payee || "(no description)"}`,
          href: "/transactions",
        });
      }
    }

    // Stable order by severity then key
    const rank: Record<Issue["severity"], number> = { high: 0, medium: 1, low: 2 };
    out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.key.localeCompare(b.key));
    return out;
  }, [txns, orgs, allocations, year, currency]);

  if (issues.length === 0) {
    return (
      <div className="card p-4 border-l-4 border-emerald-500">
        <div className="font-semibold text-slate-800">Needs attention</div>
        <p className="text-sm text-slate-600 mt-1">
          Nothing flagged for {year}. Looks good!
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4 border-l-4 border-amber-500">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-slate-800">Needs attention</div>
        <span className="badge bg-amber-100 text-amber-800">{issues.length}</span>
      </div>
      <ul className="divide-y text-sm">
        {issues.slice(0, 12).map((iss) => (
          <li key={iss.key} className="py-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <SeverityDot severity={iss.severity} />
                <div className="font-medium text-slate-800 truncate">{iss.title}</div>
              </div>
              <div className="text-xs text-slate-500 mt-0.5 truncate">{iss.detail}</div>
            </div>
            <Link to={iss.href} className="text-xs text-brand-700 hover:underline shrink-0">
              View
            </Link>
          </li>
        ))}
      </ul>
      {issues.length > 12 && (
        <div className="text-xs text-slate-500 mt-2">
          + {issues.length - 12} more not shown.
        </div>
      )}
    </div>
  );
}

function SeverityDot({ severity }: { severity: Issue["severity"] }) {
  const color =
    severity === "high" ? "bg-red-500" : severity === "medium" ? "bg-amber-500" : "bg-sky-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} aria-hidden />;
}

function daysAgo(d: Date) {
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
