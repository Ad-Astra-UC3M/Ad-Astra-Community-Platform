/**
 * @file Server Actions de gestión de actividades. Leen `FormData`, delegan la validación y los
 * permisos, invalidan las vistas afectadas y redirigen al panel.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PublishStatus } from "../../../db/schema";
import {
  type AdminActivityImageInput,
  addActivityImage,
  addActivityShift,
  createAdminActivity,
  deleteShift,
  setActivityStatus,
  updateShiftCapacity,
} from "../../../server/activities/admin";

/**
 * Extrae texto de los formularios de edición para las acciones de este módulo.
 * @param form Datos del formulario recibido.
 * @param name Nombre del campo que se lee.
 * @returns La cadena sin espacios en los extremos o una cadena vacía si falta o es un archivo.
 */
function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Convierte los campos de horario de las acciones de creación y alta de turnos al contrato de la capa
 * de datos.
 * @param raw Fecha recibida del formulario como texto.
 * @returns La marca de tiempo en milisegundos, o `NaN` para que la capa de datos rechace el horario.
 */
function parseTimestamp(raw: string): number {
  if (!raw) return Number.NaN;
  return Date.parse(raw);
}

/**
 * Las acciones de edición llaman a este helper para invalidar con `revalidatePath` el catálogo y las
 * vistas relacionadas del panel.
 * @returns Sin valor. Solicita a Next.js actualizar las rutas afectadas.
 */
function revalidateActivityPaths() {
  revalidatePath("/admin/activities");
  revalidatePath("/admin/attendance");
  revalidatePath("/admin");
  revalidatePath("/activities");
}

/**
 * Atiende el formulario de nueva actividad de `AdminActivitiesPage`. Convierte los campos, llama a
 * `createAdminActivity` y revalida las vistas.
 * @param form Título, descripción, ubicación, estado, horario y aforo iniciales, nombre opcional del
 * turno y hasta dos imágenes.
 * @returns Redirige al panel con `status=created` o el error de creación.
 */
export async function createAdminActivityAction(form: FormData) {
  const title = readField(form, "title");
  const description = readField(form, "description");
  const location = readField(form, "location");
  const rawStatus = readField(form, "status");
  const status: PublishStatus = rawStatus === "draft" ? "draft" : "published";

  const shiftName = readField(form, "shiftName");
  const startsAt = parseTimestamp(readField(form, "startsAt"));
  const endsAt = parseTimestamp(readField(form, "endsAt"));
  const rawCapacity = readField(form, "capacity");
  const capacity = rawCapacity === "" ? null : Number.parseInt(rawCapacity, 10);

  const images: AdminActivityImageInput[] = [];
  for (const pos of [1, 2]) {
    const url = readField(form, `imageUrl${pos}`);
    const alt = readField(form, `imageAlt${pos}`);
    if (url || alt) {
      images.push({ imageUrl: url, imageAlt: alt, position: images.length + 1 });
    }
  }

  const result = await createAdminActivity(
    {
      title,
      description,
      location,
      status,
      ...(shiftName
        ? { shifts: [{ name: shiftName, startsAt, endsAt, capacity }] }
        : { startsAt, endsAt, capacity }),
      images,
    },
  );

  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/activities?status=created");
}

/**
 * Atiende el formulario de nuevo turno del panel. Llama a `addActivityShift` y revalida las vistas.
 * @param form ID de actividad, nombre, horario y aforo. El aforo vacío se convierte en `null`.
 * @returns Redirige con `status=shift_added` o el error del alta.
 */
export async function addActivityShiftAction(form: FormData) {
  const activityId = readField(form, "activityId");
  const name = readField(form, "name");
  const startsAt = parseTimestamp(readField(form, "startsAt"));
  const endsAt = parseTimestamp(readField(form, "endsAt"));
  const rawCapacity = readField(form, "capacity");
  const capacity = rawCapacity === "" ? null : Number.parseInt(rawCapacity, 10);

  const result = await addActivityShift(activityId, {
    name,
    startsAt,
    endsAt,
    capacity,
  });

  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/activities?status=shift_added");
}

/**
 * Atiende el formulario de galería del panel. Llama a `addActivityImage` y revalida las vistas.
 * @param form ID de actividad, URL, texto alternativo y posición que se convierte a entero.
 * @returns Redirige con `status=image_added` o el error de la galería.
 */
export async function addActivityImageAction(form: FormData) {
  const activityId = readField(form, "activityId");
  const imageUrl = readField(form, "imageUrl");
  const imageAlt = readField(form, "imageAlt");
  const position = Number.parseInt(readField(form, "position"), 10);

  const result = await addActivityImage(activityId, {
    imageUrl,
    imageAlt,
    position,
  });

  revalidateActivityPaths();
  if (result !== "saved") {
    redirect(`/admin/activities?error=${encodeURIComponent(result)}`);
  }
  redirect("/admin/activities?status=image_added");
}

/**
 * Atiende el formulario de aforo del panel. Llama a `updateShiftCapacity` y revalida las vistas.
 * @param form ID del turno y aforo. Un campo vacío indica aforo ilimitado.
 * @returns Redirige con `status=capacity_updated` o el error del cambio.
 */
export async function updateShiftCapacityAction(form: FormData) {
  const shiftId = readField(form, "shiftId");
  const rawCapacity = readField(form, "capacity");
  const capacity = rawCapacity === "" ? null : Number.parseInt(rawCapacity, 10);

  const result = await updateShiftCapacity(shiftId, capacity);
  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/activities?status=capacity_updated");
}

/**
 * Atiende el formulario de borrado del panel. Llama a `deleteShift` y revalida las vistas.
 * @param form ID del turno que se solicita eliminar.
 * @returns Redirige con `status=shift_deleted` o el error del borrado.
 */
export async function deleteShiftAction(form: FormData) {
  const shiftId = readField(form, "shiftId");

  const result = await deleteShift(shiftId);
  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/activities?status=shift_deleted");
}

/**
 * Atiende el formulario de publicación del panel. Llama a `setActivityStatus` y revalida las vistas.
 * @param form ID de actividad y estado solicitado. Los valores distintos de `draft` y `archived` se
 * interpretan como `published`.
 * @returns Redirige con `status=activity_<estado>` o el error del cambio.
 */
export async function setActivityStatusAction(form: FormData) {
  const activityId = readField(form, "activityId");
  const rawStatus = readField(form, "status");
  const status: PublishStatus =
    rawStatus === "draft" || rawStatus === "archived" ? rawStatus : "published";

  const result = await setActivityStatus(activityId, status);
  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/admin/activities?status=activity_${status}`);
}
