import { eq } from "drizzle-orm";
import type { AppDbOrTx } from "../../db/client";
import { profiles } from "../../db/schema";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function formatName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export async function profileExists(
  db: AppDbOrTx,
  personId: string,
): Promise<boolean> {
  if (!isUuid(personId)) return false;
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, personId))
    .limit(1);
  return Boolean(row);
}
