import { db } from "../db/db";

export interface BackupFile {
  appName: "Ward Budget Tracker";
  version: 1;
  exportedAt: string;
  data: {
    organizations: unknown[];
    categories: unknown[];
    transactions: unknown[];
    allocations: unknown[];
    settings: unknown[];
  };
}

export async function exportBackup(): Promise<BackupFile> {
  const [organizations, categories, transactions, allocations, settings] =
    await Promise.all([
      db.organizations.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.allocations.toArray(),
      db.settings.toArray(),
    ]);
  return {
    appName: "Ward Budget Tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { organizations, categories, transactions, allocations, settings },
  };
}

export async function downloadBackup(): Promise<void> {
  const backup = await exportBackup();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.download = `ward-budget-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  await db.settings.put({ key: "lastBackupAt", value: new Date().toISOString() });
}

export async function importBackup(file: File, mode: "replace" | "merge"): Promise<void> {
  const text = await file.text();
  const parsed = JSON.parse(text) as BackupFile;
  if (parsed.appName !== "Ward Budget Tracker") {
    throw new Error("This file is not a Ward Budget Tracker backup.");
  }
  if (parsed.version !== 1) {
    throw new Error(`Unsupported backup version: ${parsed.version}`);
  }
  const { organizations, categories, transactions, allocations, settings } =
    parsed.data;
  await db.transaction(
    "rw",
    [db.organizations, db.categories, db.transactions, db.allocations, db.settings],
    async () => {
      if (mode === "replace") {
        await Promise.all([
          db.organizations.clear(),
          db.categories.clear(),
          db.transactions.clear(),
          db.allocations.clear(),
          db.settings.clear(),
        ]);
      }
      if (Array.isArray(organizations)) await db.organizations.bulkPut(organizations as never);
      if (Array.isArray(categories)) await db.categories.bulkPut(categories as never);
      if (Array.isArray(transactions)) await db.transactions.bulkPut(transactions as never);
      if (Array.isArray(allocations)) await db.allocations.bulkPut(allocations as never);
      if (Array.isArray(settings)) await db.settings.bulkPut(settings as never);
    },
  );
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
