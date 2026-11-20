import "server-only";

import type { ParticipationStatus } from "../../db/schema";
import { requireCapability } from "../auth/access";
import * as data from "./attendance-data";
import { verifyCard } from "./card-data";
import { checkIn, type CheckInResult } from "./participation";

export type CardValidationResult = CheckInResult | "invalid_card";

export async function listShiftSummaries() {
  await requireCapability("attendance_validation");
  return data.listShiftSummaries();
}

export async function getAttendanceShift(shiftId: string, attendeeQuery: string, accountQuery: string) {
  await requireCapability("attendance_validation");
  const shift = await data.getShiftDetail(shiftId);
  if (!shift) return null;

  const [attendees, doorAccounts, auditEntries] = await Promise.all([
    data.listShiftAttendeesDetailed(shiftId, attendeeQuery),
    data.listActiveAccountsForDoor(shiftId, accountQuery),
    data.listAttendanceAudit(shiftId),
  ]);
  return { shift, attendees, doorAccounts, auditEntries };
}

export async function validateAttendanceCard(shiftId: string, token: unknown): Promise<CardValidationResult> {
  const organizer = await requireCapability("attendance_validation");
  const personId = typeof token === "string" ? await verifyCard(token) : null;
  if (!personId) return "invalid_card";
  return checkIn(shiftId, personId, organizer.personId);
}

export async function registerAtDoor(shiftId: string, personId: string, reason: string) {
  const organizer = await requireCapability("attendance_validation");
  return data.registerAtDoor(shiftId, personId, organizer.personId, reason);
}

export async function manualConfirmAttendance(shiftId: string, personId: string, reason: string) {
  const organizer = await requireCapability("attendance_validation");
  return data.manualConfirmAttendance(shiftId, personId, organizer.personId, reason);
}

export async function correctAttendance(
  shiftId: string,
  personId: string,
  targetStatus: ParticipationStatus,
  reason: string,
) {
  const organizer = await requireCapability("attendance_validation");
  return data.correctAttendance(shiftId, personId, targetStatus, organizer.personId, reason);
}
