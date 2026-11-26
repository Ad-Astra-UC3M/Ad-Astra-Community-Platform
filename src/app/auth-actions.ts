/**
 * @file Entradas de los formularios de cuenta. Next.js ejecuta las funciones exportadas como Server
 * Actions. Las acciones adaptan FormData y las redirecciones. service.ts aplica las reglas de Comunidad y
 * neon-auth.ts se comunica con el proveedor.
 */

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db/client";
import { getAuthProvider } from "../server/auth/neon-auth";
import { readOptionalNextPath, setAccountCodeEmail } from "../server/auth/form-context";
import { normalizeUc3mEmail } from "../server/auth/uc3m";
import {
  authenticateAccount,
  completePasswordReset,
  registerAccount,
  requestPasswordReset,
  resendAccountVerification,
  resolveCurrentUser,
  verifyAccountEmail,
  type AuthUser,
} from "../server/auth/service";

/**
 * Lee un campo textual para las acciones de cuenta.
 *
 * @param formData - Formulario recibido por Next.js.
 * @param key - Atributo name del campo que se busca.
 * @returns Texto recibido o una cadena vacía cuando falta o es un archivo.
 */
function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Usa redirect de Next.js para terminar una acción y navegar, conservando un destino seguro.
 *
 * @param path - Ruta a la que se navega ahora.
 * @param params - Avisos o códigos de error que mostrará esa página.
 * @param next - Destino interno opcional que se conserva para después.
 */
function redirectWithNext(
  path: string,
  params: Record<string, string>,
  next?: string,
): never {
  const query = new URLSearchParams(params);
  const safeNext = readOptionalNextPath(next);
  if (safeNext) query.set("next", safeNext);
  redirect(path + "?" + query.toString());
}

/**
 * Escoge la ruta tras iniciar sesión o verificar el correo.
 *
 * @param user - Usuario resuelto. Sus capacidades determinan la página por defecto.
 * @param next - Destino interno ya validado, si existe.
 * @returns El destino pedido, el panel para una cuenta con capacidades o el inicio del portal.
 */
function accountDestination(user: AuthUser, next: string): string {
  return next || (user.capabilities.length > 0 ? "/admin" : "/home");
}

/**
 * Impide ejecutar acciones de acceso, alta, verificación o recuperación cuando la petición ya
 * tiene una sesión activa de Comunidad y redirige a `/home`.
 */
async function redirectIfAuthenticated(): Promise<void> {
  const jar = await cookies();
  if (jar.getAll().length === 0) return;
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  if (await resolveCurrentUser(db, authProvider)) {
    redirect("/home");
  }
}

/**
 * Recibe el formulario de SignUpPage, adapta sus campos y llama a registerAccount. Redirige a la
 * verificación, al acceso o al formulario con error.
 *
 * @param formData - Nombre, apellidos, correo, datos académicos, contraseña y aceptación del aviso que se
 * envían al servicio.
 */
export async function signUp(formData: FormData): Promise<never> {
  await redirectIfAuthenticated();
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  const result = await registerAccount(db, authProvider, {
    firstName: readFormString(formData, "firstName"),
    lastName: readFormString(formData, "lastName"),
    email: readFormString(formData, "email"),
    degree: readFormString(formData, "degree"),
    course: readFormString(formData, "course"),
    academicLevel: readFormString(formData, "academicLevel") || null,
    languageModality: readFormString(formData, "languageModality") || null,
    password: readFormString(formData, "password"),
    privacyAccepted: formData.get("privacy") === "accepted",
  });

  if (!result.ok) {
    redirect("/sign-up?error=" + encodeURIComponent(result.error));
  }
  if (!result.verificationRequired) {
    redirect("/sign-in");
  }

  await setAccountCodeEmail("verification", result.email);
  redirectWithNext("/verify-email", { sent: "1" });
}

/**
 * Recibe el formulario de SignInPage y llama a authenticateAccount. Lleva al destino protegido, a la
 * verificación pendiente o al formulario con error.
 *
 * @param formData - Correo y contraseña que se validan. next indica el destino al que volver tras el
 * acceso.
 */
export async function signIn(formData: FormData): Promise<never> {
  await redirectIfAuthenticated();
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  const email = readFormString(formData, "email");
  const result = await authenticateAccount(
    db,
    authProvider,
    email,
    readFormString(formData, "password"),
  );
  const next = readOptionalNextPath(readFormString(formData, "next"));

  if (!result.ok) {
    if (result.error === "unverified") {
      await setAccountCodeEmail("verification", email);
      redirectWithNext("/verify-email", { pending: "1" }, next);
    }

    redirectWithNext("/sign-in", { error: result.error }, next);
  }

  redirect(accountDestination(result.user, next));
}

/**
 * Acción del botón «Cerrar sesión» del menú de cuenta y del menú móvil de Navbar. Pide al proveedor cerrar la sesión asociada a la petición y
 * redirige a la portada.
 */
export async function signOut(): Promise<never> {
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  await authProvider.signOut();
  redirect("/");
}

/**
 * Recibe el formulario de VerifyEmailView y llama a verifyAccountEmail. Actualiza el contexto del
 * formulario y navega según se haya creado una sesión.
 *
 * @param formData - Correo y OTP que forman el desafío de verificación. next conserva el destino tras
 * completarlo.
 */
export async function verifyEmailAction(formData: FormData): Promise<never> {
  await redirectIfAuthenticated();
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  const email = readFormString(formData, "email");
  const next = readFormString(formData, "next");
  const result = await verifyAccountEmail(db, authProvider, {
    email,
    otp: readFormString(formData, "otp"),
  });

  if (!result.ok) {
    await setAccountCodeEmail("verification", email);
    redirectWithNext("/verify-email", { error: result.error }, next);
  }

  await setAccountCodeEmail("verification", "");
  if (result.sessionUser) {
    redirect(accountDestination(result.sessionUser, readOptionalNextPath(next)));
  }
  redirectWithNext("/sign-in", { verified: "1" }, next);
}

/**
 * Recibe el formulario de reenvío. Valida el correo UC3M y delega en resendAccountVerification para
 * conservar una respuesta uniforme.
 *
 * @param formData - Correo de destino y next opcional para retomar el recorrido.
 */
export async function resendVerificationAction(
  formData: FormData,
): Promise<never> {
  await redirectIfAuthenticated();
  const next = readFormString(formData, "next");
  const email = normalizeUc3mEmail(readFormString(formData, "email"));
  if (!email) {
    redirectWithNext("/verify-email", { error: "email" }, next);
  }

  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  await resendAccountVerification(db, authProvider, email);

  await setAccountCodeEmail("verification", email);
  redirectWithNext("/verify-email", { resent: "1" }, next);
}

/**
 * Recibe el formulario de recuperación y llama a requestPasswordReset. Guarda el correo temporalmente y
 * abre el formulario que pide el código.
 *
 * @param formData - Correo que el servicio usa para comprobar la elegibilidad del perfil.
 */
export async function requestPasswordResetAction(
  formData: FormData,
): Promise<never> {
  await redirectIfAuthenticated();
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  const email = readFormString(formData, "email");
  await requestPasswordReset(db, authProvider, email);

  await setAccountCodeEmail("recovery", email);
  redirect("/reset-password?sent=1");
}

/**
 * Llama a completePasswordReset desde ResetPasswordPage. En éxito borra el contexto de recuperación, cierra
 * la sesión de esta petición y dirige a acceso.
 *
 * @param formData - Correo, OTP de recuperación, contraseña nueva y confirmación. Los valida el servicio.
 */
export async function resetPasswordAction(formData: FormData): Promise<never> {
  await redirectIfAuthenticated();
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  const email = readFormString(formData, "email");
  const result = await completePasswordReset(db, authProvider, {
    email,
    otp: readFormString(formData, "otp"),
    password: readFormString(formData, "password"),
    confirmPassword: readFormString(formData, "confirmPassword"),
  });

  if (!result.ok) {
    await setAccountCodeEmail("recovery", email);
    redirect("/reset-password?error=" + encodeURIComponent(result.error));
  }

  await setAccountCodeEmail("recovery", "");
  await authProvider.signOut().catch(() => undefined);
  redirect("/sign-in?reset=ok");
}
