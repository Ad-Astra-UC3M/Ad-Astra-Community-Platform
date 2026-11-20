import { redirect } from "next/navigation";
import { CommunityLanding } from "../components/community-landing";
import { currentUser } from "../lib/auth/session";

export default async function CommunityPage() {
  if (await currentUser()) redirect("/home");
  return <CommunityLanding />;
}
