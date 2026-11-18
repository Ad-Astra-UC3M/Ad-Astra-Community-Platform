import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const filename = process.env.AD_ASTRA_DEMO_DB ??
  (process.env.NODE_TEST_CONTEXT ? ":memory:" : resolve(".community-demo", "community.sqlite"));
if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });

export const db = new DatabaseSync(filename);
db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
