/**
 * Server Actions que traducen los formularios del perfil básico, talento y privacidad al
 * contrato de las operaciones. Next.js las invoca con FormData y la sesión identifica al
 * titular en cada escritura.
 */

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

/**
 * Lee los campos de texto que usan las acciones de perfil y el motivo de supresión.
 *
 * @param formData - Campos enviados por el formulario.
 * @param key - Nombre del control que se lee.
 * @returns Texto recibido o cadena vacía si falta o se envió un archivo.
 */
function textField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Lee campos opcionales de la acción de perfil básico preservando la diferencia entre un campo
 * omitido y uno vacío.
 *
 * @param formData - Campos enviados por el formulario.
 * @param key - Nombre del control opcional.
 * @returns Texto recibido, incluso vacío, o undefined si el valor no es texto.
 */
function optionalTextField(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

/**
 * Server Action del formulario de ProfilePage. Pasa los campos editables y los datos de
 * identidad recibidos para que updateMyProfile valide la petición contra el titular de sesión.
 *
 * @param formData - Nombre, apellidos, datos académicos y posibles campos de identidad enviados
 *   por el formulario.
 * @returns Termina con una redirección a /profile que indica si se guardó el perfil o qué error
 *   se produjo.
 */
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

/**
 * Server Action de TalentProfilePage. Arma los enlaces, interpreta etiquetas e idiomas y admite
 * graduationYear como nombre anterior del campo de graduación.
 *
 * @param formData - Universidad, año, titular, experiencia, idiomas, etiquetas y enlaces que se
 *   pasan a saveMyTalentProfile.
 * @returns Termina con una redirección a /profile/talent que indica el guardado o el error.
 */
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

/**
 * Server Action de los formularios de decisión de ProfilePrivacyPage. Delega en
 * updateMyDissemination para el titular de sesión.
 *
 * @param formData - Incluye granted, que la operación valida como autorización o retirada.
 * @returns Termina con una redirección a /profile/privacy que indica la decisión aplicada o el
 *   error.
 */
export async function updateDisseminationAction(formData: FormData) {
  const result = await updateMyDissemination(formData.get("granted"));
  if (!result.ok) redirect(`/profile/privacy?error=${result.error}`);

  redirect(`/profile/privacy?status=${result.granted ? "dissemination_granted" : "dissemination_revoked"}`);
}

/**
 * Server Action del formulario de supresión de ProfilePrivacyPage. Solicita la apertura de un
 * caso para el titular de sesión.
 *
 * @param formData - Incluye el campo reason que requestMyAccountDeletion adjunta a una nueva
 *   solicitud.
 * @returns Termina con una redirección a /profile/privacy que indica alta, solicitud ya abierta
 *   o error.
 */
export async function requestDeletionAction(formData: FormData) {
  const result = await requestMyAccountDeletion(textField(formData, "reason"));
  if (!result.ok) {
    redirect(`/profile/privacy?error=${result.error}`);
  }

  redirect(`/profile/privacy?status=${result.created ? "deletion_created" : "deletion_existing"}`);
}
