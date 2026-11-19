"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAdminOpportunity,
  setAdminOpportunityStatus,
  type OpportunityType,
  type PublishStatus,
} from "../../../server/repositories/admin";
import { requireCapability } from "../access";

function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalDate(raw: string): number | null {
  if (!raw) return null;
  const parsed = Date.parse(`${raw}T23:59:59Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function revalidateOpportunityPaths() {
  revalidatePath("/admin/opportunities");
  revalidatePath("/opportunities");
  revalidatePath("/bookmarks");
}

export async function createAdminOpportunityAction(form: FormData) {
  const editor = await requireCapability("content_editing");
  const rawType = readField(form, "type");
  const type: OpportunityType = rawType === "research" ? "research" : "internship";
  const rawStatus = readField(form, "status");
  const status: PublishStatus = rawStatus === "published" ? "published" : "draft";

  const result = await createAdminOpportunity(
    {
      type,
      title: readField(form, "title"),
      organization: readField(form, "organization"),
      description: readField(form, "description"),
      requirements: readField(form, "requirements") || null,
      location: readField(form, "location") || null,
      workModality: readField(form, "modality") || null,
      researchLead: readField(form, "lead") || null,
      deadlineAt: parseOptionalDate(readField(form, "deadline")),
      applicationUrl: readField(form, "applicationUrl") || null,
      contactEmail: readField(form, "contactEmail") || null,
      imageUrl: readField(form, "imageUrl") || null,
      imageAlt: readField(form, "imageAlt") || null,
      infoUrl: readField(form, "infoUrl") || null,
      status,
    },
    editor.personId,
  );

  revalidateOpportunityPaths();
  if (!result.ok) {
    redirect(`/admin/opportunities?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/opportunities?status=created");
}

export async function setAdminOpportunityStatusAction(form: FormData) {
  const editor = await requireCapability("content_editing");
  const opportunityId = readField(form, "opportunityId");
  const rawStatus = readField(form, "status");
  const status: PublishStatus =
    rawStatus === "draft" || rawStatus === "archived" ? rawStatus : "published";

  const result = await setAdminOpportunityStatus(opportunityId, status, editor.personId);
  revalidateOpportunityPaths();
  if (!result.ok) {
    redirect(`/admin/opportunities?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/admin/opportunities?status=updated_${status}`);
}
