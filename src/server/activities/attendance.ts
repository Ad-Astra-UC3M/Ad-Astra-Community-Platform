/**
 * @file Entrada del panel de asistencia. Cada operación exige `attendance_validation`. Las escrituras
 * atribuyen la actuación al perfil de la sesión.
 */

import "server-only";

import type { ParticipationStatus } from "../../db/schema";
import { requireCapability } from "../auth/access";
import * as data from "./attendance-data";
import { verifyCard } from "./card-data";
import { checkIn, type CheckInResult } from "./participation";

export type CardValidationResult = CheckInResult | "invalid_card";

/**
 * Comprueba el permiso de asistencia y carga los datos de `AdminAttendanceIndexPage`.
 * @returns Los turnos con ocupación, plazas libres y asistencias confirmadas.
 */
export async function listShiftSummaries() {
  await requireCapability("attendance_validation");
  return data.listShiftSummaries();
}

/**
 * Carga los datos de `AttendancePage`. Tras localizar el turno, consulta en paralelo las
 * participaciones, las cuentas candidatas y la auditoría.
 * @param shiftId UUID del turno seleccionado.
 * @param attendeeQuery Filtro que se pasa a la consulta de participantes inscritos.
 * @param accountQuery Filtro que se pasa a la consulta de cuentas candidatas para puerta.
 * @returns El resumen y las tres listas del detalle, o `null` si el turno no existe.
 */
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

/**
 * Atiende a la acción `validateCard` del escáner. Verifica la tarjeta y confirma la asistencia de su
 * titular con `checkIn`.
 * @param shiftId Turno en el que se valida la asistencia.
 * @param token Campo del formulario con la tarjeta que se pasa a `verifyCard` si es texto.
 * @returns `invalid_card` si la tarjeta falla la verificación o un código de `checkIn`.
 */
export async function validateAttendanceCard(shiftId: string, token: unknown): Promise<CardValidationResult> {
  const organizer = await requireCapability("attendance_validation");
  const personId = typeof token === "string" ? await verifyCard(token) : null;
  if (!personId) return "invalid_card";
  return checkIn(shiftId, personId, organizer.personId);
}

/**
 * Atiende a `registerAtDoorAction`. Usa la sesión como actor del alta y delega en `attendance-data.ts`.
 * @param shiftId Turno que recibe la inscripción de puerta.
 * @param personId ID de la cuenta elegida en el formulario.
 * @param reason Motivo obligatorio registrado en la auditoría.
 * @returns La participación `booked` creada o un código de error.
 */
export async function registerAtDoor(shiftId: string, personId: string, reason: string) {
  const organizer = await requireCapability("attendance_validation");
  return data.registerAtDoor(shiftId, personId, organizer.personId, reason);
}

/**
 * Atiende a `confirmManualAttendanceAction` y delega la confirmación manual con el actor de la sesión.
 * @param shiftId Turno en el que está la participación.
 * @param personId Persona cuya asistencia se confirma.
 * @param reason Motivo obligatorio de la confirmación para la auditoría.
 * @returns La asistencia confirmada o un código de error.
 */
export async function manualConfirmAttendance(shiftId: string, personId: string, reason: string) {
  const organizer = await requireCapability("attendance_validation");
  return data.manualConfirmAttendance(shiftId, personId, organizer.personId, reason);
}

/**
 * Atiende a `correctAttendanceAction` y delega la rectificación con el actor de la sesión.
 * @param shiftId Turno en el que está la participación.
 * @param personId Persona cuyo registro se actualiza.
 * @param targetStatus Nuevo estado `booked` o `attended` de la participación.
 * @param reason Motivo obligatorio de la rectificación para la auditoría.
 * @returns La transición de estado aplicada o un código de error.
 */
export async function correctAttendance(
  shiftId: string,
  personId: string,
  targetStatus: ParticipationStatus,
  reason: string,
) {
  const organizer = await requireCapability("attendance_validation");
  return data.correctAttendance(shiftId, personId, targetStatus, organizer.personId, reason);
}
