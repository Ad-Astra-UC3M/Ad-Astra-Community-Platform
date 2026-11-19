import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import {
  ALL_CAPABILITIES,
  type AccountStatus,
  type AdminCapability,
  type CapabilityAuditEntry,
  type DemoUser,
  SessionStore,
  isAdminCapability,
  opaqueToken,
  readPasswordReset,
  readPasswordResetRequest,
  readSignIn,
  readSignUp,
  resetSeconds,
  sanitizeNextPath,
  sessionSeconds,
  tokenHash,
  verificationSeconds,
} from "./session-store";

export {
  ALL_CAPABILITIES,
  SessionStore,
  isAdminCapability,
  sanitizeNextPath,
  type AccountStatus,
  type AdminCapability,
  type CapabilityAuditEntry,
  type DemoUser,
};

type CookieJar = Awaited<ReturnType<typeof cookies>>;

const store = new SessionStore(db);
const workspaceCookie = "community_demo_workspace";
const sessionCookie = "community_demo_session";
const verificationCookie = "community_demo_verification";
const resetCookie = "community_demo_reset";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export function getCapabilities(workspaceId: string, accountId: string): AdminCapability[] {
  return store.getCapabilities(workspaceId, accountId);
}

export function setCapability(
  workspaceId: string,
  targetAccountId: string,
  capability: AdminCapability,
  enabled: boolean,
  actorId: string,
  now?: number,
): void {
  store.setCapability(workspaceId, targetAccountId, capability, enabled, actorId, now);
}

export function listCapabilityAudit(workspaceId: string, targetAccountId?: string): CapabilityAuditEntry[] {
  return store.listCapabilityAudit(workspaceId, targetAccountId);
}

export function setAccountStatus(
  workspaceId: string,
  targetAccountId: string,
  status: AccountStatus,
  actorId: string,
  now?: number,
): boolean {
  return store.setAccountStatus(workspaceId, targetAccountId, status, actorId, now);
}

export function isAccountActive(workspaceId: string, accountId: string): boolean {
  return store.isAccountActive(workspaceId, accountId);
}

export function requestPasswordReset(
  workspaceId: string,
  email: string,
  resetToken: string,
  now?: number,
): boolean {
  return store.requestPasswordReset(workspaceId, email, resetToken, now);
}

export function hasPendingPasswordReset(workspaceId: string, token: string, now?: number): boolean {
  return store.hasPendingPasswordReset(workspaceId, token, now);
}

export function resetPassword(
  workspaceId: string,
  token: string,
  newPassword: string,
  now?: number,
): boolean {
  return store.resetPassword(workspaceId, token, newPassword, now);
}

function readToken(jar: CookieJar, name: string) {
  const token = jar.get(name)?.value;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

function workspaceFrom(jar: CookieJar) {
  const token = readToken(jar, workspaceCookie);
  return token ? tokenHash(token) : null;
}

function ensureWorkspace(jar: CookieJar) {
  const existing = workspaceFrom(jar);
  if (existing) return existing;
  const token = opaqueToken();
  jar.set(workspaceCookie, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 });
  return tokenHash(token);
}

function startSession(jar: CookieJar, user: DemoUser, destination?: string): never {
  const previous = readToken(jar, sessionCookie);
  const token = store.openSession(user);
  if (previous) store.closeSession(user.workspaceId, previous);
  jar.set(sessionCookie, token, { ...cookieOptions, maxAge: sessionSeconds });
  const defaultPath = user.role === "organizer" ? "/admin" : "/home";
  redirect(destination ? sanitizeNextPath(destination, defaultPath) : defaultPath);
}

export async function currentUser(): Promise<DemoUser | null> {
  const jar = await cookies();
  const workspaceId = workspaceFrom(jar);
  const token = readToken(jar, sessionCookie);
  return workspaceId && token ? store.sessionUser(workspaceId, token) : null;
}

export async function requireUser(nextPath?: string): Promise<DemoUser> {
  const user = await currentUser();
  if (!user) {
    redirect(
      nextPath
        ? "/sign-in?next=" + encodeURIComponent(sanitizeNextPath(nextPath, "/home"))
        : "/sign-in",
    );
  }
  return user;
}

export async function signUp(form: FormData) {
  "use server";

  const result = readSignUp(form);
  if (!result.ok) redirect("/sign-up?error=" + result.error);

  const jar = await cookies();
  const workspaceId = ensureWorkspace(jar);
  const token = opaqueToken();
  if (!store.createAccount(workspaceId, result.input, token)) redirect("/sign-up?error=duplicate");

  jar.set(verificationCookie, token, { ...cookieOptions, maxAge: verificationSeconds });
  redirect("/verify-email");
}

export async function hasPendingVerification() {
  const jar = await cookies();
  const workspaceId = workspaceFrom(jar);
  const token = readToken(jar, verificationCookie);
  return Boolean(workspaceId && token && store.hasPendingVerification(workspaceId, token));
}

export async function verifyEmail() {
  "use server";

  const jar = await cookies();
  const workspaceId = workspaceFrom(jar);
  const token = readToken(jar, verificationCookie);
  const user = workspaceId && token ? store.verifyAccount(workspaceId, token) : null;
  jar.delete(verificationCookie);
  if (!user) redirect("/verify-email");

  startSession(jar, user);
}

export async function signIn(form: FormData) {
  "use server";

  const credentials = readSignIn(form);
  const jar = await cookies();
  const workspaceId = workspaceFrom(jar);
  const user = workspaceId && credentials
    ? store.signIn(workspaceId, credentials.email, credentials.password)
    : null;
  if (!user) {
    const rawNext = form.get("next");
    const candidate = typeof rawNext === "string" ? rawNext.trim() : "";
    const preserved = candidate && sanitizeNextPath(candidate, "/home") === candidate ? candidate : null;
    redirect(
      preserved
        ? "/sign-in?error=credentials&next=" + encodeURIComponent(preserved)
        : "/sign-in?error=credentials",
    );
  }

  const defaultPath = user.role === "organizer" ? "/admin" : "/home";
  startSession(jar, user, sanitizeNextPath(form.get("next"), defaultPath));
}

export async function hasPendingBrowserPasswordReset() {
  const jar = await cookies();
  const workspaceId = workspaceFrom(jar);
  const token = readToken(jar, resetCookie);
  return Boolean(workspaceId && token && store.hasPendingPasswordReset(workspaceId, token));
}

export async function submitPasswordResetRequest(form: FormData) {
  "use server";

  const parsed = readPasswordResetRequest(form);
  const jar = await cookies();
  const workspaceId = workspaceFrom(jar);
  if (workspaceId && parsed) {
    const token = opaqueToken();
    if (store.requestPasswordReset(workspaceId, parsed.email, token)) {
      jar.set(resetCookie, token, { ...cookieOptions, maxAge: resetSeconds });
    } else {
      jar.delete(resetCookie);
    }
  } else {
    jar.delete(resetCookie);
  }
  redirect("/forgot-password?sent=1");
}

export async function submitPasswordReset(form: FormData) {
  "use server";

  const parsed = readPasswordReset(form);
  if (!parsed.ok) redirect("/reset-password?error=" + parsed.error);

  const jar = await cookies();
  const workspaceId = workspaceFrom(jar);
  const token = readToken(jar, resetCookie);
  const ok = workspaceId && token ? store.resetPassword(workspaceId, token, parsed.password) : false;
  jar.delete(resetCookie);
  if (!ok) redirect("/reset-password?error=invalid");

  jar.delete(sessionCookie);
  redirect("/sign-in?reset=ok");
}

export async function toggleCurrentCapability(form: FormData) {
  "use server";

  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "organizer" && user.capabilities.length === 0) return;

  const rawCapability = form.get("capability");
  if (!isAdminCapability(rawCapability)) return;
  const enabled = form.get("enabled") === "true";
  store.setCapability(user.workspaceId, user.id, rawCapability, enabled, user.id);
  revalidatePath("/", "layout");
}

async function enterDemo(role: DemoUser["role"]) {
  const jar = await cookies();
  const workspaceId = ensureWorkspace(jar);
  startSession(jar, store.demoUser(workspaceId, role));
}

export async function demoStudent() {
  "use server";

  await enterDemo("student");
}

export async function demoOrganizer() {
  "use server";

  await enterDemo("organizer");
}

export async function signOut() {
  "use server";

  const jar = await cookies();
  const workspaceId = workspaceFrom(jar);
  const token = readToken(jar, sessionCookie);
  if (workspaceId && token) store.closeSession(workspaceId, token);
  jar.delete(sessionCookie);
  redirect("/");
}
