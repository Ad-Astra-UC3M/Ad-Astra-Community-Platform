/**
 * Aplica las migraciones de Drizzle a PostgreSQL y a PGlite. El journal fija el orden
 * de los archivos SQL y cada base registra los que ya aplicó, junto a sus huellas.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import { loadEnvConfig } from "@next/env";
import { Pool } from "@neondatabase/serverless";
import { sql, type SQL } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";

interface MigrationTransaction {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface MigrationExecutor {
  transaction(
    callback: (transaction: MigrationTransaction) => Promise<void>,
    config: { isolationLevel: "read committed" },
  ): Promise<void>;
}

interface MigrationSqlFile {
  name: string;
  sql: string;
  checksum: string;
}

/**
 * Localiza el directorio de migraciones para db:migrate y las bases PGlite de la aplicación.
 * @returns Ruta absoluta, primero desde el directorio de trabajo y luego desde este módulo.
 */
function resolveMigrationsDir(): string {
  const fromCwd = path.resolve(process.cwd(), "drizzle");
  if (existsSync(path.join(fromCwd, "meta", "_journal.json"))) {
    return fromCwd;
  }
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "..", "..", "drizzle");
}

/**
 * Carga todos los archivos SQL siguiendo el orden del journal de Drizzle Kit.
 * @param directory Directorio con el journal y los archivos versionados.
 * @returns SQL y huella de cada archivo, estable entre checkouts con LF o CRLF.
 */
function getMigrationSqlFiles(directory: string): MigrationSqlFile[] {
  const journalPath = path.join(directory, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(/*turbopackIgnore: true*/ journalPath, "utf8")) as {
    entries: { tag: string }[];
  };
  const filenames = journal.entries.map(({ tag }) => tag + ".sql");
  const filesOnDisk = readdirSync(/*turbopackIgnore: true*/ directory)
    .filter((entry) => entry.endsWith(".sql"));
  const journalNames = new Set(filenames);
  if (
    journalNames.size !== filenames.length ||
    filenames.length !== filesOnDisk.length ||
    filesOnDisk.some((name) => !journalNames.has(name))
  ) {
    throw new Error("Migration SQL files do not match drizzle/meta/_journal.json.");
  }

  return filenames.map((name) => {
    const filename = path.join(directory, name);
    const contents = readFileSync(/*turbopackIgnore: true*/ filename, "utf8").replace(/\r\n/g, "\n");
    return {
      name,
      sql: contents,
      checksum: createHash("sha256").update(contents).digest("hex"),
    };
  });
}

/**
 * Verifica el historial y ejecuta solo los archivos pendientes. El bloqueo, el SQL
 * y su registro comparten transacción para serializar ejecuciones y revertir fallos.
 * @param database Conexión Drizzle creada o inyectada por runMigrations.
 * @param files Archivos SQL en el orden del journal.
 */
async function applyMigrations(database: MigrationExecutor, files: MigrationSqlFile[]): Promise<void> {
  await database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL search_path TO public`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('ad-astra-community-migrations'))`);
    await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS drizzle.app_migrations (
        position integer PRIMARY KEY,
        filename text NOT NULL UNIQUE,
        checksum text NOT NULL
      )
    `);

    const { rows: applied } = await tx.execute(sql`
      SELECT position, filename, checksum FROM drizzle.app_migrations ORDER BY position
    `);

    for (const [index, entry] of applied.entries()) {
      const file = files[index];
      if (
        entry.position !== index ||
        file?.name !== entry.filename ||
        file?.checksum !== entry.checksum
      ) {
        throw new Error("Applied migration does not match the journal: " + String(entry.filename));
      }
    }

    for (const [index, file] of files.entries()) {
      if (index < applied.length) continue;
      for (const statement of file.sql.split("--> statement-breakpoint")) {
        const query = statement.trim();
        if (query) await tx.execute(sql.raw(query));
      }
      await tx.execute(sql`
        INSERT INTO drizzle.app_migrations (position, filename, checksum)
        VALUES (${index}, ${file.name}, ${file.checksum})
      `);
    }
  }, { isolationLevel: "read committed" });
}

/**
 * Actualiza el esquema desde el CLI o al iniciar una base PGlite de pruebas.
 * @param executor Conexión PGlite o Drizzle inyectada. Si se omite, abre y cierra
 *   la base configurada por AD_ASTRA_PG_TEST_DIR o DATABASE_URL_UNPOOLED / DATABASE_URL.
 * @param directory Directorio de migraciones. Las pruebas pueden pasar un journal aislado.
 */
export async function runMigrations(
  executor?: MigrationExecutor | PGlite,
  directory: string = resolveMigrationsDir(),
): Promise<void> {
  const files = getMigrationSqlFiles(directory);
  if (executor) {
    await applyMigrations("exec" in executor ? drizzlePglite(executor) : executor, files);
    return;
  }

  const pgliteDir = process.env.AD_ASTRA_PG_TEST_DIR?.trim();
  if (pgliteDir) {
    mkdirSync(pgliteDir, { recursive: true });
    const pkg = ["@electric-sql", "pglite"].join("/");
    const { PGlite: PGliteCtor } = (await import(/* webpackIgnore: true */ pkg)) as {
      PGlite: typeof PGlite;
    };
    const client = new PGliteCtor(pgliteDir);
    try {
      await client.waitReady;
      await applyMigrations(drizzlePglite(client), files);
    } finally {
      await client.close();
    }
    return;
  }

  const connectionString =
    process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "Cannot run migrations: set DATABASE_URL_UNPOOLED, DATABASE_URL, or AD_ASTRA_PG_TEST_DIR.",
    );
  }

  const pool = new Pool({ connectionString });
  try {
    await applyMigrations(drizzleNeon(pool), files);
  } finally {
    await pool.end();
  }
}

/**
 * Comprueba si se ejecuta este módulo como comando db:migrate.
 * @returns Si la ruta de process.argv[1] coincide con la URL del módulo.
 */
function isDirectCliInvocation(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && pathToFileURL(path.resolve(entry)).href === import.meta.url);
}

if (isDirectCliInvocation()) {
  loadEnvConfig(process.cwd());
  runMigrations()
    .then(() => {
      console.log("Database migrations applied successfully.");
    })
    .catch((error: unknown) => {
      console.error("Failed to apply database migrations:", error);
      process.exitCode = 1;
    });
}
