import { randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { db } from "./db";

db.exec("CREATE TABLE IF NOT EXISTS card_keys (workspace TEXT PRIMARY KEY, secret BLOB NOT NULL)");

export async function issueCard(workspace: string, person: string) {
  db.prepare("INSERT OR IGNORE INTO card_keys VALUES (?, ?)").run(workspace, randomBytes(32));
  const key = workspaceKey(workspace)!;
  return new SignJWT({ version: 1 })
    .setProtectedHeader({ alg: "HS256" }).setAudience("attendance").setSubject(person).sign(key);
}

function workspaceKey(workspace: string) {
  const row = db.prepare("SELECT secret FROM card_keys WHERE workspace = ?").get(workspace);
  return row?.secret as Uint8Array | undefined;
}

export async function readCard(workspace: string, token: string) {
  const key = workspaceKey(workspace);
  if (!key || token.length > 2048) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"], audience: "attendance" });
    return payload.version === 1 && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
