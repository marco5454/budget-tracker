/**
 * Small KPI tile used inside the Ward Budget Pool summary cards on
 * the Dashboard and Budget pages. Lives in its own component so the
 * two views stay visually identical.
 */
export default function PoolStat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger";
}) {
  const valueClass =
    tone === "danger" ? "text-red-600" : "text-slate-900";
  return (
    <div className="bg-slate-50 rounded p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`text-lg font-semibold ${valueClass}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}
