import { mkdirSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import type { PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core/session";
import type { Assume } from "drizzle-orm/utils";
import { runMigrations } from "./migrate";
import * as schema from "./schema";

export type AppSchema = typeof schema;

export interface AppQueryResult<TRow = Record<string, unknown>> {
  rows: TRow[];
}

export interface AppQueryResultHKT extends PgQueryResultHKT {
  type: AppQueryResult<Assume<this["row"], Record<string, unknown>>>;
}

export type AppDb = PgDatabase<AppQueryResultHKT, AppSchema>;
export type AppTransaction = PgTransaction<
  AppQueryResultHKT,
  AppSchema,
  ExtractTablesWithRelations<AppSchema>
>;
export type AppDbOrTx = AppDb | AppTransaction;

export type TestDb = AppDb & {
  close: () => Promise<void>;
  pglite: PGlite;
};

export { runMigrations };

type CachedDbEntry = {
  key: string;
  promise: Promise<AppDb>;
  close: () => Promise<void>;
};

const DB_CACHE_SYMBOL = Symbol.for("ad-astra.community.db.cache");

type GlobalWithDbCache = typeof globalThis & {
  [DB_CACHE_SYMBOL]?: CachedDbEntry;
};

export function isPgliteMode(): boolean {
  return Boolean(
    process.env.AD_ASTRA_PG_TEST_DIR?.trim() || process.env.NODE_TEST_CONTEXT,
  );
}

async function loadPgliteClass(): Promise<typeof PGlite> {
  const pkg = ["@electric-sql", "pglite"].join("/");
  const mod = (await import(/* webpackIgnore: true */ pkg)) as { PGlite: typeof PGlite };
  return mod.PGlite;
}

async function initPgliteDb(dataDir?: string): Promise<{
  db: AppDb;
  pglite: PGlite;
}> {
  if (dataDir) {
    mkdirSync(dataDir, { recursive: true });
  }
  const PGliteCtor = await loadPgliteClass();
  const pglite = dataDir ? new PGliteCtor(dataDir) : new PGliteCtor();
  await pglite.waitReady;
  await runMigrations(pglite);
  const db = drizzlePglite(pglite, { schema }) as unknown as AppDb;
  return { db, pglite };
}

function initNeonDb(connectionString: string): {
  db: AppDb;
  pool: Pool;
} {
  const pool = new Pool({ connectionString });
  const db = drizzleNeon(pool, { schema }) as unknown as AppDb;
  return { db, pool };
}

export async function getDb(): Promise<AppDb> {
  const globalCache = globalThis as GlobalWithDbCache;
  const pgliteDir = process.env.AD_ASTRA_PG_TEST_DIR?.trim();
  const usePglite = isPgliteMode();

  const key = usePglite
    ? `pglite:${pgliteDir || ":memory:"}`
    : `neon:${process.env.DATABASE_URL?.trim() ?? ""}`;

  const existing = globalCache[DB_CACHE_SYMBOL];
  if (existing && existing.key === key) {
    return existing.promise;
  }

  if (existing) {
    await existing.close().catch(() => undefined);
    delete globalCache[DB_CACHE_SYMBOL];
  }

  if (usePglite) {
    let pgliteRef: PGlite | null = null;
    const promise = initPgliteDb(pgliteDir || undefined).then(({ db, pglite }) => {
      pgliteRef = pglite;
      return db;
    });
    const entry: CachedDbEntry = {
      key,
      promise,
      close: async () => {
        if (pgliteRef) {
          await pgliteRef.close();
        }
      },
    };
    globalCache[DB_CACHE_SYMBOL] = entry;
    try {
      return await promise;
    } catch (error) {
      if (globalCache[DB_CACHE_SYMBOL] === entry) {
        delete globalCache[DB_CACHE_SYMBOL];
      }
      throw error;
    }
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not configured. Set DATABASE_URL for Neon or AD_ASTRA_PG_TEST_DIR / NODE_TEST_CONTEXT for PGlite.",
    );
  }

  const { db, pool } = initNeonDb(connectionString);
  const entry: CachedDbEntry = {
    key,
    promise: Promise.resolve(db),
    close: async () => {
      await pool.end();
    },
  };
  globalCache[DB_CACHE_SYMBOL] = entry;
  return db;
}

export async function createTestDb(): Promise<TestDb> {
  const { db, pglite } = await initPgliteDb();
  return Object.assign(db, {
    pglite,
    close: () => pglite.close(),
  });
}

export async function closeDb(): Promise<void> {
  const globalCache = globalThis as GlobalWithDbCache;
  const existing = globalCache[DB_CACHE_SYMBOL];
  if (!existing) return;
  delete globalCache[DB_CACHE_SYMBOL];
  await existing.close();
}
