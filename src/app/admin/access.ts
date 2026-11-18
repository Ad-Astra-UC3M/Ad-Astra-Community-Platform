import { notFound } from "next/navigation";
import { currentUser } from "../../demo/session";

export async function requireOrganizer() {
  const user = await currentUser();
  if (user?.role !== "organizer") notFound();
  return user;
}
