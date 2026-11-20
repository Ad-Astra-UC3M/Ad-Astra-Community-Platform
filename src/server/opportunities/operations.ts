import "server-only";

import { getOpportunity, listAdminOpportunities, listBookmarks, listOpportunities, type OpportunityType } from "./repository";
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

export async function listVisibleOpportunities(type?: OpportunityType) {
  const nextPath = type ? "/opportunities?type=" + type : "/opportunities";
  const user = await requireUser(nextPath);
  return listOpportunities(user.personId, type);
}

export async function getVisibleOpportunity(id: string) {
  const user = await requireUser("/opportunities/" + encodeURIComponent(id));
  const opportunity = await getOpportunity(id, user.personId);
  return opportunity?.status === "published" ? opportunity : null;
}

export async function listMyBookmarks() {
  const user = await requireUser("/bookmarks");
  return listBookmarks(user.personId);
}

export async function listOpportunitiesForEditing() {
  await requireCapability("content_editing");
  return listAdminOpportunities();
}
