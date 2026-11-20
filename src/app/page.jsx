import { redirect } from "next/navigation";
import { CommunityLanding } from "../components/community-landing";
import { currentUser } from "../server/auth/access";

export default async function CommunityPage() {
  if (await currentUser()) redirect("/home");
  return <CommunityLanding />;
}
