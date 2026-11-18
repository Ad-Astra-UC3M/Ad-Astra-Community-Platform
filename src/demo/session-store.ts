import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type DemoUser = {
  id: string;
  name: string;
  workspaceId: string;
  role: "student" | "organizer";
};

type SignUp = {
  firstName: string;
  lastName: string;
  email: string;
  degree: string;
  course: string;
  password: string;
};

type SignUpResult =
  | { ok: true; input: SignUp }
  | { ok: false; error: "privacy" | "email" | "password" | "fields" };

export const verificationSeconds = 15 * 60;
export const sessionSeconds = 12 * 60 * 60;
const privacyVersion = "demo-1";

function field(form: FormData, name: string, limit: number) {
  const value = form.get(name);
  if (typeof value !== "string" || value.length > limit) return null;
  return value.trim() || null;
}

function emailFrom(form: FormData) {
  const email = field(form, "email", 254)?.toLowerCase();
  if (!email) return null;
  const [local, domain, ...extra] = email.split("@");
  if (!domain || extra.length || local.length > 64) return null;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return null;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*uc3m\.es$/.test(domain)) return null;
  return email;
}

function passwordFrom(form: FormData) {
  const value = form.get("password");
  if (typeof value !== "string" || value.length < 8 || value.length > 128) return null;
  return value.trim() ? value : null;
}

export function readSignUp(form: FormData): SignUpResult {
  if (form.get("privacy") !== "accepted") return { ok: false, error: "privacy" };

  const email = emailFrom(form);
  if (!email) return { ok: false, error: "email" };

  const password = passwordFrom(form);
  if (!password) return { ok: false, error: "password" };

  const firstName = field(form, "firstName", 80);
  const lastName = field(form, "lastName", 120);
  const degree = field(form, "degree", 120);
  const course = field(form, "course", 40);
  if (!firstName || !lastName || !degree || !course) return { ok: false, error: "fields" };

  return { ok: true, input: { firstName, lastName, email, degree, course, password } };
}

export function readSignIn(form: FormData) {
  const email = emailFrom(form);
  const password = passwordFrom(form);
  return email && password ? { email, password } : null;
}

export function opaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}

function matchesPassword(password: string, hash: string) {
  const [salt, digest] = hash.split(":");
  const expected = Buffer.from(digest, "hex");
  return timingSafeEqual(scryptSync(password, salt, expected.length), expected);
}

const userColumns = "a.id, trim(a.first_name || ' ' || a.last_name) AS name, a.workspace_id AS workspaceId, a.role";

export class SessionStore {
  constructor(private readonly db: DatabaseSync) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS demo_accounts (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('student', 'organizer')),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        degree TEXT,
        course TEXT,
        password_hash TEXT,
        privacy_version TEXT,
        privacy_accepted_at INTEGER,
        verification_hash TEXT,
        verification_expires_at INTEGER,
        verified_at INTEGER,
        UNIQUE (workspace_id, email),
        UNIQUE (workspace_id, id)
      ) STRICT;

      CREATE UNIQUE INDEX IF NOT EXISTS demo_accounts_fixture
      ON demo_accounts (workspace_id, role) WHERE email IS NULL;

      CREATE TABLE IF NOT EXISTS demo_sessions (
        token_hash TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (workspace_id, account_id) REFERENCES demo_accounts (workspace_id, id)
      ) STRICT;
    `);
  }

  createAccount(workspaceId: string, input: SignUp, verificationToken: string, now = Date.now()) {
    const result = this.db.prepare(`
      INSERT INTO demo_accounts (id, workspace_id, role, first_name, last_name,
        email, degree, course, password_hash, privacy_version, privacy_accepted_at,
        verification_hash, verification_expires_at)
      VALUES (?, ?, 'student', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (workspace_id, email) DO UPDATE SET
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        degree = excluded.degree,
        course = excluded.course,
        password_hash = excluded.password_hash,
        privacy_version = excluded.privacy_version,
        privacy_accepted_at = excluded.privacy_accepted_at,
        verification_hash = excluded.verification_hash,
        verification_expires_at = excluded.verification_expires_at
      WHERE demo_accounts.verified_at IS NULL AND demo_accounts.verification_expires_at <= ?
    `).run(
      randomUUID(), workspaceId, input.firstName, input.lastName, input.email, input.degree, input.course,
      hashPassword(input.password), privacyVersion, now, tokenHash(verificationToken), now + verificationSeconds * 1000, now,
    );
    return result.changes === 1;
  }

  hasPendingVerification(workspaceId: string, token: string, now = Date.now()) {
    return Boolean(this.db.prepare(`
      SELECT 1 FROM demo_accounts
      WHERE workspace_id = ? AND verification_hash = ? AND verification_expires_at > ? AND verified_at IS NULL
    `).get(workspaceId, tokenHash(token), now));
  }

  verifyAccount(workspaceId: string, token: string, now = Date.now()): DemoUser | null {
    const result = this.db.prepare(`
      UPDATE demo_accounts
      SET verified_at = ?, verification_hash = NULL, verification_expires_at = NULL
      WHERE workspace_id = ? AND verification_hash = ? AND verification_expires_at > ? AND verified_at IS NULL
      RETURNING id, trim(first_name || ' ' || last_name) AS name, workspace_id AS workspaceId, role
    `).get(now, workspaceId, tokenHash(token), now);
    return result ? { ...result } as DemoUser : null;
  }

  signIn(workspaceId: string, email: string, password: string): DemoUser | null {
    const account = this.db.prepare(`
      SELECT ${userColumns}, a.password_hash AS passwordHash FROM demo_accounts a
      WHERE a.workspace_id = ? AND a.email = ? AND a.verified_at IS NOT NULL
    `).get(workspaceId, email) as (DemoUser & { passwordHash: string }) | undefined;
    if (!account) return null;

    const { passwordHash, ...user } = account;
    return matchesPassword(password, passwordHash) ? user : null;
  }

  demoUser(workspaceId: string, role: DemoUser["role"]): DemoUser {
    const name = role === "student" ? "Estudiante de prueba" : "Organización de prueba";
    this.db.prepare(`
      INSERT INTO demo_accounts (id, workspace_id, role, first_name, last_name, verified_at)
      VALUES (?, ?, ?, ?, '', ?) ON CONFLICT DO NOTHING
    `).run(randomUUID(), workspaceId, role, name, Date.now());

    const result = this.db.prepare(`
      SELECT ${userColumns} FROM demo_accounts a
      WHERE a.workspace_id = ? AND a.role = ? AND a.verified_at IS NOT NULL
      ORDER BY a.email IS NULL, a.verified_at DESC, a.rowid DESC LIMIT 1
    `).get(workspaceId, role);
    if (!result) throw new Error("No se pudo obtener la cuenta de prueba.");
    return { ...result } as DemoUser;
  }

  openSession(user: DemoUser, now = Date.now()) {
    const token = opaqueToken();
    this.db.prepare(`
      INSERT INTO demo_sessions (token_hash, workspace_id, account_id, expires_at) VALUES (?, ?, ?, ?)
    `).run(tokenHash(token), user.workspaceId, user.id, now + sessionSeconds * 1000);
    return token;
  }

  sessionUser(workspaceId: string, token: string, now = Date.now()): DemoUser | null {
    const result = this.db.prepare(`
      SELECT ${userColumns} FROM demo_sessions s
      JOIN demo_accounts a ON a.workspace_id = s.workspace_id AND a.id = s.account_id
      WHERE s.workspace_id = ? AND s.token_hash = ? AND s.expires_at > ? AND a.verified_at IS NOT NULL
    `).get(workspaceId, tokenHash(token), now);
    return result ? { ...result } as DemoUser : null;
  }

  closeSession(workspaceId: string, token: string) {
    this.db.prepare("DELETE FROM demo_sessions WHERE workspace_id = ? AND token_hash = ?")
      .run(workspaceId, tokenHash(token));
  }
}
