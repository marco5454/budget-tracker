import { db, type TransactionTemplate } from "../db/db";
import { logAudit } from "./audit";
import { broadcastDataChanged } from "./broadcast";
import { nowIso } from "./format";

export type NewTemplateInput = Omit<
  TransactionTemplate,
  "id" | "order" | "createdAt" | "updatedAt"
>;

export async function addTemplate(input: NewTemplateInput): Promise<number> {
  const now = nowIso();
  const max = await db.templates.toArray();
  const order = max.reduce((m, t) => Math.max(m, t.order), 0) + 1;
  const id = await db.templates.add({
    ...input,
    order,
    createdAt: now,
    updatedAt: now,
  });
  await logAudit("template", "create", id, `Added template '${input.name}'`);
  broadcastDataChanged();
  return id as number;
}

export async function updateTemplate(
  id: number,
  patch: Partial<NewTemplateInput>,
): Promise<void> {
  const now = nowIso();
  await db.templates.update(id, { ...patch, updatedAt: now });
  await logAudit("template", "update", id, `Updated template '${patch.name ?? id}'`);
  broadcastDataChanged();
}

export async function deleteTemplate(id: number, name?: string): Promise<void> {
  await db.templates.delete(id);
  await logAudit("template", "delete", id, `Deleted template '${name ?? id}'`);
  broadcastDataChanged();
}

export async function duplicateTemplate(id: number): Promise<number | undefined> {
  const t = await db.templates.get(id);
  if (!t) return undefined;
  // Strip auto-managed fields; addTemplate will assign fresh values.
  const { id: _id, createdAt: _ca, updatedAt: _ua, order: _ord, ...rest } = t;
  void _id; void _ca; void _ua; void _ord;
  return addTemplate({ ...rest, name: `${rest.name} (copy)` });
}
