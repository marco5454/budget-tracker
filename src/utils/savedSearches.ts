/**
 * Saved searches for the Transactions page.
 *
 * Stored in localStorage so they survive imports/exports and don't bloat
 * IndexedDB backups. They're purely UI state, not financial data.
 */

import type { TransactionStatus } from "../db/db";

export interface SavedSearchFilters {
  search?: string;
  year?: number | "";
  quarter?: "" | "1" | "2" | "3" | "4";
  type?: "" | "expense" | "income";
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  orgIds?: number[];
  categoryIds?: number[];
  statuses?: TransactionStatus[];
  hasReceipt?: "" | "yes" | "no";
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  createdAt: string;
}

const KEY = "wbt:savedSearches";

export function listSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s) =>
        s &&
        typeof s.id === "string" &&
        typeof s.name === "string" &&
        s.filters &&
        typeof s.filters === "object",
    );
  } catch {
    return [];
  }
}

function persist(list: SavedSearch[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage may be disabled — silently ignore */
  }
}

export function addSavedSearch(name: string, filters: SavedSearchFilters): SavedSearch {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required.");
  const id =
    (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
    `s${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const item: SavedSearch = {
    id,
    name: trimmed,
    filters,
    createdAt: new Date().toISOString(),
  };
  const list = listSavedSearches();
  // If a saved search with the same name exists, replace it.
  const filtered = list.filter((s) => s.name.toLowerCase() !== trimmed.toLowerCase());
  filtered.push(item);
  persist(filtered);
  return item;
}

export function deleteSavedSearch(id: string): void {
  persist(listSavedSearches().filter((s) => s.id !== id));
}
