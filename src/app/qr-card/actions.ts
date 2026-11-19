"use server";

import { redirect } from "next/navigation";
import { reissueCard } from "../../demo/card";
import { requireUser } from "../../demo/session";

export async function reissueMyCard() {
  const user = await requireUser();
  await reissueCard(user.workspaceId, user.id);
  redirect("/qr-card?status=reissued");
}
