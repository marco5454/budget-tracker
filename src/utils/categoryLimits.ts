import { db, type CategoryLimit } from "../db/db";
import { logAudit } from "./audit";
import { broadcastDataChanged } from "./broadcast";
import { markDataChanged } from "./backup";
import { nowIso, yearFromDate } from "./format";

export type NewCategoryLimitInput = Omit<
  CategoryLimit,
  "id" | "createdAt" | "updatedAt"
>;

export async function listCategoryLimits(year?: number): Promise<CategoryLimit[]> {
  if (typeof year === "number") {
    return db.categoryLimits.where("year").equals(year).toArray();
  }
  return db.categoryLimits.toArray();
}

/**
 * Insert or update the (year, organizationId, categoryId) limit. The
 * compound unique index makes this an upsert: if a row already exists,
 * its amount and notes are replaced.
 */
export async function upsertCategoryLimit(
  input: NewCategoryLimitInput,
): Promise<{ id: number; action: "create" | "update" }> {
  const now = nowIso();
  let id = -1;
  let action: "create" | "update" = "create";
  await db.transaction("rw", db.categoryLimits, async () => {
    const existing = await db.categoryLimits
      .where("[year+organizationId+categoryId]")
      .equals([input.year, input.organizationId, input.categoryId])
      .first();
    if (existing && existing.id) {
      await db.categoryLimits.update(existing.id, {
        amount: input.amount,
        notes: input.notes,
        updatedAt: now,
      });
      id = existing.id;
      action = "update";
    } else {
      id = await db.categoryLimits.add({
        ...input,
        createdAt: now,
        updatedAt: now,
      });
      action = "create";
    }
  });
  await logAudit(
    "categoryLimit",
    action,
    id,
    `${action === "create" ? "Set" : "Updated"} category limit (${input.year}) ${input.amount.toFixed(2)}`,
    {
      year: input.year,
      organizationId: input.organizationId,
      categoryId: input.categoryId,
      amount: input.amount,
    },
  );
  await markDataChanged();
  broadcastDataChanged();
  return { id, action };
}

export async function deleteCategoryLimit(id: number): Promise<void> {
  const before = await db.categoryLimits.get(id);
  await db.categoryLimits.delete(id);
  await logAudit(
    "categoryLimit",
    "delete",
    id,
    `Removed category limit (${before?.year ?? ""})`,
    before
      ? {
          year: before.year,
          organizationId: before.organizationId,
          categoryId: before.categoryId,
          amount: before.amount,
        }
      : undefined,
  );
  await markDataChanged();
  broadcastDataChanged();
}

/**
 * Returns total non-deleted expense for the given (year, org, category).
 * categoryId === null is allowed (Uncategorized).
 */
export async function getCategorySpentYTD(
  year: number,
  organizationId: number,
  categoryId: number | null,
): Promise<number> {
  const rows = await db.transactions
    .filter(
      (t) =>
        !t.deletedAt &&
        t.type === "expense" &&
        t.organizationId === organizationId &&
        (t.categoryId ?? null) === (categoryId ?? null) &&
        yearFromDate(t.date) === year,
    )
    .toArray();
  return rows.reduce((s, t) => s + t.amount, 0);
}

/**
 * Looks up the configured limit for the given combination.
 * Returns null when no limit is set or when categoryId is null.
 */
export async function getLimitFor(
  year: number,
  organizationId: number,
  categoryId: number | null,
): Promise<CategoryLimit | null> {
  if (categoryId == null) return null;
  const found = await db.categoryLimits
    .where("[year+organizationId+categoryId]")
    .equals([year, organizationId, categoryId])
    .first();
  return found ?? null;
}
