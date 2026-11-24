/**
 * @file Reintenta los borrados físicos pendientes de Neon Storage: npm run avatars:cleanup.
 * Usa las mismas variables privadas que la aplicación; no imprime claves ni identidades.
 */
import { loadEnvConfig } from "@next/env";
import { closeDb, getDb } from "../src/db/client";
import { flushAvatarDeletions } from "../src/server/profiles/avatar-cleanup";
import { getAvatarStorage } from "../src/server/storage/avatar-storage";

/** Reintenta la cola de avatares del entorno y devuelve un código de salida no nulo si queda trabajo. */
async function main() {
  loadEnvConfig(process.cwd());
  try {
    const complete = await flushAvatarDeletions(await getDb(), getAvatarStorage());
    console.log(complete ? "Avatar cleanup complete." : "Avatar cleanup pending; retry when storage is available.");
    if (!complete) process.exitCode = 1;
  } finally { await closeDb(); }
}
void main().catch(() => { console.error("Avatar cleanup failed; pending tasks remain in PostgreSQL."); process.exitCode = 1; });
