import Dexie, { type Table } from "dexie";

export type TransactionType = "expense" | "income";
export type TransactionStatus = "pending" | "approved" | "paid" | "reimbursed";
export type Quarter = 1 | 2 | 3 | 4;

export interface Organization {
  id?: number;
  name: string;
  /** Sort order in lists */
  order: number;
  /** Whether this org is active and shown in pickers */
  active: boolean;
  /** Optional notes */
  notes?: string;
}

export interface Category {
  id?: number;
  name: string;
  /** If null, this category is global. If set, it's tied to a specific organization. */
  organizationId: number | null;
  active: boolean;
}

export interface Transaction {
  id?: number;
  date: string; // ISO date YYYY-MM-DD
  type: TransactionType;
  amount: number; // always positive; sign comes from type
  organizationId: number;
  categoryId: number | null;
  payee?: string; // payee for expense, source for income
  description?: string;
  reference?: string; // check #, MLS ref, receipt #
  status: TransactionStatus;
  notes?: string;
  /** Optional receipt stored as data URL (kept offline) */
  receiptDataUrl?: string;
  /** ISO timestamp of creation */
  createdAt: string;
  updatedAt: string;
  /** Soft-delete marker. ISO timestamp when item moved to Trash. Empty string when not deleted (Dexie can't index null). */
  deletedAt?: string;
}

export interface Allocation {
  id?: number;
  year: number;
  /** 0 = annual roll-up; 1-4 = quarterly */
  quarter: 0 | Quarter;
  organizationId: number;
  amount: number;
  notes?: string;
  /** Soft-delete marker. ISO timestamp when item moved to Trash. */
  deletedAt?: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

/**
 * Audit log entry. Captures every create / update / delete on the main tables
 * plus settings changes. Used to provide a recent-activity view and a forensic
 * trail for clerks. Auto-pruned after 365 days at startup.
 */
export type AuditEntity =
  | "transaction"
  | "allocation"
  | "organization"
  | "category"
  | "setting"
  | "template"
  | "categoryLimit"
  | "yearClose";

export type AuditAction = "create" | "update" | "delete" | "restore" | "purge";

export interface AuditLogEntry {
  id?: number;
  /** ISO timestamp */
  at: string;
  /** Who made the change (free-form, but seeded from a small list) */
  actor: string;
  entity: AuditEntity;
  action: AuditAction;
  /** id of the affected row (or settings key) */
  targetId: string | number;
  /** Short human label, e.g. "EQ activity 250.00" or "Updated: Relief Society allocation Q2" */
  summary: string;
  /** Optional structured detail (kept small) */
  details?: Record<string, unknown>;
}

/**
 * Saved transaction template. Stores most fields of a Transaction except
 * `date` and `amount` (which the user enters at apply time). Used to
 * speed up repetitive entries (e.g. "RS Sunday meal", "YM camp fee").
 */
export interface TransactionTemplate {
  id?: number;
  /** Short human label shown in the picker */
  name: string;
  type: TransactionType;
  organizationId: number;
  categoryId: number | null;
  payee?: string;
  description?: string;
  reference?: string;
  status: TransactionStatus;
  notes?: string;
  /** Sort order in the picker */
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Soft, per-(year, organization, category) spending limit. Limits are
 * advisory: when a transaction would exceed the cap a warning is shown,
 * the Attention widget surfaces over-limit categories, and Reports compare
 * usage vs limit. Year is included so limits can roll year-over-year.
 */
export interface CategoryLimit {
  id?: number;
  year: number;
  organizationId: number;
  categoryId: number;
  /** Maximum suggested spend for this combination during the year (positive). */
  amount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

class WardBudgetDB extends Dexie {
  organizations!: Table<Organization, number>;
  categories!: Table<Category, number>;
  transactions!: Table<Transaction, number>;
  allocations!: Table<Allocation, number>;
  settings!: Table<Setting, string>;
  auditLog!: Table<AuditLogEntry, number>;
  templates!: Table<TransactionTemplate, number>;
  categoryLimits!: Table<CategoryLimit, number>;

  constructor() {
    super("WardBudgetDB");
    // v1 — original schema. Kept so existing installs upgrade cleanly.
    this.version(1).stores({
      organizations: "++id, name, order, active",
      categories: "++id, name, organizationId, active",
      transactions:
        "++id, date, type, organizationId, categoryId, status, createdAt",
      allocations:
        "++id, [year+quarter+organizationId], year, quarter, organizationId",
      settings: "key",
    });
    // v2 — adds:
    //   - auditLog table (indexed by at + entity + action)
    //   - deletedAt index on transactions and allocations (soft-delete / Trash)
    // The upgrade function backfills deletedAt='' on existing rows so they show
    // up correctly in indexed queries that filter by deletedAt.
    this.version(2)
      .stores({
        organizations: "++id, name, order, active",
        categories: "++id, name, organizationId, active",
        transactions:
          "++id, date, type, organizationId, categoryId, status, createdAt, deletedAt",
        allocations:
          "++id, [year+quarter+organizationId], year, quarter, organizationId, deletedAt",
        settings: "key",
        auditLog: "++id, at, entity, action, [entity+action], actor",
      })
      .upgrade(async (tx) => {
        await tx
          .table("transactions")
          .toCollection()
          .modify((t: Transaction) => {
            if (t.deletedAt === undefined || t.deletedAt === null) {
              t.deletedAt = "";
            }
          });
        await tx
          .table("allocations")
          .toCollection()
          .modify((a: Allocation) => {
            if (a.deletedAt === undefined || a.deletedAt === null) {
              a.deletedAt = "";
            }
          });
      });
    // v3 — adds the templates table.
    this.version(3).stores({
      organizations: "++id, name, order, active",
      categories: "++id, name, organizationId, active",
      transactions:
        "++id, date, type, organizationId, categoryId, status, createdAt, deletedAt",
      allocations:
        "++id, [year+quarter+organizationId], year, quarter, organizationId, deletedAt",
      settings: "key",
      auditLog: "++id, at, entity, action, [entity+action], actor",
      templates: "++id, name, order, organizationId",
    });
    // v4 — adds the categoryLimits table. The `closedYears` setting is just
    // a JSON array of numbers in the existing settings table; no schema
    // change is needed for it.
    this.version(4).stores({
      organizations: "++id, name, order, active",
      categories: "++id, name, organizationId, active",
      transactions:
        "++id, date, type, organizationId, categoryId, status, createdAt, deletedAt",
      allocations:
        "++id, [year+quarter+organizationId], year, quarter, organizationId, deletedAt",
      settings: "key",
      auditLog: "++id, at, entity, action, [entity+action], actor",
      templates: "++id, name, order, organizationId",
      categoryLimits:
        "++id, [year+organizationId+categoryId], year, organizationId, categoryId",
    });
  }
}

export const db = new WardBudgetDB();

/** Current schema version that the app code targets. */
export const SCHEMA_VERSION = 4;
