import { getDb, type AppDb } from "../../db/client";

export async function resolveDb(db?: AppDb): Promise<AppDb> {
  return db ?? getDb();
}

export function computeAvailable(capacity: number | null, reservedCount: number): number | null {
  return capacity === null ? null : Math.max(0, capacity - reservedCount);
}
