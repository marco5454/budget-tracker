import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Transaction, type TransactionStatus, type TransactionType } from "../db/db";
import { nowIso, todayIso } from "../utils/format";

interface Props {
  initial?: Transaction;
  onSaved: () => void;
  onCancel: () => void;
}

const STATUSES: TransactionStatus[] = ["pending", "approved", "paid", "reimbursed"];

export default function TransactionForm({ initial, onSaved, onCancel }: Props) {
  const allOrgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const cats = useLiveQuery(() => db.categories.toArray(), []);

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId === "" && allOrgs && allOrgs.length > 0) {
      const firstActive = allOrgs.find((o) => o.active) ?? allOrgs[0];
      if (firstActive.id) setOrganizationId(firstActive.id);
    }
  }, [allOrgs, organizationId]);

  const onFile = (file: File | null) => {
    if (!file) {
      setReceiptDataUrl(undefined);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setReceiptDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (!organizationId) {
      setError("Please select an organization.");
      return;
    }
    const now = nowIso();
    const record: Transaction = {
      ...(initial ?? {}),
      date,
      type,
      amount: amt,
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
    } else {
      await db.transactions.add(record);
    }
    onSaved();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
            <option value="expense">Expense</option>
            <option value="income">Income (allotment / transfer)</option>
          </select>
        </div>
        <div>
          <label className="label">Amount (₱)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as TransactionStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Organization</label>
          <select
            className="input"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value ? Number(e.target.value) : "")}
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
        </div>
        <div>
          <label className="label">Category</label>
          <select
            className="input"
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
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
          <label className="label">{type === "expense" ? "Payee" : "Source"}</label>
          <input className="input" value={payee} onChange={(e) => setPayee(e.target.value)} />
        </div>
        <div>
          <label className="label">Reference # (check, MLS, receipt)</label>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Description / Purpose</label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea
          className="input min-h-[80px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Receipt (optional, stored locally)</label>
        <input
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
              onClick={() => setReceiptDataUrl(undefined)}
            >
              Remove
            </button>
          </div>
        )}
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          {initial ? "Save changes" : "Add transaction"}
        </button>
      </div>
    </form>
  );
}
