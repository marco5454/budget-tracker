/**
 * Parse an ISO date string (YYYY-MM-DD) as a LOCAL date (no timezone shift).
 * Using `new Date("2025-06-10")` treats the string as UTC and can shift by a
 * day depending on user timezone. This helper avoids that.
 */
export function parseLocalDate(isoDate: string): Date {
  // Accept full ISO datetimes too, but we only care about the date portion.
  const [datePart] = isoDate.split("T");
  const [y, m, d] = datePart.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

export function formatCurrency(
  amount: number,
  currency = "PHP",
  locale = "en-PH",
): string {
  if (!Number.isFinite(amount)) amount = 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₱${amount.toFixed(2)}`;
  }
}

export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function quarterFromDate(dateIso: string): 1 | 2 | 3 | 4 {
  const m = parseLocalDate(dateIso).getMonth();
  return (Math.floor(m / 3) + 1) as 1 | 2 | 3 | 4;
}

export function yearFromDate(dateIso: string): number {
  return parseLocalDate(dateIso).getFullYear();
}

export function monthIndexFromDate(dateIso: string): number {
  return parseLocalDate(dateIso).getMonth();
}

export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Validate that an ISO date string is a sensible church-record date. */
export function isReasonableDate(isoDate: string): boolean {
  const d = parseLocalDate(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const currentYear = new Date().getFullYear();
  return y >= 2000 && y <= currentYear + 5;
}

/** Bound for transaction amount: prevents typos/overflow. */
export const MAX_AMOUNT = 100_000_000; // ₱100M cap, plenty for ward use
