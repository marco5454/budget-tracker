import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";

/**
 * Live-query of the array of years marked as closed. Returns [] while
 * loading or when never set. Components can call `.includes(year)` to
 * decide whether to lock writes.
 */
export function useClosedYears(): number[] {
  const v = useLiveQuery(async () => {
    const row = await db.settings.get("closedYears");
    return Array.isArray(row?.value)
      ? ((row!.value as unknown[]).filter(
          (x) => typeof x === "number" && Number.isFinite(x),
        ) as number[])
      : [];
  }, []);
  return v ?? [];
}
