import { randomUUID } from "node:crypto";
import { db } from "./db";
import { SessionStore } from "./session-store";

export const DISSEMINATION_PURPOSE = "internal_and_future_talent_sharing";
export const DISSEMINATION_POLICY_VERSION = "talent-diffusion-v1";

export const TALENT_LINK_KINDS = ["cv", "linkedin", "github", "portfolio", "other"] as const;
export type TalentLinkKind = (typeof TALENT_LINK_KINDS)[number];

export type BasicProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  degree: string;
  course: string;
  privacyVersion: string | null;
  privacyAcceptedAt: number | null;
};

export type BasicProfileUpdateInput = {
  firstName: string;
  lastName: string;
  degree: string;
  course: string;
  email?: string;
  role?: string;
  id?: string;
};

export type BasicProfileUpdateError =
  | "missing"
  | "email_immutable"
  | "identity_immutable"
  | "fields";

export type BasicProfileUpdateResult =
  | { ok: true; profile: BasicProfile }
  | { ok: false; error: BasicProfileUpdateError };

export type TalentLink = {
  kind: TalentLinkKind;
  label: string;
  url: string;
};

export type TalentProfile = {
  accountId: string;
  university: string;
  graduationYear: number | null;
  headline: string;
  experiencesSummary: string;
  featuredProject: string;
  skills: string[];
  tools: string[];
  interests: string[];
  sectors: string[];
  languages: string[];
  links: TalentLink[];
  updatedAt: number | null;
};

export type TalentProfileInput = {
  university?: string;
  graduationYear?: number | string | null;
  headline?: string;
  experiencesSummary?: string;
  featuredProject?: string;
  skills?: string[];
  tools?: string[];
  interests?: string[];
  sectors?: string[];
  languages?: string[];
  links?: TalentLink[];
};

export type TalentProfileSaveError =
  | "missing"
  | "invalid_year"
  | "invalid_url"
  | "invalid_link_kind"
  | "fields";

export type TalentProfileSaveResult =
  | { ok: true; profile: TalentProfile }
  | { ok: false; error: TalentProfileSaveError };

export type DisseminationDecision = {
  id: number;
  purpose: string;
  policyVersion: string;
  granted: boolean;
  decidedAt: number;
};

export type DisseminationStatus = {
  purpose: string;
  policyVersion: string;
  granted: boolean;
  decidedAt: number | null;
  history: DisseminationDecision[];
};

export type DeletionRequestStatus = "pending" | "in_review" | "resolved";

export type DeletionRequest = {
  id: string;
  accountId: string;
  status: DeletionRequestStatus;
  reason: string;
  resolutionNote: string | null;
  resolvedBy: string | null;
  createdAt: number;
  resolvedAt: number | null;
};

export type RequestDeletionResult =
  | { ok: true; created: boolean; request: DeletionRequest }
  | { ok: false; error: "missing" | "reason_too_long" };

type AccountRow = {
  id: string;
  role: "student" | "organizer";
  firstName: string;
  lastName: string;
  email: string | null;
  degree: string | null;
  course: string | null;
  privacyVersion: string | null;
  privacyAcceptedAt: number | null;
};

type TalentRow = {
  university: string;
  graduationYear: number | null;
  headline: string;
  experiencesSummary: string;
  featuredProject: string;
  skillsJson: string;
  toolsJson: string;
  interestsJson: string;
  sectorsJson: string;
  languagesJson: string;
  updatedAt: number;
};

const defaultLinkLabels: Record<TalentLinkKind, string> = {
  cv: "CV",
  linkedin: "LinkedIn",
  github: "GitHub",
  portfolio: "Portfolio",
  other: "Enlace externo",
};

const validLinkKinds = new Set<string>(TALENT_LINK_KINDS);

// Ensure demo_accounts exists before creating dependent tables.
new SessionStore(db);

db.exec(`
  CREATE TABLE IF NOT EXISTS demo_talent_profiles (
    workspace_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    university TEXT NOT NULL DEFAULT '',
    graduation_year INTEGER,
    headline TEXT NOT NULL DEFAULT '',
    experiences_summary TEXT NOT NULL DEFAULT '',
    featured_project TEXT NOT NULL DEFAULT '',
    skills_json TEXT NOT NULL DEFAULT '[]',
    tools_json TEXT NOT NULL DEFAULT '[]',
    interests_json TEXT NOT NULL DEFAULT '[]',
    sectors_json TEXT NOT NULL DEFAULT '[]',
    languages_json TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, account_id),
    FOREIGN KEY (workspace_id, account_id) REFERENCES demo_accounts (workspace_id, id)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS demo_talent_links (
    workspace_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    position INTEGER NOT NULL CHECK (position > 0),
    kind TEXT NOT NULL CHECK (kind IN ('cv', 'linkedin', 'github', 'portfolio', 'other')),
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    PRIMARY KEY (workspace_id, account_id, position),
    FOREIGN KEY (workspace_id, account_id) REFERENCES demo_talent_profiles (workspace_id, account_id) ON DELETE CASCADE
  ) STRICT;

  CREATE TABLE IF NOT EXISTS demo_talent_dissemination_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
    decided_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id, account_id) REFERENCES demo_accounts (workspace_id, id)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS demo_talent_dissemination_owner
    ON demo_talent_dissemination_decisions (workspace_id, account_id, id DESC);

  CREATE TABLE IF NOT EXISTS demo_deletion_requests (
    workspace_id TEXT NOT NULL,
    id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_review', 'resolved')),
    reason TEXT NOT NULL DEFAULT '',
    resolution_note TEXT,
    resolved_by TEXT,
    created_at INTEGER NOT NULL,
    resolved_at INTEGER,
    PRIMARY KEY (workspace_id, id),
    FOREIGN KEY (workspace_id, account_id) REFERENCES demo_accounts (workspace_id, id)
  ) STRICT;

  CREATE UNIQUE INDEX IF NOT EXISTS demo_deletion_requests_open_account
    ON demo_deletion_requests (workspace_id, account_id)
    WHERE status IN ('pending', 'in_review');
`);

function writeTransaction<Result>(operation: () => Result): Result {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function syntheticEmailFor(role: AccountRow["role"]) {
  return role === "organizer" ? "organizacion.demo@uc3m.es" : "estudiante.demo@alumnos.uc3m.es";
}

function toBasicProfile(row: AccountRow): BasicProfile {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email ?? syntheticEmailFor(row.role),
    degree: row.degree ?? "",
    course: row.course ?? "",
    privacyVersion: row.privacyVersion ?? null,
    privacyAcceptedAt: row.privacyAcceptedAt ?? null,
  };
}

function readAccount(workspaceId: string, accountId: string): AccountRow | undefined {
  return db.prepare(`
    SELECT id, role, first_name AS firstName, last_name AS lastName, email,
      degree, course, privacy_version AS privacyVersion, privacy_accepted_at AS privacyAcceptedAt
    FROM demo_accounts
    WHERE workspace_id = ? AND id = ?
  `).get(workspaceId, accountId) as AccountRow | undefined;
}

function accountExists(workspaceId: string, accountId: string) {
  return Boolean(
    db.prepare("SELECT 1 FROM demo_accounts WHERE workspace_id = ? AND id = ?").get(workspaceId, accountId),
  );
}

function requiredText(value: string, maxLength: number): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function optionalText(value: string | undefined, maxLength: number): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed.length > maxLength) return null;
  return trimmed;
}

export function parseTagList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeTags(tags: string[] | undefined): string[] | null {
  if (!tags) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag) continue;
    if (tag.length > 60) return null;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(tag);
    if (normalized.length > 20) return null;
  }

  return normalized;
}

function parseGraduationYear(value: number | string | null | undefined): { ok: true; value: number | null } | { ok: false } {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { ok: true, value: null };
    if (!/^\d{4}$/.test(trimmed)) return { ok: false };
    const year = Number(trimmed);
    return year >= 1950 && year <= 2100 ? { ok: true, value: year } : { ok: false };
  }
  if (!Number.isInteger(value) || value < 1950 || value > 2100) return { ok: false };
  return { ok: true, value };
}

function isSafeHttpUrl(raw: string): boolean {
  if (!raw || raw.length > 2048 || /[\s\u0000-\u001f]/.test(raw)) return false;
  try {
    const parsed = new URL(raw);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

export function getBasicProfile(workspaceId: string, accountId: string): BasicProfile | null {
  const row = readAccount(workspaceId, accountId);
  return row ? toBasicProfile(row) : null;
}

export function updateBasicProfile(
  workspaceId: string,
  accountId: string,
  input: BasicProfileUpdateInput,
): BasicProfileUpdateResult {
  return writeTransaction(() => {
    const row = readAccount(workspaceId, accountId);
    if (!row) return { ok: false, error: "missing" };

    const currentEmail = (row.email ?? syntheticEmailFor(row.role)).toLowerCase();
    if (input.email !== undefined && input.email.trim().toLowerCase() !== currentEmail) {
      return { ok: false, error: "email_immutable" };
    }
    if ((input.id !== undefined && input.id !== row.id) || (input.role !== undefined && input.role !== row.role)) {
      return { ok: false, error: "identity_immutable" };
    }

    const firstName = requiredText(input.firstName, 80);
    const lastName = requiredText(input.lastName, 120);
    const degree = requiredText(input.degree, 120);
    const course = requiredText(input.course, 40);
    if (!firstName || !lastName || !degree || !course) {
      return { ok: false, error: "fields" };
    }

    db.prepare(`
      UPDATE demo_accounts
      SET first_name = ?, last_name = ?, degree = ?, course = ?
      WHERE workspace_id = ? AND id = ?
    `).run(firstName, lastName, degree, course, workspaceId, accountId);

    const updated = readAccount(workspaceId, accountId)!;
    return { ok: true, profile: toBasicProfile(updated) };
  });
}

function readTalentProfile(workspaceId: string, accountId: string): TalentProfile {
  const row = db.prepare(`
    SELECT university, graduation_year AS graduationYear, headline,
      experiences_summary AS experiencesSummary, featured_project AS featuredProject,
      skills_json AS skillsJson, tools_json AS toolsJson, interests_json AS interestsJson,
      sectors_json AS sectorsJson, languages_json AS languagesJson, updated_at AS updatedAt
    FROM demo_talent_profiles
    WHERE workspace_id = ? AND account_id = ?
  `).get(workspaceId, accountId) as TalentRow | undefined;

  if (!row) {
    return {
      accountId,
      university: "",
      graduationYear: null,
      headline: "",
      experiencesSummary: "",
      featuredProject: "",
      skills: [],
      tools: [],
      interests: [],
      sectors: [],
      languages: [],
      links: [],
      updatedAt: null,
    };
  }

  const links = db.prepare(`
    SELECT kind, label, url
    FROM demo_talent_links
    WHERE workspace_id = ? AND account_id = ?
    ORDER BY position
  `).all(workspaceId, accountId) as TalentLink[];

  return {
    accountId,
    university: row.university,
    graduationYear: row.graduationYear,
    headline: row.headline,
    experiencesSummary: row.experiencesSummary,
    featuredProject: row.featuredProject,
    skills: JSON.parse(row.skillsJson) as string[],
    tools: JSON.parse(row.toolsJson) as string[],
    interests: JSON.parse(row.interestsJson) as string[],
    sectors: JSON.parse(row.sectorsJson) as string[],
    languages: JSON.parse(row.languagesJson) as string[],
    links: links.map((link) => ({ ...link })),
    updatedAt: row.updatedAt,
  };
}

export function getTalentProfile(
  workspaceId: string,
  requesterId: string,
  targetAccountId: string,
): TalentProfile | null {
  if (requesterId !== targetAccountId) return null;
  if (!accountExists(workspaceId, targetAccountId)) return null;
  return readTalentProfile(workspaceId, targetAccountId);
}

export function saveTalentProfile(
  workspaceId: string,
  accountId: string,
  input: TalentProfileInput,
  now = Date.now(),
): TalentProfileSaveResult {
  return writeTransaction(() => {
    if (!accountExists(workspaceId, accountId)) {
      return { ok: false, error: "missing" };
    }

    const university = optionalText(input.university, 120);
    const headline = optionalText(input.headline, 160);
    const experiencesSummary = optionalText(input.experiencesSummary, 2000);
    const featuredProject = optionalText(input.featuredProject, 1000);
    const skills = normalizeTags(input.skills);
    const tools = normalizeTags(input.tools);
    const interests = normalizeTags(input.interests);
    const sectors = normalizeTags(input.sectors);
    const languages = normalizeTags(input.languages);

    if (
      university === null ||
      headline === null ||
      experiencesSummary === null ||
      featuredProject === null ||
      !skills ||
      !tools ||
      !interests ||
      !sectors ||
      !languages
    ) {
      return { ok: false, error: "fields" };
    }

    const parsedYear = parseGraduationYear(input.graduationYear);
    if (!parsedYear.ok) {
      return { ok: false, error: "invalid_year" };
    }

    const rawLinks = input.links ?? [];
    if (rawLinks.length > 10) {
      return { ok: false, error: "fields" };
    }

    const normalizedLinks: TalentLink[] = [];
    for (const link of rawLinks) {
      if (!validLinkKinds.has(link.kind)) {
        return { ok: false, error: "invalid_link_kind" };
      }
      const url = link.url.trim();
      if (!isSafeHttpUrl(url)) {
        return { ok: false, error: "invalid_url" };
      }
      const label = link.label.trim() || defaultLinkLabels[link.kind];
      if (label.length > 80) {
        return { ok: false, error: "fields" };
      }
      normalizedLinks.push({ kind: link.kind, label, url });
    }

    db.prepare(`
      INSERT INTO demo_talent_profiles (
        workspace_id, account_id, university, graduation_year, headline,
        experiences_summary, featured_project, skills_json, tools_json,
        interests_json, sectors_json, languages_json, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (workspace_id, account_id) DO UPDATE SET
        university = excluded.university,
        graduation_year = excluded.graduation_year,
        headline = excluded.headline,
        experiences_summary = excluded.experiences_summary,
        featured_project = excluded.featured_project,
        skills_json = excluded.skills_json,
        tools_json = excluded.tools_json,
        interests_json = excluded.interests_json,
        sectors_json = excluded.sectors_json,
        languages_json = excluded.languages_json,
        updated_at = excluded.updated_at
    `).run(
      workspaceId,
      accountId,
      university,
      parsedYear.value,
      headline,
      experiencesSummary,
      featuredProject,
      JSON.stringify(skills),
      JSON.stringify(tools),
      JSON.stringify(interests),
      JSON.stringify(sectors),
      JSON.stringify(languages),
      now,
    );

    db.prepare("DELETE FROM demo_talent_links WHERE workspace_id = ? AND account_id = ?")
      .run(workspaceId, accountId);

    const insertLink = db.prepare(`
      INSERT INTO demo_talent_links (workspace_id, account_id, position, kind, label, url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    normalizedLinks.forEach((link, index) => {
      insertLink.run(workspaceId, accountId, index + 1, link.kind, link.label, link.url);
    });

    return { ok: true, profile: readTalentProfile(workspaceId, accountId) };
  });
}

export function getDisseminationStatus(workspaceId: string, accountId: string): DisseminationStatus {
  const rows = db.prepare(`
    SELECT id, purpose, policy_version AS policyVersion, granted, decided_at AS decidedAt
    FROM demo_talent_dissemination_decisions
    WHERE workspace_id = ? AND account_id = ?
    ORDER BY id DESC
  `).all(workspaceId, accountId) as {
    id: number;
    purpose: string;
    policyVersion: string;
    granted: number;
    decidedAt: number;
  }[];

  const history: DisseminationDecision[] = rows.map((row) => ({
    id: row.id,
    purpose: row.purpose,
    policyVersion: row.policyVersion,
    granted: row.granted === 1,
    decidedAt: row.decidedAt,
  }));

  const latest = history[0];
  return {
    purpose: latest?.purpose ?? DISSEMINATION_PURPOSE,
    policyVersion: latest?.policyVersion ?? DISSEMINATION_POLICY_VERSION,
    granted: latest?.granted ?? false,
    decidedAt: latest?.decidedAt ?? null,
    history,
  };
}

export function setDisseminationDecision(
  workspaceId: string,
  accountId: string,
  granted: boolean,
  now = Date.now(),
): DisseminationStatus | null {
  return writeTransaction(() => {
    if (!accountExists(workspaceId, accountId)) return null;

    const current = getDisseminationStatus(workspaceId, accountId);
    const latest = current.history[0];
    if (latest && latest.granted === granted && latest.policyVersion === DISSEMINATION_POLICY_VERSION) {
      return current;
    }

    db.prepare(`
      INSERT INTO demo_talent_dissemination_decisions (
        workspace_id, account_id, purpose, policy_version, granted, decided_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(workspaceId, accountId, DISSEMINATION_PURPOSE, DISSEMINATION_POLICY_VERSION, granted ? 1 : 0, now);

    return getDisseminationStatus(workspaceId, accountId);
  });
}

function readDeletionRequestRow(row: DeletionRequest): DeletionRequest {
  return {
    id: row.id,
    accountId: row.accountId,
    status: row.status,
    reason: row.reason,
    resolutionNote: row.resolutionNote ?? null,
    resolvedBy: row.resolvedBy ?? null,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt ?? null,
  };
}

export function requestAccountDeletion(
  workspaceId: string,
  accountId: string,
  reason = "",
  now = Date.now(),
): RequestDeletionResult {
  return writeTransaction(() => {
    if (!accountExists(workspaceId, accountId)) {
      return { ok: false, error: "missing" };
    }

    const existing = db.prepare(`
      SELECT id, account_id AS accountId, status, reason,
        resolution_note AS resolutionNote, resolved_by AS resolvedBy,
        created_at AS createdAt, resolved_at AS resolvedAt
      FROM demo_deletion_requests
      WHERE workspace_id = ? AND account_id = ? AND status IN ('pending', 'in_review')
      LIMIT 1
    `).get(workspaceId, accountId) as DeletionRequest | undefined;

    if (existing) {
      return { ok: true, created: false, request: readDeletionRequestRow(existing) };
    }

    const normalizedReason = optionalText(reason, 1000);
    if (normalizedReason === null) {
      return { ok: false, error: "reason_too_long" };
    }

    const id = randomUUID();
    db.prepare(`
      INSERT INTO demo_deletion_requests (
        workspace_id, id, account_id, status, reason, created_at
      )
      VALUES (?, ?, ?, 'pending', ?, ?)
    `).run(workspaceId, id, accountId, normalizedReason, now);

    return {
      ok: true,
      created: true,
      request: {
        id,
        accountId,
        status: "pending",
        reason: normalizedReason,
        resolutionNote: null,
        resolvedBy: null,
        createdAt: now,
        resolvedAt: null,
      },
    };
  });
}

export function getMyDeletionRequest(
  workspaceId: string,
  requesterId: string,
  targetAccountId = requesterId,
): DeletionRequest | null {
  if (requesterId !== targetAccountId) return null;

  const row = db.prepare(`
    SELECT id, account_id AS accountId, status, reason,
      resolution_note AS resolutionNote, resolved_by AS resolvedBy,
      created_at AS createdAt, resolved_at AS resolvedAt
    FROM demo_deletion_requests
    WHERE workspace_id = ? AND account_id = ?
    ORDER BY CASE WHEN status IN ('pending', 'in_review') THEN 0 ELSE 1 END, created_at DESC, rowid DESC
    LIMIT 1
  `).get(workspaceId, requesterId) as DeletionRequest | undefined;

  return row ? readDeletionRequestRow(row) : null;
}
