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
