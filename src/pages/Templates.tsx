import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type TransactionTemplate, type TransactionStatus, type TransactionType } from "../db/db";
import { addTemplate, deleteTemplate, duplicateTemplate, updateTemplate } from "../utils/templates";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/Confirm";

const STATUSES: TransactionStatus[] = ["pending", "approved", "paid", "reimbursed"];

interface DraftTemplate {
  id?: number;
  name: string;
  type: TransactionType;
  organizationId: number | "";
  categoryId: number | null;
  payee: string;
  description: string;
  reference: string;
  status: TransactionStatus;
  notes: string;
}

const EMPTY_DRAFT: DraftTemplate = {
  name: "",
  type: "expense",
  organizationId: "",
  categoryId: null,
  payee: "",
  description: "",
  reference: "",
  status: "paid",
  notes: "",
};

function fromTemplate(t: TransactionTemplate): DraftTemplate {
  return {
    id: t.id,
    name: t.name,
    type: t.type,
    organizationId: t.organizationId,
    categoryId: t.categoryId,
    payee: t.payee ?? "",
    description: t.description ?? "",
    reference: t.reference ?? "",
    status: t.status,
    notes: t.notes ?? "",
  };
}

export default function Templates() {
  const toast = useToast();
  const confirm = useConfirm();
  const templates = useLiveQuery(() => db.templates.orderBy("order").toArray(), []);
  const orgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const cats = useLiveQuery(() => db.categories.toArray(), []);

  const [draft, setDraft] = useState<DraftTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  const startNew = () => setDraft({ ...EMPTY_DRAFT });
  const startEdit = (t: TransactionTemplate) => setDraft(fromTemplate(t));
  const cancel = () => setDraft(null);

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Give the template a name.");
      return;
    }
    if (!draft.organizationId) {
      toast.error("Pick an organization.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: draft.name.trim(),
        type: draft.type,
        organizationId: Number(draft.organizationId),
        categoryId: draft.categoryId,
        payee: draft.payee.trim() || undefined,
        description: draft.description.trim() || undefined,
        reference: draft.reference.trim() || undefined,
        status: draft.status,
        notes: draft.notes.trim() || undefined,
      };
      if (draft.id) {
        await updateTemplate(draft.id, payload);
        toast.success("Template updated.");
      } else {
        await addTemplate(payload);
        toast.success("Template added.");
      }
      setDraft(null);
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: TransactionTemplate) => {
    const ok = await confirm({
      title: "Delete template?",
      message: `Permanently delete '${t.name}'?`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!ok || !t.id) return;
    try {
      await deleteTemplate(t.id, t.name);
      toast.success("Template deleted.");
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  const duplicate = async (t: TransactionTemplate) => {
    if (!t.id) return;
    try {
      await duplicateTemplate(t.id);
      toast.success("Template duplicated.");
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  const orgName = (id: number) => orgs?.find((o) => o.id === id)?.name ?? "—";
  const catName = (id: number | null) =>
    id == null ? "—" : (cats?.find((c) => c.id === id)?.name ?? "—");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Templates</h1>
          <p className="text-sm text-slate-500">
            Save common transactions for one-tap re-entry. Date and amount are entered each time.
          </p>
        </div>
        {!draft && (
          <button className="btn-primary" onClick={startNew}>
            + New template
          </button>
        )}
      </div>

      {draft && (
        <div className="card p-4 space-y-4">
          <h3 className="font-semibold text-slate-800">
            {draft.id ? "Edit template" : "New template"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="t-name">Name</label>
              <input
                id="t-name"
                className="input"
                maxLength={80}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. RS Sunday meal"
              />
            </div>
            <div>
              <label className="label" htmlFor="t-type">Type</label>
              <select
                id="t-type"
                className="input"
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as TransactionType })}
              >
                <option value="expense">Expense</option>
                <option value="income">Income (allotment / transfer)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="t-status">Default status</label>
              <select
                id="t-status"
                className="input"
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as TransactionStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="t-org">Organization</label>
              <select
                id="t-org"
                className="input"
                value={draft.organizationId}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    organizationId: e.target.value ? Number(e.target.value) : "",
                  })
                }
              >
                <option value="" disabled>
                  Select organization…
                </option>
                {orgs?.filter((o) => o.active).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="t-cat">Category</label>
              <select
                id="t-cat"
                className="input"
                value={draft.categoryId ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    categoryId: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">— None —</option>
                {cats
                  ?.filter(
                    (c) =>
                      c.active &&
                      (c.organizationId === null ||
                        c.organizationId === Number(draft.organizationId)),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="t-payee">
                {draft.type === "expense" ? "Payee" : "Source"}
              </label>
              <input
                id="t-payee"
                className="input"
                maxLength={120}
                value={draft.payee}
                onChange={(e) => setDraft({ ...draft, payee: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="t-ref">Reference</label>
              <input
                id="t-ref"
                className="input"
                maxLength={80}
                value={draft.reference}
                onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="t-desc">Description / Purpose</label>
              <input
                id="t-desc"
                className="input"
                maxLength={500}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="t-notes">Notes</label>
              <textarea
                id="t-notes"
                className="input min-h-[80px]"
                maxLength={2000}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" className="btn-secondary" onClick={cancel}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={busy}>
              {busy ? "Saving…" : draft.id ? "Save changes" : "Add template"}
            </button>
          </div>
        </div>
      )}

      <div className="card p-4">
        {!templates ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="text-sm text-slate-500 py-6 text-center">
            No templates yet. Click <strong>+ New template</strong> to create one,
            or use <em>Save as template</em> from the Add Transaction form.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Org</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Payee/Source</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 font-medium">{t.name}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`badge ${
                          t.type === "expense"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-green-50 text-green-700 border-green-200"
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{orgName(t.organizationId)}</td>
                    <td className="py-2 pr-3">{catName(t.categoryId)}</td>
                    <td className="py-2 pr-3">{t.payee ?? "—"}</td>
                    <td className="py-2 pr-3">{t.status}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      <button
                        className="text-brand-700 underline text-sm mr-3"
                        onClick={() => startEdit(t)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-slate-700 underline text-sm mr-3"
                        onClick={() => duplicate(t)}
                      >
                        Duplicate
                      </button>
                      <button
                        className="text-red-700 underline text-sm"
                        onClick={() => remove(t)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
