/**
 * Configuración de db:generate para Drizzle Kit. Lee las tablas del esquema
 * público de src/db/schema/index.ts y genera artefactos en drizzle/. La
 * conexión indicada prioriza DATABASE_URL_UNPOOLED cuando está definida.
 *
 * db:migrate ejecuta drizzle/0000_initial.sql mediante src/db/migrate.ts. Ese
 * archivo es el SQL inicial versionado que comparten Neon y PGlite e incluye
 * las funciones PostgreSQL para validar talento JSONB. Los metadatos de
 * Drizzle Kit, como snapshots y journal cuando se generan, sirven para llevar
 * el historial de generación. El ejecutor actual lee el SQL inicial directamente.
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schemaFilter: ["public"],
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
