import { randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { db } from "./db";

db.exec(`
  CREATE TABLE IF NOT EXISTS card_keys (
    workspace TEXT PRIMARY KEY,
    secret BLOB NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS card_versions (
    workspace TEXT NOT NULL,
    person TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    PRIMARY KEY (workspace, person)
  ) STRICT;
`);

function workspaceKey(workspace: string) {
  const row = db.prepare("SELECT secret FROM card_keys WHERE workspace = ?").get(workspace);
  return row?.secret as Uint8Array | undefined;
}

function ensureWorkspaceKey(workspace: string) {
  db.prepare("INSERT OR IGNORE INTO card_keys (workspace, secret) VALUES (?, ?)").run(workspace, randomBytes(32));
  return workspaceKey(workspace)!;
}

export function getCardVersion(workspace: string, person: string): number {
  const row = db.prepare(
    "SELECT version FROM card_versions WHERE workspace = ? AND person = ?",
  ).get(workspace, person) as { version: number } | undefined;
  return row?.version ?? 1;
}

function signCard(key: Uint8Array, person: string, version: number) {
  return new SignJWT({ version })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("attendance")
    .setSubject(person)
    .sign(key);
}

export async function issueCard(workspace: string, person: string) {
  const key = ensureWorkspaceKey(workspace);
  db.prepare(
    "INSERT OR IGNORE INTO card_versions (workspace, person, version) VALUES (?, ?, 1)",
  ).run(workspace, person);
  const version = getCardVersion(workspace, person);
  return signCard(key, person, version);
}

export async function reissueCard(workspace: string, person: string): Promise<{ token: string; version: number }> {
  const key = ensureWorkspaceKey(workspace);
  const row = db.prepare(`
    INSERT INTO card_versions (workspace, person, version) VALUES (?, ?, 2)
    ON CONFLICT (workspace, person) DO UPDATE SET version = version + 1
    RETURNING version
  `).get(workspace, person) as { version: number };
  const token = await signCard(key, person, row.version);
  return { token, version: row.version };
}

export async function verifyCard(workspace: string, token: string): Promise<string | null> {
  const key = workspaceKey(workspace);
  if (!key || token.length > 2048) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"], audience: "attendance" });
    if (typeof payload.sub !== "string" || typeof payload.version !== "number") return null;
    return payload.version === getCardVersion(workspace, payload.sub) ? payload.sub : null;
  } catch {
    return null;
  }
}

export const readCard = verifyCard;
