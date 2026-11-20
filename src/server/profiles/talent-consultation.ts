import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb, type AppDb, type AppDbOrTx } from "../../db/client";
import { profiles, talentDisseminationDecisions, talentProfiles, type AccountStatus, type TalentLanguage, type TalentLink } from "../../db/schema";
import { formatName, isUuid } from "./identity";
import { DISSEMINATION_PURPOSE, mapExperienceFromDb, normalizeTagList, type TalentExperienceItem } from "./repository";

export interface TalentSearchFilters {
  query?: string;
  tags?: string[];
  now?: Date;
}

export interface TalentProfileSummary {
  personId: string;
  name: string;
  email: string;
  degree: string;
  course: string;
  status: AccountStatus;
  university: string;
  expectedGraduationYear: number | null;
  headline: string;
  skills: string[];
  tools: string[];
  interests: string[];
  sectors: string[];
  opportunityTypes: string[];
  languages: TalentLanguage[];
  disseminationGranted: boolean;
  linksCount: number;
  updatedAt: Date;
}

export interface TalentAdminDetail extends TalentProfileSummary {
  experiences: TalentExperienceItem[];
  links: TalentLink[];
  disseminationDecidedAt: Date | null;
  disseminationValidUntil: Date | null;
  disseminationPolicyVersion: string | null;
}

async function resolveDb(db?: AppDb): Promise<AppDb> {
  return db ?? getDb();
}

async function readLatestDisseminationMap(
  db: AppDbOrTx,
  personIds: string[],
  now: Date,
): Promise<
  Map<
    string,
    {
      granted: boolean;
      decidedAt: Date | null;
      validUntil: Date | null;
      policyVersion: string | null;
    }
  >
> {
  const result = new Map<
    string,
    {
      granted: boolean;
      decidedAt: Date | null;
      validUntil: Date | null;
      policyVersion: string | null;
    }
  >();

  if (personIds.length === 0) return result;

  const rows = await db
    .select()
    .from(talentDisseminationDecisions)
    .where(
      and(
        inArray(talentDisseminationDecisions.personId, personIds),
        eq(talentDisseminationDecisions.purpose, DISSEMINATION_PURPOSE),
      ),
    )
    .orderBy(
      desc(talentDisseminationDecisions.decidedAt),
      desc(talentDisseminationDecisions.id),
    );

  for (const row of rows) {
    if (result.has(row.personId)) continue;
    const expired = Boolean(
      row.validUntil !== null && row.validUntil.getTime() <= now.getTime(),
    );
    result.set(row.personId, {
      granted: row.granted && !expired,
      decidedAt: row.decidedAt,
      validUntil: row.validUntil ?? null,
      policyVersion: row.policyVersion,
    });
  }

  return result;
}

export async function searchTalentProfiles(
  filters: TalentSearchFilters = {},
  db?: AppDb,
): Promise<TalentProfileSummary[]> {
  const database = await resolveDb(db);
  const now = filters.now ?? new Date();
  const normalizedTags = normalizeTagList(filters.tags);

  const whereClause =
    normalizedTags.length > 0
      ? (() => {
          const pgTagArray = sql`ARRAY[${sql.join(
            normalizedTags.map((tag) => sql`${tag}`),
            sql`, `,
          )}]::text[]`;
          return or(
            sql`${talentProfiles.skills} && ${pgTagArray}`,
            sql`${talentProfiles.tools} && ${pgTagArray}`,
            sql`${talentProfiles.interests} && ${pgTagArray}`,
            sql`${talentProfiles.sectors} && ${pgTagArray}`,
            sql`${talentProfiles.opportunityTypes} && ${pgTagArray}`,
          );
        })()
      : undefined;

  const baseSelect = database
    .select({
      personId: talentProfiles.personId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      degree: profiles.degree,
      course: profiles.course,
      status: profiles.status,
      university: talentProfiles.university,
      expectedGraduationYear: talentProfiles.expectedGraduationYear,
      headline: talentProfiles.headline,
      skills: talentProfiles.skills,
      tools: talentProfiles.tools,
      interests: talentProfiles.interests,
      sectors: talentProfiles.sectors,
      opportunityTypes: talentProfiles.opportunityTypes,
      experiences: talentProfiles.experiences,
      languages: talentProfiles.languages,
      links: talentProfiles.links,
      updatedAt: talentProfiles.updatedAt,
    })
    .from(talentProfiles)
    .innerJoin(profiles, eq(profiles.id, talentProfiles.personId));

  const rows = whereClause
    ? await baseSelect
        .where(whereClause)
        .orderBy(
          desc(talentProfiles.updatedAt),
          asc(profiles.firstName),
          asc(profiles.lastName),
        )
    : await baseSelect.orderBy(
        desc(talentProfiles.updatedAt),
        asc(profiles.firstName),
        asc(profiles.lastName),
      );

  const disseminationMap = await readLatestDisseminationMap(
    database,
    rows.map((row) => row.personId),
    now,
  );

  const needle = (filters.query ?? "").trim().toLowerCase();

  return rows
    .map((row) => {
      const name = formatName(row.firstName, row.lastName);
      const dissemination = disseminationMap.get(row.personId);
      const summary: TalentProfileSummary = {
        personId: row.personId,
        name,
        email: row.email,
        degree: row.degree,
        course: row.course,
        status: row.status,
        university: row.university ?? "",
        expectedGraduationYear: row.expectedGraduationYear ?? null,
        headline: row.headline ?? "",
        skills: [...row.skills],
        tools: [...row.tools],
        interests: [...row.interests],
        sectors: [...row.sectors],
        opportunityTypes: [...row.opportunityTypes],
        languages: row.languages.map((entry) => ({ ...entry })),
        disseminationGranted: dissemination?.granted ?? false,
        linksCount: row.links.length,
        updatedAt: row.updatedAt,
      };

      const searchable = [
        name,
        row.email,
        row.degree,
        row.university ?? "",
        row.headline ?? "",
        ...row.skills,
        ...row.tools,
        ...row.interests,
        ...row.sectors,
        ...row.opportunityTypes,
        ...row.experiences.flatMap((exp) => [
          exp.title,
          exp.organization ?? "",
          exp.description ?? "",
        ]),
        ...row.languages.flatMap((lang) => [lang.language, lang.level]),
      ]
        .join(" ")
        .toLowerCase();

      return { summary, searchable };
    })
    .filter((entry) => !needle || entry.searchable.includes(needle))
    .map((entry) => entry.summary);
}

export async function getTalentAdminDetail(
  personId: string,
  db?: AppDb,
  now: Date = new Date(),
): Promise<TalentAdminDetail | null> {
  if (!isUuid(personId)) return null;
  const database = await resolveDb(db);

  const [row] = await database
    .select({
      personId: talentProfiles.personId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      degree: profiles.degree,
      course: profiles.course,
      status: profiles.status,
      university: talentProfiles.university,
      expectedGraduationYear: talentProfiles.expectedGraduationYear,
      headline: talentProfiles.headline,
      skills: talentProfiles.skills,
      tools: talentProfiles.tools,
      interests: talentProfiles.interests,
      sectors: talentProfiles.sectors,
      opportunityTypes: talentProfiles.opportunityTypes,
      experiences: talentProfiles.experiences,
      languages: talentProfiles.languages,
      links: talentProfiles.links,
      updatedAt: talentProfiles.updatedAt,
    })
    .from(talentProfiles)
    .innerJoin(profiles, eq(profiles.id, talentProfiles.personId))
    .where(eq(talentProfiles.personId, personId))
    .limit(1);

  if (!row) return null;

  const disseminationMap = await readLatestDisseminationMap(
    database,
    [personId],
    now,
  );
  const dissemination = disseminationMap.get(personId);

  return {
    personId: row.personId,
    name: formatName(row.firstName, row.lastName),
    email: row.email,
    degree: row.degree,
    course: row.course,
    status: row.status,
    university: row.university ?? "",
    expectedGraduationYear: row.expectedGraduationYear ?? null,
    headline: row.headline ?? "",
    skills: [...row.skills],
    tools: [...row.tools],
    interests: [...row.interests],
    sectors: [...row.sectors],
    opportunityTypes: [...row.opportunityTypes],
    experiences: row.experiences
      .map(mapExperienceFromDb)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    languages: row.languages.map((entry) => ({ ...entry })),
    links: row.links.map((entry) => ({ ...entry })),
    linksCount: row.links.length,
    disseminationGranted: dissemination?.granted ?? false,
    disseminationDecidedAt: dissemination?.decidedAt ?? null,
    disseminationValidUntil: dissemination?.validUntil ?? null,
    disseminationPolicyVersion: dissemination?.policyVersion ?? null,
    updatedAt: row.updatedAt,
  };
}
