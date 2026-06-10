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
}

export interface Allocation {
  id?: number;
  year: number;
  /** 0 = annual roll-up; 1-4 = quarterly */
  quarter: 0 | Quarter;
  organizationId: number;
  amount: number;
  notes?: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

class WardBudgetDB extends Dexie {
  organizations!: Table<Organization, number>;
  categories!: Table<Category, number>;
  transactions!: Table<Transaction, number>;
  allocations!: Table<Allocation, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super("WardBudgetDB");
    this.version(1).stores({
      organizations: "++id, name, order, active",
      categories: "++id, name, organizationId, active",
      transactions:
        "++id, date, type, organizationId, categoryId, status, createdAt",
      allocations: "++id, [year+quarter+organizationId], year, quarter, organizationId",
      settings: "key",
    });
  }
}

export const db = new WardBudgetDB();
