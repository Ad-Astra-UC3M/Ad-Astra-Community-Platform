"use server";

import { redirect } from "next/navigation";
import {
  parseTagList,
  requestAccountDeletion,
  saveTalentProfile,
  setDisseminationDecision,
  type TalentLink,
  type TalentLinkKind,
  updateBasicProfile,
} from "../../demo/profile";
import { requireUser } from "../../demo/session";

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
  const user = await requireUser();
  const result = updateBasicProfile(user.workspaceId, user.id, {
    firstName: textField(formData, "firstName"),
    lastName: textField(formData, "lastName"),
    degree: textField(formData, "degree"),
    course: textField(formData, "course"),
    email: optionalTextField(formData, "email"),
    role: optionalTextField(formData, "role"),
    id: optionalTextField(formData, "id"),
  });

  if (!result.ok) {
    redirect(`/profile?error=${result.error}`);
  }

  redirect("/profile?status=saved");
}

export async function saveTalentProfileAction(formData: FormData) {
  const user = await requireUser();
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

  const result = saveTalentProfile(user.workspaceId, user.id, {
    university: textField(formData, "university"),
    graduationYear: textField(formData, "graduationYear"),
    headline: textField(formData, "headline"),
    experiencesSummary: textField(formData, "experiencesSummary"),
    featuredProject: textField(formData, "featuredProject"),
    skills: parseTagList(textField(formData, "skills")),
    tools: parseTagList(textField(formData, "tools")),
    interests: parseTagList(textField(formData, "interests")),
    sectors: parseTagList(textField(formData, "sectors")),
    languages: parseTagList(textField(formData, "languages")),
    links,
  });

  if (!result.ok) {
    redirect(`/profile/talent?error=${result.error}`);
  }

  redirect("/profile/talent?status=saved");
}

export async function updateDisseminationAction(formData: FormData) {
  const user = await requireUser();
  const decision = formData.get("granted");
  if (decision !== "true" && decision !== "false") {
    redirect("/profile/privacy?error=invalid_decision");
  }

  const granted = decision === "true";
  const status = setDisseminationDecision(user.workspaceId, user.id, granted);
  if (!status) {
    redirect("/profile/privacy?error=missing");
  }

  redirect(`/profile/privacy?status=${granted ? "dissemination_granted" : "dissemination_revoked"}`);
}

export async function requestDeletionAction(formData: FormData) {
  const user = await requireUser();
  const result = requestAccountDeletion(user.workspaceId, user.id, textField(formData, "reason"));
  if (!result.ok) {
    redirect(`/profile/privacy?error=${result.error}`);
  }

  redirect(`/profile/privacy?status=${result.created ? "deletion_created" : "deletion_existing"}`);
}
