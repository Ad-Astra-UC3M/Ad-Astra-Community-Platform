"use server";

import { redirect } from "next/navigation";
import {
  parseLanguageList,
  parseTagList,
  type TalentLink,
  type TalentLinkKind,
} from "../../server/profiles/repository";
import { requestMyAccountDeletion, saveMyTalentProfile, updateMyDissemination, updateMyProfile } from "../../server/profiles/operations";

const fixedLinks: { field: string; kind: TalentLinkKind; label: string }[] = [
  { field: "linkCvUrl", kind: "cv", label: "CV" },
  { field: "linkLinkedinUrl", kind: "linkedin", label: "LinkedIn" },
  { field: "linkGithubUrl", kind: "github", label: "GitHub" },
  { field: "linkPortfolioUrl", kind: "portfolio", label: "Portfolio" },
];

function textField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalTextField(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export async function saveBasicProfileAction(formData: FormData) {
  const result = await updateMyProfile({
    firstName: textField(formData, "firstName"),
    lastName: textField(formData, "lastName"),
    degree: textField(formData, "degree"),
    course: textField(formData, "course"),
    academicLevel: optionalTextField(formData, "academicLevel"),
    languageModality: optionalTextField(formData, "languageModality"),
    email: optionalTextField(formData, "email"),
    role: optionalTextField(formData, "role"),
    id: optionalTextField(formData, "id"),
    status: optionalTextField(formData, "status"),
    authUserId: optionalTextField(formData, "authUserId"),
  });

  if (!result.ok) {
    redirect(`/profile?error=${result.error}`);
  }

  redirect("/profile?status=saved");
}

export async function saveTalentProfileAction(formData: FormData) {
  const links: TalentLink[] = [];

  for (const item of fixedLinks) {
    const url = textField(formData, item.field).trim();
    if (url) {
      links.push({ kind: item.kind, label: item.label, url });
    }
  }

  const otherUrl = textField(formData, "linkOtherUrl").trim();
  if (otherUrl) {
    links.push({
      kind: "other",
      label: textField(formData, "linkOtherLabel").trim() || "Otro enlace",
      url: otherUrl,
    });
  }

  const expectedGraduationYear = formData.has("expectedGraduationYear")
    ? textField(formData, "expectedGraduationYear")
    : textField(formData, "graduationYear");

  const result = await saveMyTalentProfile({
    university: textField(formData, "university"),
    expectedGraduationYear,
    headline: textField(formData, "headline"),
    experiencesSummary: textField(formData, "experiencesSummary"),
    featuredProject: textField(formData, "featuredProject"),
    skills: parseTagList(textField(formData, "skills")),
    tools: parseTagList(textField(formData, "tools")),
    interests: parseTagList(textField(formData, "interests")),
    sectors: parseTagList(textField(formData, "sectors")),
    opportunityTypes: parseTagList(textField(formData, "opportunityTypes")),
    languages: parseLanguageList(textField(formData, "languages")),
    links,
  });

  if (!result.ok) {
    redirect(`/profile/talent?error=${result.error}`);
  }

  redirect("/profile/talent?status=saved");
}

export async function updateDisseminationAction(formData: FormData) {
  const result = await updateMyDissemination(formData.get("granted"));
  if (!result.ok) redirect(`/profile/privacy?error=${result.error}`);

  redirect(`/profile/privacy?status=${result.granted ? "dissemination_granted" : "dissemination_revoked"}`);
}

export async function requestDeletionAction(formData: FormData) {
  const result = await requestMyAccountDeletion(textField(formData, "reason"));
  if (!result.ok) {
    redirect(`/profile/privacy?error=${result.error}`);
  }

  redirect(`/profile/privacy?status=${result.created ? "deletion_created" : "deletion_existing"}`);
}
