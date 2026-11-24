/**
 * Ejecutor del SQL inicial del esquema público. db:migrate lo usa para preparar
 * PostgreSQL en Neon. El cliente de pruebas reutiliza el mismo archivo para PGlite.
 * El ejecutor actual aplica drizzle/0000_initial.sql directamente.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
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

/**
 * Localiza el SQL que lee getInitialMigrationSql. Busca primero desde el
 * directorio de trabajo y después respecto a este módulo.
 * @returns La ruta absoluta prevista de drizzle/0000_initial.sql.
 */
function resolveInitialMigrationPath(): string {
  const fromCwd = path.resolve(process.cwd(), "drizzle", "0000_initial.sql");
  if (existsSync(fromCwd)) {
    return fromCwd;
  }
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "..", "..", "drizzle", "0000_initial.sql");
}

/**
 * Lee el SQL inicial del repositorio para runMigrations.
 * @returns El archivo completo en UTF-8, con los separadores de sentencias intactos.
 */
export function getInitialMigrationSql(): string {
  return readFileSync(resolveInitialMigrationPath(), "utf8");
}

/**
 * Separa el SQL inicial para los ejecutores que procesan una sentencia por llamada.
 * @param rawSql Texto leído del archivo inicial con marcadores statement-breakpoint.
 * @returns Las sentencias no vacías, recortadas y en el orden del archivo.
 */
export function splitMigrationStatements(rawSql: string): string[] {
  return rawSql
    .split(STATEMENT_BREAKPOINT)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Aplica el esquema inicial en el arranque de PGlite y en db:migrate. Si abre
 * su propia conexión, la cierra al terminar, incluso en caso de error.
 * @param executor Motor o cliente opcional. exec recibe el SQL completo y execute o
 * query reciben una sentencia cada vez. Sin ejecutor usa el directorio PGlite si
 * está configurado o la conexión de Neon, priorizando DATABASE_URL_UNPOOLED.
 * @returns Una promesa que finaliza al aplicar todo el SQL y rechaza si falla la ejecución.
 */
export async function runMigrations(executor?: MigrationExecutor): Promise<void> {
  const rawSql = getInitialMigrationSql();

  if (executor) {
    if ("exec" in executor && typeof executor.exec === "function") {
      await executor.exec(rawSql);
      return;
    }

    const statements = splitMigrationStatements(rawSql);

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
      await client.exec(rawSql);
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
    for (const statement of splitMigrationStatements(rawSql)) {
      await pool.query(statement);
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
