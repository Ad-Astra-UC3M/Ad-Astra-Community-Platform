import "server-only";

import { getDeletionRequest, getMyDeletionRequest, listDeletionRequests } from "./deletion-requests";
import { getBasicProfile, getDisseminationStatus, getTalentProfile } from "./repository";
import { getTalentAdminDetail, searchTalentProfiles, type TalentSearchFilters } from "./talent-consultation";
import { requireCapability, requireUser } from "../auth/access";
import { requestAccountDeletion, resolveDeletionRequest } from "./deletion-requests";
import {
  saveTalentProfile,
  setDisseminationDecision,
  updateBasicProfile,
  type BasicProfileUpdateInput,
  type TalentProfileInput,
} from "./repository";

export async function updateMyProfile(input: BasicProfileUpdateInput) {
  const user = await requireUser();
  return updateBasicProfile(user.personId, input);
}

export async function saveMyTalentProfile(input: TalentProfileInput) {
  const user = await requireUser();
  return saveTalentProfile(user.personId, input);
}

export async function updateMyDissemination(decision: unknown) {
  const user = await requireUser();
  if (decision !== "true" && decision !== "false") {
    return { ok: false, error: "invalid_decision" } as const;
  }

  const granted = decision === "true";
  const status = await setDisseminationDecision(user.personId, granted);
  if (!status) return { ok: false, error: "missing" } as const;
  return { ok: true, granted } as const;
}

export async function requestMyAccountDeletion(reason: string) {
  const user = await requireUser();
  return requestAccountDeletion(user.personId, reason);
}

export async function reviewDeletionRequest(
  requestId: string,
  status: "in_review" | "resolved",
  resolutionNote: string,
) {
  const admin = await requireCapability("general_admin");
  if (!requestId) return null;
  return resolveDeletionRequest(requestId, status, resolutionNote, admin.personId);
}

export async function getMyProfile() {
  const user = await requireUser("/profile");
  return getBasicProfile(user.personId);
}

export async function getMyTalentProfile() {
  const user = await requireUser("/profile/talent");
  return getTalentProfile(user.personId, user.personId);
}

export async function getMyPrivacySettings() {
  const user = await requireUser("/profile/privacy");
  const [dissemination, deletionRequest] = await Promise.all([
    getDisseminationStatus(user.personId),
    getMyDeletionRequest(user.personId),
  ]);
  return { dissemination, deletionRequest };
}

export async function searchTalentForConsultation(filters: TalentSearchFilters) {
  await requireCapability("talent_consultation");
  return searchTalentProfiles(filters);
}

export async function getTalentForConsultation(id: string) {
  await requireCapability("talent_consultation");
  return getTalentAdminDetail(id);
}

export async function listDeletionRequestsForReview() {
  await requireCapability("general_admin");
  return listDeletionRequests();
}

export async function getDeletionRequestForReview(id: string) {
  await requireCapability("general_admin");
  return getDeletionRequest(id);
}
