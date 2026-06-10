import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  type Transaction,
  type TransactionStatus,
  type TransactionType,
} from "../db/db";
import {
  MAX_AMOUNT,
  isReasonableDate,
  nowIso,
  todayIso,
} from "../utils/format";
import { markDataChanged } from "../utils/backup";
import { useToast } from "./Toast";

interface Props {
  initial?: Transaction;
  onSaved: () => void;
  onCancel: () => void;
  /** Reports back when the form has unsaved edits, so parent Modal can warn on close. */
  onDirtyChange?: (dirty: boolean) => void;
}

const STATUSES: TransactionStatus[] = ["pending", "approved", "paid", "reimbursed"];
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_DESCRIPTION_LEN = 500;
const MAX_NOTES_LEN = 2000;
const ALLOWED_RECEIPT_TYPES = /^(image\/(png|jpe?g|gif|webp|heic)|application\/pdf)$/i;

export default function TransactionForm({
  initial,
  onSaved,
  onCancel,
  onDirtyChange,
}: Props) {
  const allOrgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const cats = useLiveQuery(() => db.categories.toArray(), []);
  const toast = useToast();

  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [amount, setAmount] = useState<string>(
    initial ? String(initial.amount) : "",
  );
  const [organizationId, setOrganizationId] = useState<number | "">(
    initial?.organizationId ?? "",
  );
  const [categoryId, setCategoryId] = useState<number | null>(
    initial?.categoryId ?? null,
  );
  const [payee, setPayee] = useState(initial?.payee ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [status, setStatus] = useState<TransactionStatus>(initial?.status ?? "paid");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | undefined>(
    initial?.receiptDataUrl,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  const markDirty = () => {
    if (!dirty) {
      setDirty(true);
      onDirtyChange?.(true);
    }
  };

  useEffect(() => {
    if (organizationId === "" && allOrgs && allOrgs.length > 0) {
      const firstActive = allOrgs.find((o) => o.active) ?? allOrgs[0];
      if (firstActive.id) setOrganizationId(firstActive.id);
    }
  }, [allOrgs, organizationId]);

  const onFile = (file: File | null) => {
    markDirty();
    if (!file) {
      setReceiptDataUrl(undefined);
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      toast.error(`Receipt is too large (max ${MAX_RECEIPT_BYTES / 1024 / 1024} MB).`);
      return;
    }
    if (!ALLOWED_RECEIPT_TYPES.test(file.type)) {
      toast.error("Only image (PNG/JPG/GIF/WebP) or PDF receipts are allowed.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setReceiptDataUrl(reader.result as string);
    reader.onerror = () => toast.error("Failed to read the receipt file.");
    reader.readAsDataURL(file);
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!date || !isReasonableDate(date)) {
      e.date = "Please enter a valid date (year between 2000 and a few years ahead).";
    }
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      e.amount = "Amount must be greater than zero.";
    } else if (amt > MAX_AMOUNT) {
      e.amount = `Amount looks too large (max ${MAX_AMOUNT.toLocaleString()}).`;
    }
    if (!organizationId) {
      e.organizationId = "Please select an organization.";
    }
    if (description.length > MAX_DESCRIPTION_LEN) {
      e.description = `Description is too long (max ${MAX_DESCRIPTION_LEN} chars).`;
    }
    if (notes.length > MAX_NOTES_LEN) {
      e.notes = `Notes are too long (max ${MAX_NOTES_LEN} chars).`;
    }
    return e;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) {
      toast.error("Please fix the errors highlighted in the form.");
      return;
    }
    setSubmitting(true);
    try {
      const now = nowIso();
      const record: Transaction = {
        ...(initial ?? {}),
        date,
        type,
        amount: parseFloat(amount),
        organizationId: Number(organizationId),
        categoryId: categoryId === null || categoryId === undefined ? null : Number(categoryId),
        payee: payee.trim() || undefined,
        description: description.trim() || undefined,
        reference: reference.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
        receiptDataUrl,
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
      };
      if (initial?.id) {
        await db.transactions.update(initial.id, record);
        toast.success("Transaction updated.");
      } else {
        await db.transactions.add(record);
        toast.success("Transaction added.");
      }
      await markDataChanged();
      setDirty(false);
      onDirtyChange?.(false);
      onSaved();
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message ?? "unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldErr = (k: string) =>
    errors[k] ? (
      <div className="text-xs text-red-600 mt-1">{errors[k]}</div>
    ) : null;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="tx-date">Date</label>
          <input
            id="tx-date"
            type="date"
            className="input"
            value={date}
            onChange={(e) => {
              markDirty();
              setDate(e.target.value);
            }}
            required
          />
          {fieldErr("date")}
        </div>
        <div>
          <label className="label" htmlFor="tx-type">Type</label>
          <select
            id="tx-type"
            className="input"
            value={type}
            onChange={(e) => {
              markDirty();
              setType(e.target.value as TransactionType);
            }}
          >
            <option value="expense">Expense</option>
            <option value="income">Income (allotment / transfer)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tx-amount">Amount</label>
          <input
            id="tx-amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            className="input"
            value={amount}
            onChange={(e) => {
              markDirty();
              setAmount(e.target.value);
            }}
            required
          />
          {fieldErr("amount")}
        </div>
        <div>
          <label className="label" htmlFor="tx-status">Status</label>
          <select
            id="tx-status"
            className="input"
            value={status}
            onChange={(e) => {
              markDirty();
              setStatus(e.target.value as TransactionStatus);
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tx-org">Organization</label>
          <select
            id="tx-org"
            className="input"
            value={organizationId}
            onChange={(e) => {
              markDirty();
              setOrganizationId(e.target.value ? Number(e.target.value) : "");
            }}
            required
          >
            <option value="" disabled>
              Select organization…
            </option>
            {allOrgs
              ?.filter((o) => o.active || o.id === initial?.organizationId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
          {fieldErr("organizationId")}
        </div>
        <div>
          <label className="label" htmlFor="tx-cat">Category</label>
          <select
            id="tx-cat"
            className="input"
            value={categoryId ?? ""}
            onChange={(e) => {
              markDirty();
              setCategoryId(e.target.value ? Number(e.target.value) : null);
            }}
          >
            <option value="">— None —</option>
            {cats
              ?.filter(
                (c) =>
                  c.active &&
                  (c.organizationId === null ||
                    c.organizationId === Number(organizationId)),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tx-payee">
            {type === "expense" ? "Payee" : "Source"}
          </label>
          <input
            id="tx-payee"
            className="input"
            value={payee}
            onChange={(e) => {
              markDirty();
              setPayee(e.target.value);
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="tx-ref">
            Reference # (check, MLS, receipt)
          </label>
          <input
            id="tx-ref"
            className="input"
            value={reference}
            onChange={(e) => {
              markDirty();
              setReference(e.target.value);
            }}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="tx-desc">Description / Purpose</label>
        <input
          id="tx-desc"
          className="input"
          maxLength={MAX_DESCRIPTION_LEN}
          value={description}
          onChange={(e) => {
            markDirty();
            setDescription(e.target.value);
          }}
        />
        {fieldErr("description")}
      </div>
      <div>
        <label className="label" htmlFor="tx-notes">Notes</label>
        <textarea
          id="tx-notes"
          className="input min-h-[80px]"
          maxLength={MAX_NOTES_LEN}
          value={notes}
          onChange={(e) => {
            markDirty();
            setNotes(e.target.value);
          }}
        />
        {fieldErr("notes")}
      </div>
      <div>
        <label className="label" htmlFor="tx-receipt">
          Receipt (optional, max 2 MB, image/PDF)
        </label>
        <input
          id="tx-receipt"
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        {receiptDataUrl && (
          <div className="mt-2 flex items-center gap-2">
            <a
              href={receiptDataUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 text-sm underline"
            >
              View attached receipt
            </a>
            <button
              type="button"
              className="text-xs text-red-600 underline"
              onClick={() => {
                markDirty();
                setReceiptDataUrl(undefined);
              }}
            >
              Remove
            </button>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting
            ? "Saving…"
            : initial
              ? "Save changes"
              : "Add transaction"}
        </button>
      </div>
    </form>
  );
}
