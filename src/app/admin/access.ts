import { notFound } from "next/navigation";
import { type AdminCapability, type DemoUser, currentUser } from "../../demo/session";

export async function requireAdminAny(): Promise<DemoUser> {
  const user = await currentUser();
  if (!user || user.status === "deactivated" || user.capabilities.length === 0) {
    notFound();
  }
  return user;
}

export async function requireCapability(capability: AdminCapability): Promise<DemoUser> {
  const user = await currentUser();
  if (!user || user.status === "deactivated" || !user.capabilities.includes(capability)) {
    notFound();
  }
  return user;
}

export async function requireOrganizer(): Promise<DemoUser> {
  return requireCapability("attendance_validation");
}
