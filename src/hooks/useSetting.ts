import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";

export function useSetting<T>(key: string, defaultValue: T): T {
  const value = useLiveQuery(async () => {
    const row = await db.settings.get(key);
    return (row?.value as T) ?? defaultValue;
  }, [key]);
  return (value ?? defaultValue) as T;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
