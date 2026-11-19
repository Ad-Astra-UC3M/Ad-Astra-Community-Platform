"use server";

import { redirect } from "next/navigation";
import { requireUser } from "../../lib/auth/session";
import { reissueCard } from "../../server/services/attendance-card";

export async function reissueMyCard() {
  const user = await requireUser();
  await reissueCard(user.personId);
  redirect("/qr-card?status=reissued");
}
