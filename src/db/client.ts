/**
 * Conexión a PostgreSQL para la capa de servidor de Next.js. Expone el mismo
 * contrato Drizzle con Neon en la aplicación y PGlite en pruebas. Los repositorios
 * pueden recibir una conexión o transacción inyectada para compartir la unidad
 * de trabajo. Neon Auth gestiona la identidad mediante su propio proveedor.
 */

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
/**
 * Tipo de conexión o transacción que aceptan las operaciones que pueden componer
 * consultas dentro de una transacción abierta por el llamador.
 */
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

/**
 * Detecta si la ejecución debe usar PostgreSQL embebido. Lo consulta getDb.
 * @returns Si hay un directorio de pruebas configurado o está activo el runner de Node.
 */
export function isPgliteMode(): boolean {
  return Boolean(
    process.env.AD_ASTRA_PG_TEST_DIR?.trim() || process.env.NODE_TEST_CONTEXT,
  );
}

/**
 * Carga el constructor de PGlite bajo demanda en initPgliteDb. La importación
 * dinámica mantiene el motor de pruebas fuera de la resolución estática del bundle.
 * @returns El constructor del motor PostgreSQL embebido.
 */
async function loadPgliteClass(): Promise<typeof PGlite> {
  const pkg = ["@electric-sql", "pglite"].join("/");
  const mod = (await import(/* webpackIgnore: true */ pkg)) as { PGlite: typeof PGlite };
  return mod.PGlite;
}

/**
 * Prepara PGlite para getDb y createTestDb. Espera a que arranque, aplica el
 * SQL inicial y lo conecta con el mismo esquema Drizzle que usa Neon.
 * @param dataDir Directorio persistente para el seed y el servidor E2E. Si se omite, usa memoria.
 * @returns El cliente Drizzle y el motor PGlite para poder cerrarlo.
 */
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

/**
 * Construye el cliente Drizzle para getDb con un pool de Neon Serverless.
 * @param connectionString URL de PostgreSQL de DATABASE_URL, usada por el pool al conectar.
 * @returns El cliente Drizzle tipado y el pool que cierra closeDb.
 */
function initNeonDb(connectionString: string): {
  db: AppDb;
  pool: Pool;
} {
  const pool = new Pool({ connectionString });
  const db = drizzleNeon(pool, { schema }) as unknown as AppDb;
  return { db, pool };
}

/**
 * Devuelve la conexión que usan repositorios y servicios de Next.js por defecto.
 * Comparte su promesa en el proceso mientras se mantenga la configuración. En
 * pruebas migra PGlite al abrirlo. En Neon, db:migrate prepara el esquema por separado.
 * @returns El cliente Drizzle del entorno actual. Falla si falta la URL de Neon en modo normal.
 */
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
      /** Cierra la instancia PGlite de la caché cuando terminó de iniciarse. */
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
    /** Cierra el pool Neon que pertenece a esta entrada de getDb. */
    close: async () => {
      await pool.end();
    },
  };
  globalCache[DB_CACHE_SYMBOL] = entry;
  return db;
}

/**
 * Crea una instancia en memoria y aplica el SQL inicial para las pruebas
 * de integración, que la inyectan en los servicios y repositorios.
 * @returns El cliente aislado, el motor PGlite y el método close para el bloque finally.
 */
export async function createTestDb(): Promise<TestDb> {
  const { db, pglite } = await initPgliteDb();
  return Object.assign(db, {
    pglite,
    /** Libera la instancia aislada que createTestDb entrega a esta prueba. */
    close: () => pglite.close(),
  });
}

/**
 * Retira la conexión global y cierra su pool Neon o instancia PGlite. El seed
 * E2E, las pruebas que usan getDb y el bootstrap CLI la llaman al terminar.
 * @returns Una promesa que finaliza tras el cierre o de inmediato si no hay conexión registrada.
 */
export async function closeDb(): Promise<void> {
  const globalCache = globalThis as GlobalWithDbCache;
  const existing = globalCache[DB_CACHE_SYMBOL];
  if (!existing) return;
  delete globalCache[DB_CACHE_SYMBOL];
  await existing.close();
}
