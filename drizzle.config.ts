/**
 * Drizzle Kit compara las tablas públicas de src/db/schema/index.ts con el snapshot
 * versionado para generar el siguiente SQL y actualizar el journal de drizzle/meta/.
 * db:migrate usa ese journal desde src/db/migrate.ts.
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
