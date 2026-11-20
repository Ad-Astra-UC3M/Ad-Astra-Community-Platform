import "server-only";

import { requireUser } from "../auth/access";
import { cancelReservation, changeReservation, reserveShift } from "./participation";
import { getActivity, listActivities, listReservations } from "./portal-data";

export async function listMyVisibleActivities() {
  const user = await requireUser("/activities");
  return listActivities(user.personId);
}

export async function getMyVisibleActivity(id: string) {
  const user = await requireUser(`/activities/${encodeURIComponent(id)}`);
  return getActivity(id, user.personId);
}

export async function listMyReservations() {
  const user = await requireUser("/my-activities");
  return listReservations(user.personId);
}

export async function reserveMyShift(activityId: string, shiftId: unknown) {
  const user = await requireUser();
  if (typeof shiftId !== "string" || !shiftId) return "missing";
  return reserveShift(activityId, shiftId, user.personId);
}

export async function cancelMyReservation(shiftId: unknown) {
  const user = await requireUser();
  if (typeof shiftId !== "string" || !shiftId) return "missing";
  return cancelReservation(user.personId, shiftId);
}

export async function changeMyReservation(fromShiftId: unknown, toShiftId: unknown) {
  const user = await requireUser();
  if (typeof fromShiftId !== "string" || typeof toShiftId !== "string") return "missing";
  return changeReservation(user.personId, fromShiftId, toShiftId);
}
