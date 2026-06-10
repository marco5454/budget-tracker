import { db, type Allocation, type Transaction } from "../db/db";
import { logAudit } from "./audit";
import { markDataChanged } from "./backup";
import { broadcastDataChanged } from "./broadcast";

const TRASH_RETENTION_DAYS = 30;

/** ISO string representing now. */
function nowIso(): string {
  return new Date().toISOString();
}

// ----- Transactions ------------------------------------------------------

export async function softDeleteTransaction(id: number, summary?: string): Promise<void> {
  const t = await db.transactions.get(id);
  if (!t) return;
  await db.transactions.update(id, { deletedAt: nowIso(), updatedAt: nowIso() });
  await logAudit(
    "transaction",
    "delete",
    id,
    summary ?? `Moved transaction to Trash (${t.date}, ${t.amount.toFixed(2)})`,
    { date: t.date, amount: t.amount, type: t.type, organizationId: t.organizationId },
  );
  await markDataChanged();
  broadcastDataChanged();
}

export async function restoreTransaction(id: number): Promise<void> {
  const t = await db.transactions.get(id);
  if (!t) return;
  await db.transactions.update(id, { deletedAt: "", updatedAt: nowIso() });
  await logAudit(
    "transaction",
    "restore",
    id,
    `Restored transaction (${t.date}, ${t.amount.toFixed(2)})`,
  );
  await markDataChanged();
  broadcastDataChanged();
}

export async function permanentlyDeleteTransaction(id: number): Promise<void> {
  const t = await db.transactions.get(id);
  if (!t) return;
  await db.transactions.delete(id);
  await logAudit(
    "transaction",
    "purge",
    id,
    `Permanently deleted transaction (${t.date}, ${t.amount.toFixed(2)})`,
  );
  await markDataChanged();
  broadcastDataChanged();
}

// ----- Allocations -------------------------------------------------------

export async function softDeleteAllocation(id: number, summary?: string): Promise<void> {
  const a = await db.allocations.get(id);
  if (!a) return;
  await db.allocations.update(id, { deletedAt: nowIso() });
  await logAudit(
    "allocation",
    "delete",
    id,
    summary ?? `Moved allocation to Trash (${a.year} Q${a.quarter}, ${a.amount.toFixed(2)})`,
    { year: a.year, quarter: a.quarter, organizationId: a.organizationId, amount: a.amount },
  );
  await markDataChanged();
  broadcastDataChanged();
}

export async function restoreAllocation(id: number): Promise<void> {
  const a = await db.allocations.get(id);
  if (!a) return;
  await db.allocations.update(id, { deletedAt: "" });
  await logAudit("allocation", "restore", id, `Restored allocation (${a.year} Q${a.quarter})`);
  await markDataChanged();
  broadcastDataChanged();
}

export async function permanentlyDeleteAllocation(id: number): Promise<void> {
  const a = await db.allocations.get(id);
  if (!a) return;
  await db.allocations.delete(id);
  await logAudit("allocation", "purge", id, `Permanently deleted allocation (${a.year} Q${a.quarter})`);
  await markDataChanged();
  broadcastDataChanged();
}

// ----- Trash listing -----------------------------------------------------

export interface TrashedTransaction extends Transaction {
  id: number;
  deletedAt: string;
}
export interface TrashedAllocation extends Allocation {
  id: number;
  deletedAt: string;
}

export async function listTrashedTransactions(): Promise<TrashedTransaction[]> {
  const all = await db.transactions.toArray();
  return all.filter((t) => !!t.deletedAt) as TrashedTransaction[];
}

export async function listTrashedAllocations(): Promise<TrashedAllocation[]> {
  const all = await db.allocations.toArray();
  return all.filter((a) => !!a.deletedAt) as TrashedAllocation[];
}

// ----- Auto-purge --------------------------------------------------------

/** Permanently delete trashed items older than TRASH_RETENTION_DAYS. Returns counts. */
export async function autoPurgeOldTrash(): Promise<{ transactions: number; allocations: number }> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86400000).toISOString();
  let txCount = 0;
  let allocCount = 0;
  try {
    const oldTxns = (await db.transactions.toArray()).filter(
      (t) => !!t.deletedAt && t.deletedAt < cutoff,
    );
    for (const t of oldTxns) {
      if (t.id != null) {
        await db.transactions.delete(t.id);
        txCount++;
      }
    }
    const oldAllocs = (await db.allocations.toArray()).filter(
      (a) => !!a.deletedAt && a.deletedAt < cutoff,
    );
    for (const a of oldAllocs) {
      if (a.id != null) {
        await db.allocations.delete(a.id);
        allocCount++;
      }
    }
    if (txCount + allocCount > 0) {
      await logAudit(
        "transaction",
        "purge",
        "auto",
        `Auto-purged old Trash items (${txCount} transaction(s), ${allocCount} allocation(s))`,
      );
      await markDataChanged();
      broadcastDataChanged();
    }
  } catch (err) {
    console.warn("Auto-purge failed:", err);
  }
  return { transactions: txCount, allocations: allocCount };
}

/** Empty the Trash entirely. */
export async function emptyTrash(): Promise<{ transactions: number; allocations: number }> {
  const txns = await listTrashedTransactions();
  const allocs = await listTrashedAllocations();
  for (const t of txns) await db.transactions.delete(t.id);
  for (const a of allocs) await db.allocations.delete(a.id);
  await logAudit(
    "transaction",
    "purge",
    "manual",
    `Emptied Trash (${txns.length} transaction(s), ${allocs.length} allocation(s))`,
  );
  await markDataChanged();
  broadcastDataChanged();
  return { transactions: txns.length, allocations: allocs.length };
}

export const TRASH_RETENTION_DAYS_CONST = TRASH_RETENTION_DAYS;
