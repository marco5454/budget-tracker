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
import { logAudit } from "../utils/audit";
import { broadcastDataChanged } from "../utils/broadcast";
import { addTemplate } from "../utils/templates";
import { useClosedYears } from "../hooks/useClosedYears";
import {
  getCategorySpentYTD,
  getLimitFor,
} from "../utils/categoryLimits";
import { yearFromDate, formatCurrency } from "../utils/format";
import { useToast } from "./Toast";
import { useConfirm } from "./Confirm";
import { useSetting } from "../hooks/useSetting";

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
  const templates = useLiveQuery(() => db.templates.orderBy("order").toArray(), []);
  const closedYears = useClosedYears();
  const currency = useSetting<string>("currency", "PHP");
  const toast = useToast();
  const confirm = useConfirm();

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

  const applyTemplate = (id: number) => {
    const t = templates?.find((x) => x.id === id);
    if (!t) return;
    markDirty();
    setType(t.type);
    setOrganizationId(t.organizationId);
    setCategoryId(t.categoryId);
    setPayee(t.payee ?? "");
    setDescription(t.description ?? "");
    setReference(t.reference ?? "");
    setStatus(t.status);
    setNotes(t.notes ?? "");
    toast.info(`Template '${t.name}' applied. Enter date and amount.`);
  };

  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const saveAsTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      toast.error("Give the template a short name.");
      return;
    }
    if (!organizationId) {
      toast.error("Pick an organization before saving as template.");
      return;
    }
    setSavingTemplate(true);
    try {
      await addTemplate({
        name,
        type,
        organizationId: Number(organizationId),
        categoryId: categoryId === null || categoryId === undefined ? null : Number(categoryId),
        payee: payee.trim() || undefined,
        description: description.trim() || undefined,
        reference: reference.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
      });
      toast.success(`Template '${name}' saved.`);
      setTemplateName("");
      setShowSaveTemplate(false);
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    } finally {
      setSavingTemplate(false);
    }
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

    // Closed year guard. Block edits/creates that would change a closed year.
    const targetYear = yearFromDate(date);
    if (closedYears.includes(targetYear)) {
      toast.error(
        `Year ${targetYear} is closed. Reopen it from Settings → Year Management to edit.`,
      );
      return;
    }
    // If editing across the year boundary, also block when the *original* year
    // is closed.
    if (initial && yearFromDate(initial.date) !== targetYear) {
      if (closedYears.includes(yearFromDate(initial.date))) {
        toast.error(
          `Original year ${yearFromDate(initial.date)} is closed and cannot be edited.`,
        );
        return;
      }
    }

    // Soft category-limit warning (expense only, category set, no override yet).
    const amt = parseFloat(amount);
    if (
      type === "expense" &&
      categoryId != null &&
      organizationId !== "" &&
      Number.isFinite(amt) &&
      amt > 0
    ) {
      try {
        const limit = await getLimitFor(targetYear, Number(organizationId), categoryId);
        if (limit) {
          const spent = await getCategorySpentYTD(
            targetYear,
            Number(organizationId),
            categoryId,
          );
          // Subtract the original amount when editing the same row to avoid
          // double-counting against itself.
          const baseline =
            initial && initial.type === "expense" && initial.categoryId === categoryId
              ? spent - initial.amount
              : spent;
          const projected = baseline + amt;
          if (projected > limit.amount) {
            const cat = cats?.find((c) => c.id === categoryId);
            const ok = await confirm({
              title: "Category limit exceeded",
              message: `${cat?.name ?? "This category"} would reach ${formatCurrency(projected, currency)} for ${targetYear}, over the configured limit of ${formatCurrency(limit.amount, currency)}. Save anyway?`,
              confirmLabel: "Save anyway",
              cancelLabel: "Review",
              tone: "default",
            });
            if (!ok) return;
          }
        }
      } catch {
        // Limit check failures should never block saving.
      }
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
        await logAudit(
          "transaction",
          "update",
          initial.id,
          `Updated transaction (${record.date}, ${record.type}, ${record.amount.toFixed(2)})`,
        );
        toast.success("Transaction updated.");
      } else {
        const newId = await db.transactions.add(record);
        await logAudit(
          "transaction",
          "create",
          newId,
          `Added transaction (${record.date}, ${record.type}, ${record.amount.toFixed(2)})`,
        );
        toast.success("Transaction added.");
      }
      await markDataChanged();
      broadcastDataChanged();
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
      {!initial && templates && templates.length > 0 && (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <label htmlFor="tx-template" className="text-xs font-medium text-slate-600">
            Use a template
          </label>
          <div className="flex gap-2 mt-1">
            <select
              id="tx-template"
              className="input flex-1"
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) applyTemplate(Number(v));
                e.target.value = "";
              }}
            >
              <option value="">— Apply a saved template… —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
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
      <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t">
        <div className="flex items-center gap-2 flex-wrap">
          {!showSaveTemplate ? (
            <button
              type="button"
              className="text-sm text-brand-700 underline"
              onClick={() => setShowSaveTemplate(true)}
            >
              Save as template
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                aria-label="Template name"
                placeholder="Template name (e.g. RS Sunday meal)"
                className="input h-9 text-sm"
                maxLength={80}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={savingTemplate}
                onClick={saveAsTemplate}
              >
                {savingTemplate ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="text-xs text-slate-500 underline"
                onClick={() => {
                  setShowSaveTemplate(false);
                  setTemplateName("");
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
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
      </div>
    </form>
  );
}
