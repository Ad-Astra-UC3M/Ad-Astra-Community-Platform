import type { PublishStatus } from "../../db/schema";
import { requireCapability, requireUser } from "../auth/access";
import {
  createAdminOpportunity,
  removeBookmark,
  saveBookmark,
  setAdminOpportunityStatus,
  type CreateAdminOpportunityInput,
} from "./repository";

export async function createOpportunityForEditing(input: CreateAdminOpportunityInput) {
  const editor = await requireCapability("content_editing");
  return createAdminOpportunity(input, editor.personId);
}

export async function changeOpportunityStatus(opportunityId: string, status: PublishStatus) {
  const editor = await requireCapability("content_editing");
  return setAdminOpportunityStatus(opportunityId, status, editor.personId);
}

export async function saveMyBookmark(opportunityId: string) {
  const user = await requireUser();
  return saveBookmark(user.personId, opportunityId);
}

export async function removeMyBookmark(opportunityId: string) {
  const user = await requireUser();
  return opportunityId ? removeBookmark(user.personId, opportunityId) : "missing";
}
