import "server-only";

import { requireUser } from "../auth/access";
import { issueCard, reissueCard } from "./card-data";

export async function issueMyCard() {
  const user = await requireUser("/qr-card");
  const card = await issueCard(user.personId);
  return { ...card, holderName: user.name };
}

export async function reissueMyCard() {
  const user = await requireUser();
  return reissueCard(user.personId);
}
