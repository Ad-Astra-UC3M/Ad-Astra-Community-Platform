import { redirect } from "next/navigation";
import { CommunityLanding } from "../components/community-landing";
import { currentUser, demoStudent } from "../demo/session";

export default async function CommunityPage() {
  if (await currentUser()) redirect("/home");
  return <CommunityLanding enterDemo={demoStudent} />;
}
