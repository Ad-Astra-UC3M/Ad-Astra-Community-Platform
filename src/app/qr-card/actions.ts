"use server";

import { redirect } from "next/navigation";
import { reissueMyCard as reissueCard } from "../../server/activities/card";

export async function reissueMyCard() {
  await reissueCard();
  redirect("/qr-card?status=reissued");
}
