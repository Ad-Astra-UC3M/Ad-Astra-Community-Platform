import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type AdminCapability =
  | "general_admin"
  | "content_editing"
  | "attendance_validation"
  | "talent_consultation";

export const ALL_CAPABILITIES: readonly AdminCapability[] = [
  "general_admin",
  "content_editing",
  "attendance_validation",
  "talent_consultation",
] as const;

const DEFAULT_ORGANIZER_CAPABILITIES: readonly AdminCapability[] = [
  "general_admin",
  "content_editing",
  "attendance_validation",
] as const;

export type AccountStatus = "active" | "deactivated";

export type DemoUser = {
  id: string;
  name: string;
  workspaceId: string;
  role: "student" | "organizer";
  capabilities: AdminCapability[];
  status?: AccountStatus;
};

export type CapabilityAuditEntry = {
  id: string;
  workspaceId: string;
  targetAccountId: string;
  capability: AdminCapability;
  action: "granted" | "revoked";
  actorId: string;
  createdAt: number;
};

type RawUserRow = {
  id: string;
  name: string;
  workspaceId: string;
  role: "student" | "organizer";
  status: AccountStatus;
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
export const resetSeconds = 15 * 60;
export const sessionSeconds = 12 * 60 * 60;
const privacyVersion = "demo-1";

export function isAdminCapability(value: unknown): value is AdminCapability {
  return typeof value === "string" && (ALL_CAPABILITIES as readonly string[]).includes(value);
}

function isSafeInternalPath(value: string): boolean {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return false;
  }
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return false;
  try {
    const parsed = new URL(value, "https://community.local");
    return parsed.origin === "https://community.local" && parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
}

export function sanitizeNextPath(raw: unknown, fallback = "/home"): string {
  const safeFallback = isSafeInternalPath(fallback) ? fallback : "/home";
  if (typeof raw !== "string") return safeFallback;
  const trimmed = raw.trim();
  return isSafeInternalPath(trimmed) ? trimmed : safeFallback;
}

function field(form: FormData, name: string, limit: number) {
  const value = form.get(name);
  if (typeof value !== "string" || value.length > limit) return null;
  return value.trim() || null;
}

function normalizeEmail(raw: string | null | undefined) {
  const email = raw?.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  const [local, domain, ...extra] = email.split("@");
  if (!domain || extra.length || local.length > 64) return null;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return null;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*uc3m\.es$/.test(domain)) return null;
  return email;
}

function emailFrom(form: FormData) {
  return normalizeEmail(field(form, "email", 254));
}

function isValidPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128 && Boolean(value.trim());
}

function passwordFrom(form: FormData) {
  const value = form.get("password");
  return isValidPassword(value) ? value : null;
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

export function readPasswordResetRequest(form: FormData) {
  const email = emailFrom(form);
  return email ? { email } : null;
}

export function readPasswordReset(form: FormData):
  | { ok: true; password: string }
  | { ok: false; error: "password" | "mismatch" } {
  const password = passwordFrom(form);
  if (!password) return { ok: false, error: "password" };
  if (form.has("confirmPassword") && form.get("confirmPassword") !== password) {
    return { ok: false, error: "mismatch" };
  }
  return { ok: true, password };
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

const userColumns =
  "a.id, trim(a.first_name || ' ' || a.last_name) AS name, a.workspace_id AS workspaceId, a.role, a.status";

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
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated')),
        reset_hash TEXT,
        reset_expires_at INTEGER,
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

      CREATE TABLE IF NOT EXISTS demo_student_selection (
        workspace_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        FOREIGN KEY (workspace_id, account_id) REFERENCES demo_accounts (workspace_id, id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS demo_account_capabilities (
        workspace_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        capability TEXT NOT NULL CHECK (capability IN ('general_admin', 'content_editing', 'attendance_validation', 'talent_consultation')),
        granted_at INTEGER NOT NULL,
        granted_by TEXT NOT NULL,
        PRIMARY KEY (workspace_id, account_id, capability)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS demo_capability_audit (
        workspace_id TEXT NOT NULL,
        id TEXT PRIMARY KEY,
        target_account_id TEXT NOT NULL,
        capability TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
        actor_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      ) STRICT;

      CREATE TRIGGER IF NOT EXISTS demo_sessions_remember_student
      AFTER INSERT ON demo_sessions
      BEGIN
        INSERT INTO demo_student_selection (workspace_id, account_id)
        SELECT workspace_id, id FROM demo_accounts
        WHERE workspace_id = NEW.workspace_id AND id = NEW.account_id
          AND role = 'student' AND verified_at IS NOT NULL
        ON CONFLICT (workspace_id) DO UPDATE SET account_id = excluded.account_id;
      END;
    `);

    this.migrateDemoAccountsColumns();

    // Existing sessions may predate the student selection table.
    db.prepare(`
      INSERT INTO demo_student_selection (workspace_id, account_id)
      SELECT s.workspace_id, s.account_id FROM demo_sessions s
      JOIN demo_accounts a ON a.workspace_id = s.workspace_id AND a.id = s.account_id
      WHERE a.role = 'student' AND a.verified_at IS NOT NULL AND s.expires_at > ?
      ORDER BY s.rowid DESC
      ON CONFLICT (workspace_id) DO NOTHING
    `).run(Date.now());
  }

  private migrateDemoAccountsColumns() {
    const rows = this.db.prepare("PRAGMA table_info(demo_accounts)").all() as { name: string }[];
    const columns = new Set(rows.map((row) => row.name));
    if (!columns.has("status")) {
      this.db.exec(
        "ALTER TABLE demo_accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated'))",
      );
    }
    if (!columns.has("reset_hash")) {
      this.db.exec("ALTER TABLE demo_accounts ADD COLUMN reset_hash TEXT");
    }
    if (!columns.has("reset_expires_at")) {
      this.db.exec("ALTER TABLE demo_accounts ADD COLUMN reset_expires_at INTEGER");
    }
  }

  private hydrateUser(row: RawUserRow): DemoUser {
    return {
      id: row.id,
      name: row.name,
      workspaceId: row.workspaceId,
      role: row.role,
      status: row.status,
      capabilities: this.getCapabilities(row.workspaceId, row.id),
    };
  }

  private ensureDefaultOrganizerCapabilities(workspaceId: string, accountId: string, now = Date.now()) {
    const hasCapabilities = this.db.prepare(`
      SELECT 1 FROM demo_account_capabilities WHERE workspace_id = ? AND account_id = ? LIMIT 1
    `).get(workspaceId, accountId);
    if (hasCapabilities) return;

    const hasAudit = this.db.prepare(`
      SELECT 1 FROM demo_capability_audit WHERE workspace_id = ? AND target_account_id = ? LIMIT 1
    `).get(workspaceId, accountId);
    if (hasAudit) return;

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO demo_account_capabilities (workspace_id, account_id, capability, granted_at, granted_by)
      VALUES (?, ?, ?, ?, 'system')
    `);
    for (const capability of DEFAULT_ORGANIZER_CAPABILITIES) {
      insert.run(workspaceId, accountId, capability, now);
    }
  }

  getCapabilities(workspaceId: string, accountId: string): AdminCapability[] {
    const rows = this.db.prepare(`
      SELECT capability FROM demo_account_capabilities
      WHERE workspace_id = ? AND account_id = ?
    `).all(workspaceId, accountId) as { capability: string }[];
    const active = new Set(rows.map((row) => row.capability));
    return ALL_CAPABILITIES.filter((capability) => active.has(capability));
  }

  private runAtomic<T>(fn: () => T): T {
    const savepoint = `sp_${randomBytes(6).toString("hex")}`;
    this.db.exec(`SAVEPOINT ${savepoint}`);
    try {
      const value = fn();
      this.db.exec(`RELEASE SAVEPOINT ${savepoint}`);
      return value;
    } catch (error) {
      this.db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}`);
      throw error;
    }
  }

  setCapability(
    workspaceId: string,
    targetAccountId: string,
    capability: AdminCapability,
    enabled: boolean,
    actorId: string,
    now = Date.now(),
  ): void {
    if (!isAdminCapability(capability)) {
      throw new Error("Capacidad administrativa no válida.");
    }

    this.runAtomic(() => {
      let changed = false;
      if (enabled) {
        const result = this.db.prepare(`
          INSERT OR IGNORE INTO demo_account_capabilities (workspace_id, account_id, capability, granted_at, granted_by)
          VALUES (?, ?, ?, ?, ?)
        `).run(workspaceId, targetAccountId, capability, now, actorId);
        changed = result.changes === 1;
      } else {
        const result = this.db.prepare(`
          DELETE FROM demo_account_capabilities
          WHERE workspace_id = ? AND account_id = ? AND capability = ?
        `).run(workspaceId, targetAccountId, capability);
        changed = result.changes === 1;
      }

      if (changed) {
        this.db.prepare(`
          INSERT INTO demo_capability_audit (workspace_id, id, target_account_id, capability, action, actor_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          workspaceId,
          randomUUID(),
          targetAccountId,
          capability,
          enabled ? "granted" : "revoked",
          actorId,
          now,
        );
      }
    });
  }

  listCapabilityAudit(workspaceId: string, targetAccountId?: string): CapabilityAuditEntry[] {
    if (targetAccountId) {
      return this.db.prepare(`
        SELECT id, workspace_id AS workspaceId, target_account_id AS targetAccountId,
               capability, action, actor_id AS actorId, created_at AS createdAt
        FROM demo_capability_audit
        WHERE workspace_id = ? AND target_account_id = ?
        ORDER BY created_at DESC, rowid DESC
      `).all(workspaceId, targetAccountId) as CapabilityAuditEntry[];
    }
    return this.db.prepare(`
      SELECT id, workspace_id AS workspaceId, target_account_id AS targetAccountId,
             capability, action, actor_id AS actorId, created_at AS createdAt
      FROM demo_capability_audit
      WHERE workspace_id = ?
      ORDER BY created_at DESC, rowid DESC
    `).all(workspaceId) as CapabilityAuditEntry[];
  }

  setAccountStatus(
    workspaceId: string,
    targetAccountId: string,
    status: AccountStatus,
    _actorId: string,
    _now = Date.now(),
  ): boolean {
    if (status !== "active" && status !== "deactivated") return false;

    return this.runAtomic(() => {
      const result = status === "deactivated"
        ? this.db.prepare(`
            UPDATE demo_accounts
            SET status = 'deactivated', reset_hash = NULL, reset_expires_at = NULL
            WHERE workspace_id = ? AND id = ?
          `).run(workspaceId, targetAccountId)
        : this.db.prepare(`
            UPDATE demo_accounts
            SET status = 'active'
            WHERE workspace_id = ? AND id = ?
          `).run(workspaceId, targetAccountId);

      if (result.changes === 0) return false;

      if (status === "deactivated") {
        this.db.prepare(`
          DELETE FROM demo_sessions WHERE workspace_id = ? AND account_id = ?
        `).run(workspaceId, targetAccountId);
      }

      return true;
    });
  }

  isAccountActive(workspaceId: string, accountId: string): boolean {
    return Boolean(this.db.prepare(`
      SELECT 1 FROM demo_accounts
      WHERE workspace_id = ? AND id = ? AND status = 'active'
    `).get(workspaceId, accountId));
  }

  requestPasswordReset(workspaceId: string, email: string, resetToken: string, now = Date.now()): boolean {
    const normalized = normalizeEmail(email);
    if (!normalized) return false;
    const result = this.db.prepare(`
      UPDATE demo_accounts
      SET reset_hash = ?, reset_expires_at = ?
      WHERE workspace_id = ? AND email = ? AND verified_at IS NOT NULL AND status = 'active'
    `).run(tokenHash(resetToken), now + resetSeconds * 1000, workspaceId, normalized);
    return result.changes === 1;
  }

  hasPendingPasswordReset(workspaceId: string, token: string, now = Date.now()): boolean {
    return Boolean(this.db.prepare(`
      SELECT 1 FROM demo_accounts
      WHERE workspace_id = ? AND reset_hash = ? AND reset_expires_at > ?
        AND verified_at IS NOT NULL AND status = 'active'
    `).get(workspaceId, tokenHash(token), now));
  }

  resetPassword(workspaceId: string, token: string, newPassword: string, now = Date.now()): boolean {
    if (!isValidPassword(newPassword)) return false;

    return this.runAtomic(() => {
      const updated = this.db.prepare(`
        UPDATE demo_accounts
        SET password_hash = ?, reset_hash = NULL, reset_expires_at = NULL
        WHERE workspace_id = ? AND reset_hash = ? AND reset_expires_at > ?
          AND verified_at IS NOT NULL AND status = 'active'
        RETURNING id
      `).get(hashPassword(newPassword), workspaceId, tokenHash(token), now) as { id: string } | undefined;

      if (!updated) return false;

      this.db.prepare(`
        DELETE FROM demo_sessions WHERE workspace_id = ? AND account_id = ?
      `).run(workspaceId, updated.id);

      return true;
    });
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
      RETURNING id, trim(first_name || ' ' || last_name) AS name, workspace_id AS workspaceId, role, status
    `).get(now, workspaceId, tokenHash(token), now) as RawUserRow | undefined;
    return result ? this.hydrateUser(result) : null;
  }

  signIn(workspaceId: string, email: string, password: string): DemoUser | null {
    const account = this.db.prepare(`
      SELECT ${userColumns}, a.password_hash AS passwordHash FROM demo_accounts a
      WHERE a.workspace_id = ? AND a.email = ? AND a.verified_at IS NOT NULL AND a.status = 'active'
    `).get(workspaceId, email) as (RawUserRow & { passwordHash: string }) | undefined;
    if (!account) return null;

    const { passwordHash, ...userRow } = account;
    return matchesPassword(password, passwordHash) ? this.hydrateUser(userRow) : null;
  }

  demoUser(workspaceId: string, role: DemoUser["role"]): DemoUser {
    const name = role === "student" ? "Estudiante de prueba" : "Organización de prueba";
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO demo_accounts (id, workspace_id, role, first_name, last_name, verified_at)
      VALUES (?, ?, ?, ?, '', ?) ON CONFLICT DO NOTHING
    `).run(randomUUID(), workspaceId, role, name, now);

    const result = this.db.prepare(`
      SELECT ${userColumns} FROM demo_accounts a
      LEFT JOIN demo_student_selection selected ON selected.workspace_id = a.workspace_id
      WHERE a.workspace_id = ? AND a.role = ? AND a.verified_at IS NOT NULL AND a.status = 'active'
      ORDER BY (a.id = selected.account_id) DESC, a.email IS NULL, a.verified_at DESC, a.rowid DESC LIMIT 1
    `).get(workspaceId, role) as RawUserRow | undefined;
    if (!result) throw new Error("No se pudo obtener la cuenta de prueba.");
    if (role === "organizer") {
      this.ensureDefaultOrganizerCapabilities(workspaceId, result.id, now);
    }
    return this.hydrateUser(result);
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
      WHERE s.workspace_id = ? AND s.token_hash = ? AND s.expires_at > ?
        AND a.verified_at IS NOT NULL AND a.status = 'active'
    `).get(workspaceId, tokenHash(token), now) as RawUserRow | undefined;
    return result ? this.hydrateUser(result) : null;
  }

  closeSession(workspaceId: string, token: string) {
    this.db.prepare("DELETE FROM demo_sessions WHERE workspace_id = ? AND token_hash = ?")
      .run(workspaceId, tokenHash(token));
  }
}
