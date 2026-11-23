/**
 * Ejecutor de migraciones SQL del esquema público en orden lexicográfico. `db:migrate` lo usa para
 * preparar PostgreSQL en Neon y el cliente de pruebas reutiliza los mismos archivos `.sql` de
 * `drizzle/` para PGlite de forma idempotente.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import { sql, type SQL } from "drizzle-orm";

const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

export type MigrationExecutor =
  | { exec: (query: string) => Promise<unknown> }
  | { execute: (query: SQL) => Promise<unknown> }
  | { query: (query: string) => Promise<unknown> };

export interface MigrationSqlFile {
  name: string;
  sql: string;
}

/**
 * Localiza el directorio `drizzle/` del repositorio comprobando que contenga `0000_initial.sql`.
 * Busca primero respecto al directorio de trabajo y después respecto a este módulo.
 *
 * @returns Ruta absoluta del directorio de migraciones SQL.
 */
function resolveMigrationsDir(): string {
  const fromCwd = path.resolve(process.cwd(), "drizzle");
  if (existsSync(path.join(fromCwd, "0000_initial.sql"))) {
    return fromCwd;
  }
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "..", "..", "drizzle");
}

/**
 * Enumera los archivos `.sql` de `drizzle/` en orden lexicográfico ascendente (`0000_*`, `0001_*`, ...).
 *
 * @returns Lista ordenada de rutas absolutas de archivos de migración SQL.
 */
function listMigrationPaths(): string[] {
  const dir = resolveMigrationsDir();
  const names = readdirSync(/*turbopackIgnore: true*/ dir)
    .filter((entry) => entry.endsWith(".sql"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return names.map((name) => path.join(/*turbopackIgnore: true*/ dir, name));
}

/**
 * Lee el SQL inicial del repositorio (`drizzle/0000_initial.sql`).
 *
 * @returns El archivo inicial en UTF-8 con sus marcadores de sentencia intactos.
 */
export function getInitialMigrationSql(): string {
  return readFileSync(path.join(resolveMigrationsDir(), "0000_initial.sql"), "utf8");
}

/**
 * Carga todas las migraciones `.sql` de `drizzle/` en el orden en que debe aplicarlas `runMigrations`.
 *
 * @returns Lista ordenada de pares `{ name, sql }` en UTF-8.
 */
export function getMigrationSqlFiles(): MigrationSqlFile[] {
  return listMigrationPaths().map((filePath) => ({
    name: path.basename(filePath),
    sql: readFileSync(/*turbopackIgnore: true*/ filePath, "utf8"),
  }));
}

/**
 * Separa un archivo SQL de migración por `statement-breakpoint` para los ejecutores que procesan una
 * sentencia por llamada.
 *
 * @param rawSql Texto leído del archivo `.sql` con marcadores statement-breakpoint.
 * @returns Las sentencias no vacías, recortadas y en el orden del archivo.
 */
export function splitMigrationStatements(rawSql: string): string[] {
  return rawSql
    .split(STATEMENT_BREAKPOINT)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Aplica todas las migraciones SQL de `drizzle/` en el arranque de PGlite y en `db:migrate`. Si abre
 * su propia conexión, la cierra al terminar, incluso en caso de error.
 *
 * @param executor Motor o cliente opcional. `exec` recibe cada archivo SQL completo y `execute` o
 *   `query` reciben cada sentencia por separado. Sin ejecutor usa `AD_ASTRA_PG_TEST_DIR` o la conexión
 *   de Neon, priorizando `DATABASE_URL_UNPOOLED`.
 * @returns Una promesa que finaliza al aplicar todas las migraciones y rechaza si falla una sentencia.
 */
export async function runMigrations(executor?: MigrationExecutor): Promise<void> {
  const files = getMigrationSqlFiles();

  if (executor) {
    if ("exec" in executor && typeof executor.exec === "function") {
      for (const file of files) {
        await executor.exec(file.sql);
      }
      return;
    }

    const statements = files.flatMap((file) => splitMigrationStatements(file.sql));

    if ("execute" in executor && typeof executor.execute === "function") {
      for (const statement of statements) {
        await executor.execute(sql.raw(statement));
      }
      return;
    }

    if ("query" in executor && typeof executor.query === "function") {
      for (const statement of statements) {
        await executor.query(statement);
      }
      return;
    }

    throw new Error("Unsupported migration executor.");
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
      for (const file of files) {
        await client.exec(file.sql);
      }
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
    for (const file of files) {
      for (const statement of splitMigrationStatements(file.sql)) {
        await pool.query(statement);
      }
    }
  } finally {
    await pool.end();
  }
}

/**
 * Comprueba el punto de entrada para ejecutar db:migrate solo como comando.
 * Los imports desde client.ts y las pruebas se limitan a cargar sus exportaciones.
 * @returns Si la ruta de process.argv[1] coincide con la URL de este módulo.
 */
function isDirectCliInvocation(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return pathToFileURL(path.resolve(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isDirectCliInvocation()) {
  runMigrations()
    .then(() => {
      console.log("Database migrations applied successfully.");
    })
    .catch((error: unknown) => {
      console.error("Failed to apply database migrations:", error);
      process.exitCode = 1;
    });
}
