import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Transaction } from "../db/db";
import Modal from "./Modal";
import { useToast } from "./Toast";
import { useSetting } from "../hooks/useSetting";
import { setSetting } from "../hooks/useSetting";
import { logAudit } from "../utils/audit";
import { broadcastDataChanged } from "../utils/broadcast";
import { markDataChanged } from "../utils/backup";
import { isReasonableDate, MAX_AMOUNT, nowIso, todayIso } from "../utils/format";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SETTING_LAST_AMOUNT = "lastAllotmentAmount";
const SETTING_LAST_ORG = "lastAllotmentOrgId";
const SETTING_LAST_CAT = "lastAllotmentCategoryId";

/**
 * Quick-add modal for recording the quarterly stake allotment as an
 * income transaction. Pre-fills with the previously-used amount, org
 * and category to make repeat entries fast.
 */
export default function AllotmentQuickAdd({ open, onClose }: Props) {
  const toast = useToast();
  const orgs = useLiveQuery(() => db.organizations.orderBy("order").toArray(), []);
  const cats = useLiveQuery(() => db.categories.toArray(), []);

  const lastAmount = useSetting<number | null>(SETTING_LAST_AMOUNT, null);
  const lastOrg = useSetting<number | null>(SETTING_LAST_ORG, null);
  const lastCat = useSetting<number | null>(SETTING_LAST_CAT, null);

  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [orgId, setOrgId] = useState<number | "">("");
  const [catId, setCatId] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  // Apply remembered defaults when modal opens
  useEffect(() => {
    if (!open) return;
    setDate(todayIso());
    setAmount(lastAmount != null ? String(lastAmount) : "");
    if (lastOrg != null) setOrgId(lastOrg);
    if (lastCat != null) setCatId(lastCat);
    else {
      // Try to default to the "Quarterly Allotment" category (seeded)
      const allot = cats?.find(
        (c) => c.active && c.name.toLowerCase() === "quarterly allotment",
      );
      if (allot?.id) setCatId(allot.id);
    }
  }, [open, lastAmount, lastOrg, lastCat, cats]);

  // If org still empty after defaults loaded, pick the first active org with a
  // sensible name (Bishopric or Ward Activities) or the first active org.
  useEffect(() => {
    if (orgId !== "" || !orgs || orgs.length === 0) return;
    const preferred = orgs.find(
      (o) => o.active && /bishopric|ward activities/i.test(o.name),
    );
    const pick = preferred ?? orgs.find((o) => o.active) ?? orgs[0];
    if (pick?.id) setOrgId(pick.id);
  }, [orgs, orgId]);

  const submit = async () => {
    if (!isReasonableDate(date)) {
      toast.error("Pick a valid date.");
      return;
    }
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }
    if (amt > MAX_AMOUNT) {
      toast.error("Amount looks too large.");
      return;
    }
    if (!orgId) {
      toast.error("Pick an organization.");
      return;
    }
    setBusy(true);
    try {
      const now = nowIso();
      const record: Transaction = {
        date,
        type: "income",
        amount: amt,
        organizationId: Number(orgId),
        categoryId: catId,
        payee: "Stake / Headquarters",
        description: "Quarterly allotment",
        reference: reference.trim() || undefined,
        status: "paid",
        createdAt: now,
        updatedAt: now,
        deletedAt: "",
      };
      const id = await db.transactions.add(record);
      await logAudit(
        "transaction",
        "create",
        id,
        `Recorded quarterly allotment (${date}, ${amt.toFixed(2)})`,
      );
      // Remember defaults for next time
      await Promise.all([
        setSetting(SETTING_LAST_AMOUNT, amt),
        setSetting(SETTING_LAST_ORG, Number(orgId)),
        setSetting(SETTING_LAST_CAT, catId),
      ]);
      await markDataChanged();
      broadcastDataChanged();
      toast.success("Allotment recorded.");
      // Reset transient fields
      setReference("");
      onClose();
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Record quarterly allotment"
      onClose={onClose}
      widthClass="max-w-lg"
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Records a single income transaction for the quarterly stake
          allotment. The amount, organization and category from the last
          allotment are pre-filled.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="al-date">Date</label>
            <input
              id="al-date"
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="al-amount">Amount</label>
            <input
              id="al-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="al-org">Organization</label>
            <select
              id="al-org"
              className="input"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="" disabled>
                Select…
              </option>
              {orgs?.filter((o) => o.active).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="al-cat">Category</label>
            <select
              id="al-cat"
              className="input"
              value={catId ?? ""}
              onChange={(e) => setCatId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— None —</option>
              {cats
                ?.filter(
                  (c) =>
                    c.active &&
                    (c.organizationId === null || c.organizationId === Number(orgId)),
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="al-ref">Reference (optional)</label>
            <input
              id="al-ref"
              className="input"
              maxLength={80}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Stake check #, MLS ref, etc."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Record allotment"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
