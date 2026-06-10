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
  await db.settings.put({
    key: "lastBackupAt",
    value: new Date().toISOString(),
  });
}

interface ValidationIssue {
  table: string;
  index: number;
  reason: string;
}

function validateBackup(parsed: unknown): {
  ok: boolean;
  errors: string[];
  warnings: ValidationIssue[];
  data?: BackupFile["data"];
} {
  const errors: string[] = [];
  const warnings: ValidationIssue[] = [];

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, errors: ["File is not a JSON object."], warnings: [] };
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.appName !== "Ward Budget Tracker") {
    errors.push("File is not a Ward Budget Tracker backup (missing/invalid appName).");
  }
  if (obj.version !== 1) {
    errors.push(`Unsupported backup version: ${String(obj.version)}.`);
  }
  if (!obj.data || typeof obj.data !== "object") {
    errors.push("Backup is missing the 'data' section.");
    return { ok: false, errors, warnings };
  }
  const d = obj.data as Record<string, unknown>;
  for (const table of [
    "organizations",
    "categories",
    "transactions",
    "allocations",
    "settings",
  ] as const) {
    if (!Array.isArray(d[table])) {
      errors.push(`'${table}' must be an array.`);
    }
  }
  if (errors.length > 0) return { ok: false, errors, warnings };

  // Per-row sanity checks (drop bad rows but warn).
  const orgs = (d.organizations as unknown[]).filter((row, i) => {
    const r = row as Record<string, unknown>;
    if (typeof r?.name !== "string" || typeof r?.order !== "number" || typeof r?.active !== "boolean") {
      warnings.push({ table: "organizations", index: i, reason: "missing required fields" });
      return false;
    }
    return true;
  });
  const cats = (d.categories as unknown[]).filter((row, i) => {
    const r = row as Record<string, unknown>;
    if (typeof r?.name !== "string" || typeof r?.active !== "boolean") {
      warnings.push({ table: "categories", index: i, reason: "missing required fields" });
      return false;
    }
    return true;
  });
  const txns = (d.transactions as unknown[]).filter((row, i) => {
    const r = row as Record<string, unknown>;
    if (
      typeof r?.date !== "string" ||
      (r?.type !== "expense" && r?.type !== "income") ||
      typeof r?.amount !== "number" ||
      typeof r?.organizationId !== "number" ||
      typeof r?.status !== "string"
    ) {
      warnings.push({ table: "transactions", index: i, reason: "missing/invalid required fields" });
      return false;
    }
    return true;
  });
  const allocs = (d.allocations as unknown[]).filter((row, i) => {
    const r = row as Record<string, unknown>;
    if (
      typeof r?.year !== "number" ||
      typeof r?.quarter !== "number" ||
      typeof r?.organizationId !== "number" ||
      typeof r?.amount !== "number"
    ) {
      warnings.push({ table: "allocations", index: i, reason: "missing/invalid required fields" });
      return false;
    }
    return true;
  });
  const settings = (d.settings as unknown[]).filter((row, i) => {
    const r = row as Record<string, unknown>;
    if (typeof r?.key !== "string") {
      warnings.push({ table: "settings", index: i, reason: "missing key" });
      return false;
    }
    return true;
  });

  return {
    ok: true,
    errors,
    warnings,
    data: {
      organizations: orgs,
      categories: cats,
      transactions: txns,
      allocations: allocs,
      settings,
    },
  };
}

export interface ImportResult {
  imported: {
    organizations: number;
    categories: number;
    transactions: number;
    allocations: number;
    settings: number;
  };
  warnings: ValidationIssue[];
}

export async function importBackup(
  file: File,
  mode: "replace" | "merge",
): Promise<ImportResult> {
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("Backup file is unusually large (>50 MB). Refusing to import.");
  }
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON.");
  }
  const v = validateBackup(parsed);
  if (!v.ok || !v.data) {
    throw new Error(v.errors.join(" "));
  }
  const { organizations, categories, transactions, allocations, settings } =
    v.data;

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
      if (organizations.length) await db.organizations.bulkPut(organizations as never);
      if (categories.length) await db.categories.bulkPut(categories as never);
      if (transactions.length) await db.transactions.bulkPut(transactions as never);
      if (allocations.length) await db.allocations.bulkPut(allocations as never);
      if (settings.length) await db.settings.bulkPut(settings as never);
    },
  );
  await markDataChanged();
  return {
    imported: {
      organizations: organizations.length,
      categories: categories.length,
      transactions: transactions.length,
      allocations: allocations.length,
      settings: settings.length,
    },
    warnings: v.warnings,
  };
}

/** CSV injection hardening: prefix risky cells with a single quote. */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: unknown[][],
): void {
  // BOM helps Excel detect UTF-8.
  const bom = "\uFEFF";
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  const blob = new Blob([bom + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Mark a data change so backup-reminder logic can react. */
export async function markDataChanged(): Promise<void> {
  await db.settings.put({ key: "lastDataChangeAt", value: new Date().toISOString() });
}
