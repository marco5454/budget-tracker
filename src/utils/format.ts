export function formatCurrency(
  amount: number,
  currency = "PHP",
  locale = "en-PH",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback to simple peso prefix
    return `₱${amount.toFixed(2)}`;
  }
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function quarterFromDate(dateIso: string): 1 | 2 | 3 | 4 {
  const m = new Date(dateIso).getMonth(); // 0-11
  return (Math.floor(m / 3) + 1) as 1 | 2 | 3 | 4;
}

export function yearFromDate(dateIso: string): number {
  return new Date(dateIso).getFullYear();
}

export function monthIndexFromDate(dateIso: string): number {
  return new Date(dateIso).getMonth();
}

export function quarterMonths(q: 1 | 2 | 3 | 4): number[] {
  const start = (q - 1) * 3;
  return [start, start + 1, start + 2];
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
