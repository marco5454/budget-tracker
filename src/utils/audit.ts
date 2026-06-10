import { db, type AuditAction, type AuditEntity, type AuditLogEntry } from "../db/db";

/**
 * Standard list of pre-defined actors. Settings page lets the user pick one;
 * "Other" lets them type a free-form name (saved as the actor for the session).
 */
export const STANDARD_ACTORS = [
  "Bishop",
  "Clerk",
  "Asst. Clerk",
  "Other",
] as const;

const ACTOR_KEY = "currentActor";
const RETENTION_DAYS = 365;

/** Read the active actor from settings. Empty string if not yet picked. */
export async function getCurrentActor(): Promise<string> {
  const row = await db.settings.get(ACTOR_KEY);
  const v = row?.value;
  if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

/** Append a single audit log entry. Never throws — audit failures shouldn't break the app. */
export async function logAudit(
  entity: AuditEntity,
  action: AuditAction,
  targetId: string | number,
  summary: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const actor = (await getCurrentActor()) || "(unset)";
    const entry: AuditLogEntry = {
      at: new Date().toISOString(),
      actor,
      entity,
      action,
      targetId,
      summary: summary.length > 280 ? summary.slice(0, 277) + "…" : summary,
      details,
    };
    await db.auditLog.add(entry);
  } catch (err) {
    console.warn("Audit log write failed:", err);
  }
}

/** Prune audit entries older than RETENTION_DAYS. Best-effort. Returns count pruned. */
export async function pruneAuditLog(retentionDays = RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
  try {
    const count = await db.auditLog.where("at").below(cutoff).delete();
    return count;
  } catch (err) {
    console.warn("Audit prune failed:", err);
    return 0;
  }
}
