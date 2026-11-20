"use server";

import { redirect } from "next/navigation";
import { removeMyBookmark, saveMyBookmark } from "../../server/opportunities/operations";

function safeReturnPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/opportunities";
  if (value === "/opportunities" || value === "/bookmarks") return value;
  if (value === "/opportunities?type=internship" || value === "/opportunities?type=research") return value;
  if (/^\/opportunities\/[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)) return value;
  return "/opportunities";
}

function redirectWithStatus(path: string, status: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}status=${encodeURIComponent(status)}`);
}

export async function saveOpportunityBookmark(formData: FormData) {
  const opportunityId = formData.get("opportunityId");
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const result = await saveMyBookmark(typeof opportunityId === "string" ? opportunityId : "");

  redirectWithStatus(returnTo, result);
}

export async function removeOpportunityBookmark(formData: FormData) {
  const opportunityId = formData.get("opportunityId");
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const result = await removeMyBookmark(typeof opportunityId === "string" ? opportunityId : "");

  redirectWithStatus(returnTo, result);
}
