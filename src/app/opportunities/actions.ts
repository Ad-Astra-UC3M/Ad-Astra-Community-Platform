"use server";

import { redirect } from "next/navigation";
import { requireUser } from "../../lib/auth/session";
import { removeBookmark, saveBookmark } from "../../server/repositories/opportunities";

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
  const user = await requireUser();
  const opportunityId = formData.get("opportunityId");
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const result =
    typeof opportunityId === "string" && opportunityId
      ? await saveBookmark(user.personId, opportunityId)
      : "missing";

  redirectWithStatus(returnTo, result);
}

export async function removeOpportunityBookmark(formData: FormData) {
  const user = await requireUser();
  const opportunityId = formData.get("opportunityId");
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const result =
    typeof opportunityId === "string" && opportunityId
      ? await removeBookmark(user.personId, opportunityId)
      : "missing";

  redirectWithStatus(returnTo, result);
}
