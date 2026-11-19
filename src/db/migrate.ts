import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import { sql, type SQL } from "drizzle-orm";

const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

export type MigrationExecutor =
  | { exec: (query: string) => Promise<unknown> }
  | { execute: (query: SQL) => Promise<unknown> }
  | { query: (query: string) => Promise<unknown> };

function resolveInitialMigrationPath(): string {
  const fromCwd = path.resolve(process.cwd(), "drizzle", "0000_initial.sql");
  if (existsSync(fromCwd)) {
    return fromCwd;
  }
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "..", "..", "drizzle", "0000_initial.sql");
}

export function getInitialMigrationSql(): string {
  return readFileSync(resolveInitialMigrationPath(), "utf8");
}

export function splitMigrationStatements(rawSql: string): string[] {
  return rawSql
    .split(STATEMENT_BREAKPOINT)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

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
    const client = new PGlite(pgliteDir);
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
