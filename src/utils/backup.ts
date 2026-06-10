import { db } from "../db/db";
import {
  decryptBackupPayload,
  encryptBackupPayload,
  isEncryptedBackup,
  sha256Hex,
  type EncryptedBackupEnvelope,
} from "./crypto";

/**
 * Plain (unencrypted) backup file format.
 *
 * `integrity.sha256` is computed over the canonical JSON of `data`
 * (JSON.stringify with no spacing). Import recomputes and compares to
 * detect tampering or corruption.
 */
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
    /**
     * Audit log entries. Optional for backwards-compatibility — older
     * backups exported before schema v2 don't include this field.
     */
    auditLog?: unknown[];
    /**
     * Transaction templates. Optional for backwards-compatibility — older
     * backups exported before schema v3 don't include this field.
     */
    templates?: unknown[];
  };
  integrity?: {
    algorithm: "SHA-256";
    /** hex digest of JSON.stringify(data). */
    sha256: string;
  };
}

function canonicalDataString(data: BackupFile["data"]): string {
  // Stable, no-pretty-print serialization. Property order is whatever Dexie
  // returned, which is consistent within a single export.
  return JSON.stringify(data);
}

export async function exportBackup(): Promise<BackupFile> {
  const [organizations, categories, transactions, allocations, settings, auditLog, templates] =
    await Promise.all([
      db.organizations.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.allocations.toArray(),
      db.settings.toArray(),
      db.auditLog.toArray(),
      db.templates.toArray(),
    ]);
  const data = {
    organizations,
    categories,
    transactions,
    allocations,
    settings,
    auditLog,
    templates,
  };
  const sha256 = await sha256Hex(canonicalDataString(data));
  return {
    appName: "Ward Budget Tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
    integrity: { algorithm: "SHA-256", sha256 },
  };
}

function timestampStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadBackup(): Promise<void> {
  const backup = await exportBackup();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  triggerDownload(blob, `ward-budget-backup-${timestampStamp()}.json`);
  await db.settings.put({
    key: "lastBackupAt",
    value: new Date().toISOString(),
  });
}

/**
 * Encrypted export. Output file uses the .wbtbak extension. The plaintext
 * inside the envelope is a full BackupFile (including its own integrity hash).
 */
export async function downloadEncryptedBackup(passphrase: string): Promise<void> {
  if (!passphrase || passphrase.length < 4) {
    throw new Error("Passphrase must be at least 4 characters.");
  }
  const backup = await exportBackup();
  const plaintext = JSON.stringify(backup);
  const envelope = await encryptBackupPayload(plaintext, passphrase);
  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: "application/octet-stream" });
  triggerDownload(blob, `ward-budget-backup-${timestampStamp()}.wbtbak`);
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

interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: ValidationIssue[];
  data?: BackupFile["data"];
  integrityChecked?: boolean;
  integrityOk?: boolean;
}

async function validateBackup(parsed: unknown): Promise<ValidationResult> {
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

  // Integrity check, if present. Older backups may not have one.
  let integrityChecked = false;
  let integrityOk: boolean | undefined;
  const integrity = obj.integrity as
    | { algorithm?: unknown; sha256?: unknown }
    | undefined;
  if (integrity && integrity.algorithm === "SHA-256" && typeof integrity.sha256 === "string") {
    integrityChecked = true;
    const computed = await sha256Hex(canonicalDataString(obj.data as BackupFile["data"]));
    integrityOk = computed === integrity.sha256;
    if (!integrityOk) {
      errors.push(
        "Backup integrity check failed: contents do not match the embedded SHA-256.",
      );
      return {
        ok: false,
        errors,
        warnings,
        integrityChecked,
        integrityOk,
      };
    }
  }

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
  // auditLog is optional. Drop rows missing required fields.
  const auditRaw = Array.isArray(d.auditLog) ? (d.auditLog as unknown[]) : [];
  const auditLog = auditRaw.filter((row, i) => {
    const r = row as Record<string, unknown>;
    if (
      typeof r?.at !== "string" ||
      typeof r?.actor !== "string" ||
      typeof r?.entity !== "string" ||
      typeof r?.action !== "string" ||
      typeof r?.summary !== "string"
    ) {
      warnings.push({ table: "auditLog", index: i, reason: "missing/invalid required fields" });
      return false;
    }
    return true;
  });
  // templates is optional.
  const templatesRaw = Array.isArray(d.templates) ? (d.templates as unknown[]) : [];
  const templates = templatesRaw.filter((row, i) => {
    const r = row as Record<string, unknown>;
    if (
      typeof r?.name !== "string" ||
      (r?.type !== "expense" && r?.type !== "income") ||
      typeof r?.organizationId !== "number" ||
      typeof r?.status !== "string"
    ) {
      warnings.push({ table: "templates", index: i, reason: "missing/invalid required fields" });
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
      auditLog,
      templates,
    },
    integrityChecked,
    integrityOk,
  };
}

export interface ImportResult {
  imported: {
    organizations: number;
    categories: number;
    transactions: number;
    allocations: number;
    settings: number;
    auditLog: number;
    templates: number;
  };
  warnings: ValidationIssue[];
  encrypted: boolean;
  integrityChecked: boolean;
  integrityOk?: boolean;
}

/**
 * Import a backup file. Auto-detects encrypted (.wbtbak) vs plain JSON.
 *
 * For encrypted files, supply `passphrase`. If the caller doesn't know
 * whether the file is encrypted yet, call `peekBackupFile(file)` first.
 */
export async function importBackup(
  file: File,
  mode: "replace" | "merge",
  passphrase?: string,
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

  let encrypted = false;
  if (isEncryptedBackup(parsed)) {
    encrypted = true;
    if (!passphrase) {
      throw new Error("Encrypted backup requires a passphrase.");
    }
    const { plaintextJson } = await decryptBackupPayload(
      parsed as EncryptedBackupEnvelope,
      passphrase,
    );
    try {
      parsed = JSON.parse(plaintextJson);
    } catch {
      throw new Error("Decrypted contents are not valid JSON.");
    }
  }

  const v = await validateBackup(parsed);
  if (!v.ok || !v.data) {
    throw new Error(v.errors.join(" "));
  }
  const { organizations, categories, transactions, allocations, settings, auditLog, templates } =
    v.data;

  await db.transaction(
    "rw",
    [db.organizations, db.categories, db.transactions, db.allocations, db.settings, db.auditLog, db.templates],
    async () => {
      if (mode === "replace") {
        await Promise.all([
          db.organizations.clear(),
          db.categories.clear(),
          db.transactions.clear(),
          db.allocations.clear(),
          db.settings.clear(),
          db.auditLog.clear(),
          db.templates.clear(),
        ]);
      }
      if (organizations.length) await db.organizations.bulkPut(organizations as never);
      if (categories.length) await db.categories.bulkPut(categories as never);
      if (transactions.length) await db.transactions.bulkPut(transactions as never);
      if (allocations.length) await db.allocations.bulkPut(allocations as never);
      if (settings.length) await db.settings.bulkPut(settings as never);
      if (auditLog && auditLog.length) await db.auditLog.bulkPut(auditLog as never);
      if (templates && templates.length) await db.templates.bulkPut(templates as never);
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
      auditLog: auditLog?.length ?? 0,
      templates: templates?.length ?? 0,
    },
    warnings: v.warnings,
    encrypted,
    integrityChecked: !!v.integrityChecked,
    integrityOk: v.integrityOk,
  };
}

/** Quick peek to learn whether a chosen file is encrypted before prompting for a passphrase. */
export async function peekBackupFile(file: File): Promise<{
  encrypted: boolean;
  exportedAt?: string;
}> {
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("Backup file is unusually large (>50 MB). Refusing to read.");
  }
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON.");
  }
  if (isEncryptedBackup(parsed)) {
    return {
      encrypted: true,
      exportedAt: (parsed as EncryptedBackupEnvelope).exportedAt,
    };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj?.appName !== "Ward Budget Tracker") {
    throw new Error("File does not look like a Ward Budget Tracker backup.");
  }
  return {
    encrypted: false,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : undefined,
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
  triggerDownload(blob, filename);
}

/** Mark a data change so backup-reminder logic can react. */
export async function markDataChanged(): Promise<void> {
  await db.settings.put({ key: "lastDataChangeAt", value: new Date().toISOString() });
}
