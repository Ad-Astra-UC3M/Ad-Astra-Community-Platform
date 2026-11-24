/**
 * Pruebas de las migraciones SQL con PGlite, incluidos despliegues previos al historial.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "./migrate";

it("applies only new migrations and rejects edits to applied SQL", async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "community-migrations-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const client = new PGlite();
  t.after(() => client.close());
  mkdirSync(path.join(directory, "meta"));
  await client.exec("CREATE SCHEMA other; SET search_path TO other, public;");

  const first = "0000_create_examples";
  const second = "0001_add_example";
  const firstSql = "CREATE TABLE examples (label text PRIMARY KEY);\n";
  const secondSql = "INSERT INTO examples VALUES ('created once');\n";

  /**
   * Guarda el journal de la fixture para simular una nueva versión de Drizzle.
   * @param tags Nombres de las migraciones en orden de aplicación.
   */
  function writeJournal(tags: string[]) {
    const entries = tags.map((tag, idx) => ({
      idx, version: "7", when: 1_700_000_000_000 + idx, tag, breakpoints: true,
    }));
    writeFileSync(
      path.join(directory, "meta", "_journal.json"),
      JSON.stringify({ version: "7", dialect: "postgresql", entries }),
    );
  }

  writeFileSync(path.join(directory, first + ".sql"), firstSql);
  writeJournal([first]);
  await runMigrations(client, directory);

  writeFileSync(
    path.join(directory, second + ".sql"),
    secondSql + "--> statement-breakpoint\nSELECT unknown_column FROM examples;\n",
  );
  writeJournal([first, second]);
  await assert.rejects(runMigrations(client, directory), /unknown_column/);
  assert.deepEqual((await client.query("SELECT label FROM public.examples")).rows, []);

  writeFileSync(path.join(directory, second + ".sql"), secondSql);
  await runMigrations(client, directory);
  await runMigrations(client, directory);
  const { rows } = await client.query("SELECT label FROM public.examples");
  assert.deepEqual(rows, [{ label: "created once" }]);

  writeFileSync(path.join(directory, second + ".sql"), secondSql + "-- Changed\n");
  await assert.rejects(runMigrations(client, directory), /0001_add_example\.sql/);
});

it("registers the existing migrations on a database set up before the journal", async (t) => {
  const client = new PGlite();
  t.after(() => client.close());

  for (const file of ["0000_initial.sql", "0001_profile_avatar.sql"]) {
    await client.exec(readFileSync(new URL("../../drizzle/" + file, import.meta.url), "utf8"));
  }


  const profileId = "11111111-1111-4111-8111-111111111111";
  const legacyKey = "avatars/" + profileId + "/22222222-2222-4222-8222-222222222222.webp";
  await client.query(`
    INSERT INTO public.profiles (
      id, email, first_name, last_name, degree, course, privacy_accepted,
      privacy_version, privacy_accepted_at, avatar_key, avatar_updated_at
    ) VALUES ($1, 'legacy@uc3m.es', 'Ana', 'García', 'Ingeniería', '3',
              true, 'v1', now(), $2, now())
  `, [profileId, legacyKey]);

  await runMigrations(client);
  await runMigrations(client);

  const profile = await client.query(
    "SELECT avatar_key FROM public.profiles WHERE id = $1",
    [profileId],
  );
  assert.deepEqual(profile.rows, [{ avatar_key: legacyKey }]);

  const { rows } = await client.query(
    "SELECT filename FROM drizzle.app_migrations ORDER BY position LIMIT 2",
  );
  assert.deepEqual(rows, [
    { filename: "0000_initial.sql" },
    { filename: "0001_profile_avatar.sql" },
  ]);
});
