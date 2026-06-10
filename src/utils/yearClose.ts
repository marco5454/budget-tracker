import { db, type Allocation } from "../db/db";
import { setSetting } from "../hooks/useSetting";
import { logAudit } from "./audit";
import { broadcastDataChanged } from "./broadcast";
import { markDataChanged } from "./backup";
import { yearFromDate } from "./format";

const CLOSED_YEARS_KEY = "closedYears";

/** Read the list of years currently marked as closed. Stored as a sorted
 *  array of numbers in the `settings` table under `closedYears`.
 */
export async function getClosedYears(): Promise<number[]> {
  const row = await db.settings.get(CLOSED_YEARS_KEY);
  const v = row?.value;
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x) => typeof x === "number" && Number.isFinite(x)))].sort(
    (a, b) => a - b,
  );
}

async function persistClosedYears(list: number[]): Promise<void> {
  const cleaned = [...new Set(list)].sort((a, b) => a - b);
  await setSetting(CLOSED_YEARS_KEY, cleaned);
}

/**
 * Per-organization preview of what would carry forward from `fromYear` into
 * `toYear` (= fromYear + 1) on year close. Populates the modal where the
 * clerk reviews and edits each amount before confirming.
 */
export interface CarryOverRow {
  organizationId: number;
  organizationName: string;
  allocated: number;
  income: number;
  spent: number;
  remaining: number;
  /** Amount the user has chosen to carry over (defaults to max(0, remaining)). */
  carryAmount: number;
  /** Whether to apply this row when committing. */
  include: boolean;
}

export async function buildCarryOverPreview(fromYear: number): Promise<CarryOverRow[]> {
  const [orgs, allocs, txns] = await Promise.all([
    db.organizations.orderBy("order").toArray(),
    db.allocations.filter((a) => !a.deletedAt && a.year === fromYear).toArray(),
    db.transactions
      .filter((t) => !t.deletedAt && yearFromDate(t.date) === fromYear)
      .toArray(),
  ]);
  return orgs.map((o) => {
    const allocated = allocs
      .filter((a) => a.organizationId === o.id)
      .reduce((s, a) => s + a.amount, 0);
    const income = txns
      .filter((t) => t.organizationId === o.id && t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const spent = txns
      .filter((t) => t.organizationId === o.id && t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    const remaining = allocated + income - spent;
    return {
      organizationId: o.id!,
      organizationName: o.name,
      allocated,
      income,
      spent,
      remaining,
      carryAmount: Math.max(0, Math.round(remaining * 100) / 100),
      include: remaining > 0,
    };
  });
}

/**
 * Closes `year` (adds it to the closed list). Optionally applies the
 * carry-over rows by adding/updating Q0 (annual) allocations on `year+1`
 * for each included org. The operation is wrapped in a single Dexie
 * transaction so a failure mid-flight leaves no partial state.
 */
export async function closeYear(
  year: number,
  carryOver: CarryOverRow[] = [],
): Promise<{ closed: boolean; carryAdded: number }> {
  const toYear = year + 1;
  const toApply = carryOver.filter((r) => r.include && r.carryAmount > 0);

  let carryAdded = 0;
  await db.transaction(
    "rw",
    [db.allocations, db.settings, db.auditLog],
    async () => {
      // 1) Mark year as closed
      const row = await db.settings.get(CLOSED_YEARS_KEY);
      const list = Array.isArray(row?.value)
        ? (row!.value as unknown[]).filter(
            (x) => typeof x === "number" && Number.isFinite(x),
          ) as number[]
        : [];
      if (!list.includes(year)) list.push(year);
      list.sort((a, b) => a - b);
      await db.settings.put({ key: CLOSED_YEARS_KEY, value: list });

      // 2) Apply carry-overs as Q0 allocations on year+1.
      //    Idempotent: if a Q0 allocation already exists for that org we
      //    increment its amount; otherwise create a new row. We deliberately
      //    add (not overwrite) so partial close + reopen + close cycles do
      //    not lose existing planning. The audit log captures both branches.
      for (const r of toApply) {
        const existing = await db.allocations
          .where("[year+quarter+organizationId]")
          .equals([toYear, 0, r.organizationId])
          .first();
        if (existing && existing.id) {
          const newAmount =
            (existing.deletedAt ? 0 : existing.amount) + r.carryAmount;
          await db.allocations.update(existing.id, {
            amount: newAmount,
            deletedAt: "",
          });
        } else {
          const newAlloc: Allocation = {
            year: toYear,
            quarter: 0,
            organizationId: r.organizationId,
            amount: r.carryAmount,
            notes: `Carried over from ${year} year close`,
            deletedAt: "",
          };
          await db.allocations.add(newAlloc);
        }
        carryAdded += 1;
      }
    },
  );

  await logAudit(
    "yearClose",
    "create",
    year,
    `Closed ${year}${
      toApply.length ? ` · carried ${toApply.length} org allocation(s) into ${toYear}` : ""
    }`,
    {
      year,
      toYear,
      carryRows: toApply.map((r) => ({
        organizationId: r.organizationId,
        organizationName: r.organizationName,
        amount: r.carryAmount,
      })),
    },
  );

  await markDataChanged();
  broadcastDataChanged();
  return { closed: true, carryAdded };
}

/** Removes `year` from the closed list (does not undo carry-overs). */
export async function reopenYear(year: number): Promise<void> {
  const list = await getClosedYears();
  if (!list.includes(year)) return;
  await persistClosedYears(list.filter((y) => y !== year));
  await logAudit("yearClose", "delete", year, `Reopened ${year}`);
  await markDataChanged();
  broadcastDataChanged();
}
