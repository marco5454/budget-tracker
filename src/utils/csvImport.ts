import { db, type Transaction, type TransactionStatus, type TransactionType } from "../db/db";
import { isReasonableDate, MAX_AMOUNT, nowIso, yearFromDate } from "./format";
import { logAudit } from "./audit";
import { broadcastDataChanged } from "./broadcast";
import { markDataChanged } from "./backup";
import { getClosedYears } from "./yearClose";

export const CSV_HEADERS = [
  "date",
  "type",
  "amount",
  "organization",
  "category",
  "payee",
  "description",
  "reference",
  "status",
  "notes",
] as const;

export type CsvHeader = (typeof CSV_HEADERS)[number];

export interface CsvRowError {
  row: number; // 1-indexed (row 1 = header)
  field?: CsvHeader;
  message: string;
}

export interface CsvPreviewRow {
  /** 1-indexed CSV row (data row, excluding header) */
  rowNumber: number;
  raw: Record<CsvHeader, string>;
  /** Parsed transaction (without id, createdAt, updatedAt). null if row failed validation. */
  parsed: Omit<Transaction, "id" | "createdAt" | "updatedAt"> | null;
  errors: CsvRowError[];
}

export interface CsvParseResult {
  /** Header errors (e.g. missing required column). If non-empty, rows array is empty. */
  headerErrors: CsvRowError[];
  rows: CsvPreviewRow[];
  validCount: number;
  invalidCount: number;
}

const VALID_TYPES: TransactionType[] = ["expense", "income"];
const VALID_STATUSES: TransactionStatus[] = ["pending", "approved", "paid", "reimbursed"];

/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields, escaped double quotes,
 * commas and newlines inside quoted fields, and CRLF line endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        // Push cell + row, but only push row if not blank
        row.push(cell);
        cell = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
        // Skip "\n" right after "\r"
        if (ch === "\r" && text[i + 1] === "\n") i++;
      } else {
        cell += ch;
      }
    }
  }
  // Final cell/row
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

interface LookupMaps {
  orgsByLowerName: Map<string, number>;
  catsByLowerName: Map<string, number>;
  catsByOrgIdAndLowerName: Map<string, number>; // key = `${orgId}|${lowerName}`
}

async function buildLookups(): Promise<LookupMaps> {
  const [orgs, cats] = await Promise.all([
    db.organizations.toArray(),
    db.categories.toArray(),
  ]);
  const orgsByLowerName = new Map<string, number>();
  for (const o of orgs) {
    if (o.id != null) orgsByLowerName.set(o.name.trim().toLowerCase(), o.id);
  }
  const catsByLowerName = new Map<string, number>();
  const catsByOrgIdAndLowerName = new Map<string, number>();
  for (const c of cats) {
    if (c.id == null) continue;
    if (c.organizationId == null) {
      catsByLowerName.set(c.name.trim().toLowerCase(), c.id);
    } else {
      catsByOrgIdAndLowerName.set(
        `${c.organizationId}|${c.name.trim().toLowerCase()}`,
        c.id,
      );
    }
  }
  return { orgsByLowerName, catsByLowerName, catsByOrgIdAndLowerName };
}

export async function validateCsvText(text: string): Promise<CsvParseResult> {
  const grid = parseCsv(text);
  const headerErrors: CsvRowError[] = [];
  if (grid.length === 0) {
    headerErrors.push({ row: 1, message: "File is empty." });
    return { headerErrors, rows: [], validCount: 0, invalidCount: 0 };
  }
  const headerCells = grid[0].map((h) => h.trim().toLowerCase());
  const REQUIRED: CsvHeader[] = ["date", "type", "amount", "organization"];
  const missing = REQUIRED.filter((h) => !headerCells.includes(h));
  if (missing.length) {
    headerErrors.push({
      row: 1,
      message: `Missing required column(s): ${missing.join(", ")}. Required headers: ${REQUIRED.join(", ")}. Optional: category, payee, description, reference, status, notes.`,
    });
    return { headerErrors, rows: [], validCount: 0, invalidCount: 0 };
  }

  const colIndex: Record<string, number> = {};
  for (const h of CSV_HEADERS) {
    colIndex[h] = headerCells.indexOf(h);
  }

  const lookups = await buildLookups();
  const closedYears = await getClosedYears();
  const rows: CsvPreviewRow[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i];
    if (cells.every((c) => c.trim() === "")) continue;
    const get = (h: CsvHeader): string => {
      const idx = colIndex[h];
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };
    const raw: Record<CsvHeader, string> = {
      date: get("date"),
      type: get("type"),
      amount: get("amount"),
      organization: get("organization"),
      category: get("category"),
      payee: get("payee"),
      description: get("description"),
      reference: get("reference"),
      status: get("status"),
      notes: get("notes"),
    };
    const errs: CsvRowError[] = [];
    const rowNumber = i + 1; // human-friendly (header is row 1)

    // date
    if (!raw.date || !isReasonableDate(raw.date)) {
      errs.push({
        row: rowNumber,
        field: "date",
        message: "Invalid or missing date (expected YYYY-MM-DD).",
      });
    } else if (closedYears.includes(yearFromDate(raw.date))) {
      errs.push({
        row: rowNumber,
        field: "date",
        message: `Year ${yearFromDate(raw.date)} is closed. Reopen it in Settings to import.`,
      });
    }

    // type
    const typeLower = raw.type.toLowerCase() as TransactionType;
    if (!VALID_TYPES.includes(typeLower)) {
      errs.push({
        row: rowNumber,
        field: "type",
        message: "Type must be 'expense' or 'income'.",
      });
    }

    // amount
    const amt = parseFloat(raw.amount.replace(/,/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) {
      errs.push({
        row: rowNumber,
        field: "amount",
        message: "Amount must be a positive number.",
      });
    } else if (amt > MAX_AMOUNT) {
      errs.push({
        row: rowNumber,
        field: "amount",
        message: `Amount exceeds the maximum (${MAX_AMOUNT.toLocaleString()}).`,
      });
    }

    // organization
    let orgId: number | undefined;
    if (!raw.organization) {
      errs.push({
        row: rowNumber,
        field: "organization",
        message: "Organization is required.",
      });
    } else {
      orgId = lookups.orgsByLowerName.get(raw.organization.toLowerCase());
      if (orgId == null) {
        errs.push({
          row: rowNumber,
          field: "organization",
          message: `Unknown organization '${raw.organization}'. Add it in Settings first or correct the spelling.`,
        });
      }
    }

    // category (optional)
    let catId: number | null = null;
    if (raw.category) {
      const lower = raw.category.toLowerCase();
      if (orgId != null) {
        catId = lookups.catsByOrgIdAndLowerName.get(`${orgId}|${lower}`) ?? null;
      }
      if (catId == null) {
        catId = lookups.catsByLowerName.get(lower) ?? null;
      }
      if (catId == null) {
        errs.push({
          row: rowNumber,
          field: "category",
          message: `Unknown category '${raw.category}'. Leave blank or add it in Settings.`,
        });
      }
    }

    // status (optional, default 'paid')
    let status: TransactionStatus = "paid";
    if (raw.status) {
      const lower = raw.status.toLowerCase();
      if (!VALID_STATUSES.includes(lower as TransactionStatus)) {
        errs.push({
          row: rowNumber,
          field: "status",
          message: `Status must be one of: ${VALID_STATUSES.join(", ")}.`,
        });
      } else {
        status = lower as TransactionStatus;
      }
    }

    if (raw.description.length > 500) {
      errs.push({
        row: rowNumber,
        field: "description",
        message: "Description longer than 500 characters.",
      });
    }
    if (raw.notes.length > 2000) {
      errs.push({ row: rowNumber, field: "notes", message: "Notes longer than 2000 characters." });
    }

    let parsed: CsvPreviewRow["parsed"] = null;
    if (errs.length === 0 && orgId != null) {
      parsed = {
        date: raw.date,
        type: typeLower,
        amount: amt,
        organizationId: orgId,
        categoryId: catId,
        payee: raw.payee || undefined,
        description: raw.description || undefined,
        reference: raw.reference || undefined,
        status,
        notes: raw.notes || undefined,
        deletedAt: "",
      };
      validCount++;
    } else {
      invalidCount++;
    }

    rows.push({ rowNumber, raw, parsed, errors: errs });
  }

  return { headerErrors, rows, validCount, invalidCount };
}

/**
 * Imports the valid rows into the transactions table. Skips invalid rows.
 * Returns the number of transactions inserted.
 */
export async function commitCsvImport(result: CsvParseResult): Promise<number> {
  const valid = result.rows.filter((r) => r.parsed != null);
  if (valid.length === 0) return 0;
  const now = nowIso();
  const records: Transaction[] = valid.map((r) => ({
    ...(r.parsed as Omit<Transaction, "id" | "createdAt" | "updatedAt">),
    createdAt: now,
    updatedAt: now,
  }));
  await db.transactions.bulkAdd(records);
  await logAudit(
    "transaction",
    "create",
    "csv-import",
    `CSV import: added ${records.length} transaction(s)`,
  );
  await markDataChanged();
  broadcastDataChanged();
  return records.length;
}

export const CSV_TEMPLATE_HEADER = CSV_HEADERS.join(",") + "\r\n";
export const CSV_TEMPLATE_EXAMPLE =
  CSV_TEMPLATE_HEADER +
  [
    "2026-01-08",
    "expense",
    "250.00",
    "Relief Society",
    "Activities",
    "Sis. Cruz",
    "RS Sunday meal",
    "RCPT-001",
    "paid",
    "",
  ].join(",") +
  "\r\n";
